"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CalendarRequestKind, Classroom, StudentGroup } from "@/lib/types";
import {
  CALENDAR_REQUEST_KINDS,
  CALENDAR_REQUEST_KIND_LABELS,
  PROFESSOR_VENUE_NAMES,
  professorVenueNamesForRequestKind,
  resolveProfessorVenues,
} from "@/lib/calendar-request-metadata";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, ChevronDown, X } from "lucide-react";
import { toast } from "sonner";
import { DatePicker } from "@/components/ui/date-picker";
import { TimeRangeSelect } from "@/components/ui/time-range-select";
import { ResourceAvailabilityCalendar } from "@/components/resource-availability-calendar";
import { SubjectMultiSelect } from "@/components/ui/subject-combobox";
import { encodeCalendarRequestInfra } from "@/lib/calendar-request-infra";
import { encodeCalendarRequestSubjects } from "@/lib/calendar-request-subject";
import { useClientTodayIso } from "@/hooks/use-client-today";
import { groupsForProfessorBookingForm } from "@/lib/professor-booking-groups";
import { toTitleCase } from "@/lib/utils";

function normalizeRequestKind(k: CalendarRequestKind): CalendarRequestKind {
  return k === "class" ? "extra_class" : k;
}

/** Sentinel for Radix/Base UI Select (no empty string value). */
const VENUE_SELECT_NONE = "__bf_venue_none__";

export interface BookingFormPrefill {
  classroomId?: string;
  eventDate?: string;
  startTime?: string;
  endTime?: string;
}

interface BookingFormProps {
  profileId: string;
  classrooms: Classroom[];
  studentGroups: StudentGroup[];
  prefill?: BookingFormPrefill;
  /** Initial row for `calendar_requests.request_kind`. */
  defaultRequestKind?: CalendarRequestKind;
  onSuccess: () => void;
  onClose: () => void;
  /** Use inside a sidebar/panel instead of Radix Dialog (no DialogContent). */
  variant?: "dialog" | "panel";
}

