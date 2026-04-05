"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CalendarRequestKind, Classroom, StudentGroup } from "@/lib/types";
import {
  CALENDAR_REQUEST_KINDS,
  CALENDAR_REQUEST_KIND_LABELS,
  PROFESSOR_VENUE_NAMES,
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
import { encodeCalendarRequestSubjects } from "@/lib/calendar-request-subject";
import { useClientTodayIso } from "@/hooks/use-client-today";
import { groupsForProfessorBookingForm } from "@/lib/professor-booking-groups";

function normalizeRequestKind(k: CalendarRequestKind): CalendarRequestKind {
  return k === "class" ? "extra_class" : k;
}

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
      toast.error("Please select at least one student group");
      return;
    }

    if (conflictWarning) {
      toast.error("Cannot book — this slot is already taken");
      return;
    }

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
        : `Request submitted for ${selectedGroupIds.length} student groups!`
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
    () => PROFESSOR_VENUE_NAMES.filter((name) => !venueByLabel.get(name)),
    [venueByLabel]
  );

  const classroomAvailabilityResource = useMemo(() => {
    if (!classroomId) return null;
    return {
      kind: "classroom" as const,
      classroomId,
      label: selectedRoom?.name,
    };
  }, [classroomId, selectedRoom?.name]);

  const descriptionText =
    selectedRoom && eventDate ? (
      <>
        Booking <strong>{selectedRoom.name}</strong> (venue) on{" "}
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
      "Request to block a time slot for student groups and a venue. An admin will review your request."
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

        {/* Multi-select student groups (fixed program list) */}
        {groupsForBooking.length === 0 ? (
          <div className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-3 text-sm text-amber-800 dark:text-amber-200">
            No program groups found (GMP-A … BM-D). Run{" "}
            <code className="rounded bg-muted px-1 text-foreground">
              add-calendar-request-subject-and-program-groups.sql
            </code>{" "}
            in Supabase SQL Editor.
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

        <div className="space-y-2">
          <Label htmlFor="bf-venue">
            Venue
            <span className="text-destructive">*</span>
          </Label>
          <select
            id="bf-venue"
            className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={classroomId}
            onChange={(e) => setClassroomId(e.target.value)}
            required
          >
            <option value="">Select venue</option>
            {showAdHocVenueOption && prefillClassroom && (
              <option value={prefillClassroom.id}>
                {prefillClassroom.name} (from calendar)
              </option>
            )}
            {PROFESSOR_VENUE_NAMES.map((name) => {
              const row = venueByLabel.get(name);
              if (!row) return null;
              return (
                <option key={name} value={row.id}>
                  {name}
                </option>
              );
            })}
          </select>
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
        Student Groups
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
              ? "Select groups..."
              : `${selectedNames.length} group${selectedNames.length > 1 ? "s" : ""} selected`}
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
                    {g.name}
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