export function BookingForm({
  profileId,
  classrooms,
  studentGroups,
  prefill,
  defaultRequestKind = "extra_class",
  onSuccess,
  onClose,
  variant = "dialog",
}: BookingFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [conflictWarning, setConflictWarning] = useState("");
  const [pastWarning, setPastWarning] = useState("");
  const [timeRangeWarning, setTimeRangeWarning] = useState("");

  const [title, setTitle] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<string[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [description, setDescription] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [classroomId, setClassroomId] = useState(prefill?.classroomId || "");
  const [eventDate, setEventDate] = useState(prefill?.eventDate || "");
  const [startTime, setStartTime] = useState(prefill?.startTime || "");
  const [endTime, setEndTime] = useState(prefill?.endTime || "");
  const [requestKind, setRequestKind] = useState<CalendarRequestKind>(() =>
    normalizeRequestKind(defaultRequestKind)
  );
  const [infraMic, setInfraMic] = useState("");
  const [infraSofa, setInfraSofa] = useState("");
  const [infraMomento, setInfraMomento] = useState("");
  const [infraBouquet, setInfraBouquet] = useState("");
  const [infraVideoRecording, setInfraVideoRecording] = useState(false);
  const [infraPhotography, setInfraPhotography] = useState(false);
  const [infraStage, setInfraStage] = useState(false);
  const todayIso = useClientTodayIso();

  useEffect(() => {
    setRequestKind(normalizeRequestKind(defaultRequestKind));
  }, [defaultRequestKind]);

  useEffect(() => {
    if (prefill?.classroomId) setClassroomId(prefill.classroomId);
    if (prefill?.eventDate) setEventDate(prefill.eventDate);
    if (prefill?.startTime) setStartTime(prefill.startTime);
    if (prefill?.endTime) setEndTime(prefill.endTime);
  }, [prefill]);

  /** Drop canonical venue selection when it is not allowed for the current request type (ad hoc calendar rooms unchanged). */
  useEffect(() => {
    if (!classroomId) return;
    const row = classrooms.find((c) => c.id === classroomId);
    if (!row) return;
    const nameNorm = row.name.trim().toLowerCase();
    const matchesCanonical = PROFESSOR_VENUE_NAMES.some(
      (label) => label.trim().toLowerCase() === nameNorm
    );
    if (!matchesCanonical) return;
    const allowed = professorVenueNamesForRequestKind(requestKind);
    const ok = allowed.some(
      (label) => label.trim().toLowerCase() === nameNorm
    );
    if (!ok) setClassroomId("");
  }, [requestKind, classroomId, classrooms]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    setSubjectsLoading(true);
    supabase
      .from("student_enrollments")
      .select("subject")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load subjects from enrollments", error);
          setSubjectOptions([]);
        } else {
          const seen = new Set<string>();
          const list: string[] = [];
          for (const row of data ?? []) {
            const s = String(row.subject ?? "").trim();
            if (s && !seen.has(s)) {
              seen.add(s);
              list.push(s);
            }
          }
          list.sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: "base" })
          );
          setSubjectOptions(list);
        }
        setSubjectsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleGroup(id: string) {
    setSelectedGroupIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  }

  useEffect(() => {
    setPastWarning("");
  }, [eventDate, startTime]);

  useEffect(() => {
    setTimeRangeWarning("");
  }, [startTime, endTime]);

  useEffect(() => {
    if (!classroomId || !eventDate || !startTime || !endTime) {
      setConflictWarning("");
      return;
    }
    const supabase = createClient();
    // Only approved bookings block the slot; pending / clarification / rejected do not.
    supabase
      .from("calendar_requests")
      .select("id, start_time, end_time")
      .eq("status", "approved")
      .eq("classroom_id", classroomId)
      .eq("event_date", eventDate)
      .then(({ data }) => {
        if (!data) return;
        const sM = timeToMins(startTime);
        const eM = timeToMins(endTime);
        const conflict = data.some((b) => {
          const bs = timeToMins(b.start_time);
          const be = timeToMins(b.end_time);
          return sM < be && bs < eM;
        });
        setConflictWarning(
          conflict
            ? "This venue is already booked during the selected time. Please pick a different time or venue."
            : ""
        );
      });
  }, [classroomId, eventDate, startTime, endTime]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (selectedGroupIds.length === 0) {
      toast.error("Please select at least one program");
      return;
    }

    if (!classroomId?.trim()) {
      toast.error("Please select a venue");
      return;
    }

    if (conflictWarning) {
      toast.error("Cannot book — this slot is already taken");
      return;
    }

    function parseOptionalCount(raw: string): number | undefined | "bad" {
      const t = raw.trim();
      if (t === "") return undefined;
      if (!/^\d+$/.test(t)) return "bad";
      return Number.parseInt(t, 10);
    }

    const micN = parseOptionalCount(infraMic);
    const sofaN = parseOptionalCount(infraSofa);
    const momentoN = parseOptionalCount(infraMomento);
    const bouquetN = parseOptionalCount(infraBouquet);
    if (
      micN === "bad" ||
      sofaN === "bad" ||
      momentoN === "bad" ||
      bouquetN === "bad"
    ) {
      toast.error("Infrastructure counts must be whole numbers (0 or more).");
      return;
    }

    const infraPayload = encodeCalendarRequestInfra({
      mic_count: micN,
      sofa_count: sofaN,
      momento_count: momentoN,
      bouquet_count: bouquetN,
      video_recording: infraVideoRecording,
      photography: infraPhotography,
      stage: infraStage,
    });

    setSubmitting(true);
    const supabase = createClient();

    // Create a single calendar request
    const { data: requestData, error: insertError } = await supabase
      .from("calendar_requests")
      .insert({
        professor_id: profileId,
        title,
        subject: encodeCalendarRequestSubjects(selectedSubjects),
        description: description || null,
        student_group_id: selectedGroupIds[0], // Keep the first group for backward compatibility
        classroom_id: classroomId,
        event_date: eventDate,
        start_time: startTime,
        end_time: endTime,
        request_kind: requestKind === "class" ? "extra_class" : requestKind,
        infra_requirements: infraPayload,
      })
      .select()
      .single();

    if (insertError || !requestData) {
      toast.error("Failed to create request: " + (insertError?.message || "Unknown error"));
      setSubmitting(false);
      return;
    }

    // Insert all groups into the junction table
    const groupLinks = selectedGroupIds.map((gid) => ({
      calendar_request_id: requestData.id,
      student_group_id: gid,
    }));

    const { error: groupError } = await supabase
      .from("calendar_request_groups")
      .insert(groupLinks);

    if (groupError) {
      toast.error("Failed to link groups: " + groupError.message);
      setSubmitting(false);
      return;
    }

    toast.success(
      selectedGroupIds.length === 1
        ? "Request submitted successfully!"
        : `Request submitted for ${selectedGroupIds.length} programs!`
    );
    setSubmitting(false);
    onSuccess();
    onClose();
  }

  const selectedRoom = classrooms.find((c) => c.id === classroomId);

  const groupsForBooking = useMemo(
    () => groupsForProfessorBookingForm(studentGroups),
    [studentGroups]
  );

  const venueByLabel = useMemo(
    () => resolveProfessorVenues(classrooms),
    [classrooms]
  );

  const allowedVenueNames = useMemo(
    () => professorVenueNamesForRequestKind(requestKind),
    [requestKind]
  );

  const prefillClassroom = useMemo(
    () =>
      prefill?.classroomId
        ? classrooms.find((c) => c.id === prefill.classroomId)
        : undefined,
    [prefill?.classroomId, classrooms]
  );

  const prefillIsListedVenue = useMemo(() => {
    if (!prefillClassroom) return false;
    const n = prefillClassroom.name.trim().toLowerCase();
    return PROFESSOR_VENUE_NAMES.some((label) => label.trim().toLowerCase() === n);
  }, [prefillClassroom]);

  const showAdHocVenueOption = Boolean(
    prefillClassroom && !prefillIsListedVenue
  );

  const missingVenueSeeds = useMemo(
    () => allowedVenueNames.filter((name) => !venueByLabel.get(name)),
    [allowedVenueNames, venueByLabel]
  );

  const venueSelectLabel = useMemo(() => {
    if (!classroomId) return "Select venue";
    if (showAdHocVenueOption && prefillClassroom?.id === classroomId) {
      return `${toTitleCase(prefillClassroom.name)} (from calendar)`;
    }
    for (const name of allowedVenueNames) {
      const row = venueByLabel.get(name);
      if (row?.id === classroomId) return toTitleCase(name);
    }
    const raw =
      classrooms.find((c) => c.id === classroomId)?.name ?? "Select venue";
    if (raw === "Select venue") return "Select venue";
    return toTitleCase(raw);
  }, [
    classroomId,
    showAdHocVenueOption,
    prefillClassroom,
    allowedVenueNames,
    venueByLabel,
    classrooms,
  ]);

  const classroomAvailabilityResource = useMemo(() => {
    if (!classroomId) return null;
    return {
      kind: "classroom" as const,
      classroomId,
      label: selectedRoom?.name ? toTitleCase(selectedRoom.name) : undefined,
    };
  }, [classroomId, selectedRoom?.name]);

  const descriptionText =
    selectedRoom && eventDate ? (
      <>
        Booking <strong>{toTitleCase(selectedRoom.name)}</strong> (venue) on{" "}
        <strong>{eventDate}</strong>
        {startTime && (
          <>
            {" "}
            at <strong>{startTime}</strong>
          </>
        )}
        . Fill in the remaining details.
      </>
    ) : (
      "Request to block a time slot for programs and a venue. An admin will review your request."
    );

  const header =
    variant === "dialog" ? (
      <DialogHeader>
        <DialogTitle>Create Event Block Request</DialogTitle>
        <DialogDescription>{descriptionText}</DialogDescription>
      </DialogHeader>
    ) : (
      <div className="space-y-1.5 pb-4">
        <h2 className="text-lg font-semibold leading-tight text-foreground">
          Create Event Block Request
        </h2>
        <p className="text-sm text-muted-foreground">{descriptionText}</p>
      </div>
    );

  const requestKindSelectValue =
    requestKind === "class" ? "extra_class" : requestKind;

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="bf-request-kind">Request type</Label>
          <Select
            value={requestKindSelectValue}
            onValueChange={(v) =>
              setRequestKind(v as CalendarRequestKind)
            }
          >
            <SelectTrigger id="bf-request-kind" className="w-full">
              <SelectValue>
                {CALENDAR_REQUEST_KIND_LABELS[requestKindSelectValue]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {CALENDAR_REQUEST_KINDS.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {CALENDAR_REQUEST_KIND_LABELS[kind]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bf-venue">
            Venue
            <span className="text-destructive">*</span>
          </Label>
          <Select
            value={classroomId || VENUE_SELECT_NONE}
            onValueChange={(v) =>
              setClassroomId(
                !v || v === VENUE_SELECT_NONE ? "" : String(v)
              )
            }
          >
            <SelectTrigger id="bf-venue" className="w-full">
              <SelectValue>{venueSelectLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={VENUE_SELECT_NONE}>Select venue</SelectItem>
              {showAdHocVenueOption && prefillClassroom && (
                <SelectItem value={prefillClassroom.id}>
                  {toTitleCase(prefillClassroom.name)} (from calendar)
                </SelectItem>
              )}
              {allowedVenueNames.map((name) => {
                const row = venueByLabel.get(name);
                if (!row) return null;
                return (
                  <SelectItem key={name} value={row.id}>
                    {toTitleCase(name)}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Available venues depend on request type.
          </p>
          {missingVenueSeeds.length > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Missing venue rows in the database: {missingVenueSeeds.join(", ")}. Run{" "}
              <code className="rounded bg-muted px-1">expand-professor-request-kinds-and-venues.sql</code>{" "}
              in Supabase (SQL Editor).
            </p>
          )}
        </div>

        {classroomAvailabilityResource && (
          <ResourceAvailabilityCalendar
            resource={classroomAvailabilityResource}
            compact={variant === "panel"}
          />
        )}

        <div className="space-y-2">
          <Label htmlFor="bf-title">
            Event Title
            <span className="text-destructive">*</span>
          </Label>
          <Input
            id="bf-title"
            placeholder="e.g. Data Structures Lecture"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bf-description">Description (optional)</Label>
          <Textarea
            id="bf-description"
            placeholder="Additional details..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>

        {/* Multi-select programs (loaded from student_groups table, populated by admin CSV) */}
        {groupsForBooking.length === 0 ? (
          <div className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-3 text-sm text-amber-800 dark:text-amber-200">
            No programs found. Ask your admin to upload the student roster CSV
            (the <strong>program</strong> column creates the program list).
          </div>
        ) : (
          <GroupMultiSelect
            groups={groupsForBooking}
            selectedIds={selectedGroupIds}
            onToggle={toggleGroup}
          />
        )}

        <div className="space-y-2">
          <Label htmlFor="bf-subject">Subjects (optional)</Label>
          <SubjectMultiSelect
            id="bf-subject"
            options={subjectOptions}
            value={selectedSubjects}
            onChange={setSelectedSubjects}
            loading={subjectsLoading}
            placeholder="Search and select subjects from enrollments"
          />
          <p className="text-xs text-muted-foreground">
            Distinct subjects from the student enrollment roster (admin CSV).
          </p>
        </div>

        <fieldset className="space-y-3 rounded-lg border border-border/80 bg-muted/20 px-3 py-3">
          <legend className="px-1 text-sm font-medium text-foreground">
            Infrastructure requirements (optional)
          </legend>
          <p className="text-xs text-muted-foreground -mt-1">
            Specify what you need arranged for the event. Leave blank if not applicable.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bf-infra-mic" className="text-xs font-normal">
                No. of mics
              </Label>
              <Input
                id="bf-infra-mic"
                inputMode="numeric"
                placeholder="—"
                value={infraMic}
                onChange={(e) => setInfraMic(e.target.value.replace(/\D/g, ""))}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bf-infra-sofa" className="text-xs font-normal">
                No. of sofas
              </Label>
              <Input
                id="bf-infra-sofa"
                inputMode="numeric"
                placeholder="—"
                value={infraSofa}
                onChange={(e) => setInfraSofa(e.target.value.replace(/\D/g, ""))}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bf-infra-momento" className="text-xs font-normal">
                No. of momento
              </Label>
              <Input
                id="bf-infra-momento"
                inputMode="numeric"
                placeholder="—"
                value={infraMomento}
                onChange={(e) => setInfraMomento(e.target.value.replace(/\D/g, ""))}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bf-infra-bouquet" className="text-xs font-normal">
                No. of bouquets
              </Label>
              <Input
                id="bf-infra-bouquet"
                inputMode="numeric"
                placeholder="—"
                value={infraBouquet}
                onChange={(e) => setInfraBouquet(e.target.value.replace(/\D/g, ""))}
                className="h-9"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2.5 pt-1">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 rounded border border-input accent-primary"
                checked={infraVideoRecording}
                onChange={(e) => setInfraVideoRecording(e.target.checked)}
              />
              Video recording
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 rounded border border-input accent-primary"
                checked={infraPhotography}
                onChange={(e) => setInfraPhotography(e.target.checked)}
              />
              Photography
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 rounded border border-input accent-primary"
                checked={infraStage}
                onChange={(e) => setInfraStage(e.target.checked)}
              />
              Stage
            </label>
          </div>
        </fieldset>

        <div className="space-y-2">
          <Label>
            Date
            <span className="text-destructive">*</span>
          </Label>
          <DatePicker
            value={eventDate}
            onChange={setEventDate}
            min={todayIso}
            placeholder="Pick a date"
          />
        </div>
        <div className="space-y-2">
          <Label>
            Time
            <span className="text-destructive">*</span>
          </Label>
          <TimeRangeSelect
            startValue={startTime}
            endValue={endTime}
            onStartChange={setStartTime}
            onEndChange={setEndTime}
            startLabel={
              <Label htmlFor="bf-start-time" className="text-muted-foreground font-normal text-sm">
                Start
              </Label>
            }
            endLabel={
              <Label htmlFor="bf-end-time" className="text-muted-foreground font-normal text-sm">
                End
              </Label>
            }
            startPlaceholder="Start time"
            endPlaceholder="End time"
            startTriggerId="bf-start-time"
            endTriggerId="bf-end-time"
          />
        </div>

        {/* Past time warning */}
        {pastWarning && (
          <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
            <p className="text-sm text-orange-700">{pastWarning}</p>
          </div>
        )}

        {/* Time range warning */}
        {timeRangeWarning && !pastWarning && (
          <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
            <p className="text-sm text-orange-700">{timeRangeWarning}</p>
          </div>
        )}

        {/* Conflict warning */}
        {conflictWarning && !pastWarning && !timeRangeWarning && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{conflictWarning}</p>
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={
            submitting ||
            !!conflictWarning ||
            !!pastWarning ||
            !!timeRangeWarning ||
            groupsForBooking.length === 0
          }
        >
          {submitting
            ? "Submitting..."
            : pastWarning
              ? "Past Time"
              : timeRangeWarning
                ? "Invalid Time Range"
                : conflictWarning
                  ? "Slot Unavailable"
                  : "Submit Request"}
        </Button>
      </form>
  );

  if (variant === "panel") {
    return (
      <div className="flex flex-col min-h-0">
        {header}
        {form}
      </div>
    );
  }

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      {header}
      {form}
    </DialogContent>
  );
}

function GroupMultiSelect({
  groups,
  selectedIds,
  onToggle,
}: {
  groups: StudentGroup[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    
    if (open) {
      // Use a small delay to avoid capturing the initial click
      setTimeout(() => {
        document.addEventListener("click", handleClickOutside);
      }, 0);
    }
    
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [open]);

  const selectedNames = groups
    .filter((g) => selectedIds.includes(g.id))
    .map((g) => g.name);

  return (
    <div className="space-y-2" ref={ref}>
      <Label>
        Programs
        <span className="text-destructive">*</span>
      </Label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          className="flex h-9 w-full items-center justify-between rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <span className={selectedNames.length === 0 ? "text-muted-foreground" : ""}>
            {selectedNames.length === 0
              ? "Select programs..."
              : `${selectedNames.length} program${selectedNames.length > 1 ? "s" : ""} selected`}
          </span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="absolute z-[110] mt-1 w-full rounded-lg border bg-popover shadow-lg">
            <div className="max-h-48 overflow-y-auto p-1">
              {groups.map((g) => {
                const checked = selectedIds.includes(g.id);
                return (
                  <label
                    key={g.id}
                    className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm cursor-pointer transition-colors ${
                      checked ? "bg-primary/10 text-primary" : "hover:bg-muted"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(g.id)}
                      className="rounded"
                    />
                    {toTitleCase(g.name)}
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {selectedNames.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {groups
            .filter((g) => selectedIds.includes(g.id))
            .map((g) => (
              <span
                key={g.id}
                className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium"
              >
                {g.name}
                <button
                  type="button"
                  onClick={() => onToggle(g.id)}
                  className="hover:text-destructive transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

function timeToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
