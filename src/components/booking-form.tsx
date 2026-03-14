"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Classroom, StudentGroup } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, ChevronDown, X } from "lucide-react";
import { toast } from "sonner";

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
  onSuccess: () => void;
  onClose: () => void;
}

export function BookingForm({
  profileId,
  classrooms,
  studentGroups,
  prefill,
  onSuccess,
  onClose,
}: BookingFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [conflictWarning, setConflictWarning] = useState("");
  const [pastWarning, setPastWarning] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [classroomId, setClassroomId] = useState(prefill?.classroomId || "");
  const [eventDate, setEventDate] = useState(prefill?.eventDate || "");
  const [startTime, setStartTime] = useState(prefill?.startTime || "");
  const [endTime, setEndTime] = useState(prefill?.endTime || "");

  useEffect(() => {
    if (prefill?.classroomId) setClassroomId(prefill.classroomId);
    if (prefill?.eventDate) setEventDate(prefill.eventDate);
    if (prefill?.startTime) setStartTime(prefill.startTime);
    if (prefill?.endTime) setEndTime(prefill.endTime);
  }, [prefill]);

  function toggleGroup(id: string) {
    setSelectedGroupIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  }

  useEffect(() => {
    if (!eventDate || !startTime) {
      setPastWarning("");
      return;
    }
    const now = new Date();
    const slotStart = new Date(`${eventDate}T${startTime}`);
    setPastWarning(
      slotStart < now
        ? "Cannot book a slot in the past. Please choose a future date/time."
        : ""
    );
  }, [eventDate, startTime]);

  useEffect(() => {
    if (!classroomId || !eventDate || !startTime || !endTime) {
      setConflictWarning("");
      return;
    }
    const supabase = createClient();
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
            ? "This classroom is already booked during the selected time. Please pick a different time or room."
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

    if (pastWarning) {
      toast.error("Cannot book a slot in the past");
      return;
    }

    if (conflictWarning) {
      toast.error("Cannot book — this slot is already taken");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    const rows = selectedGroupIds.map((gid) => ({
      professor_id: profileId,
      title,
      description: description || null,
      student_group_id: gid,
      classroom_id: classroomId,
      event_date: eventDate,
      start_time: startTime,
      end_time: endTime,
    }));

    const { error } = await supabase.from("calendar_requests").insert(rows);

    if (error) {
      toast.error("Failed to create request: " + error.message);
      setSubmitting(false);
      return;
    }

    toast.success(
      rows.length === 1
        ? "Request submitted successfully!"
        : `${rows.length} requests submitted (one per group)!`
    );
    setSubmitting(false);
    onSuccess();
    onClose();
  }

  const selectedRoom = classrooms.find((c) => c.id === classroomId);

  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Create Calendar Block Request</DialogTitle>
        <DialogDescription>
          {selectedRoom && eventDate ? (
            <>
              Booking <strong>{selectedRoom.name}</strong> on{" "}
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
            "Request to block a time slot for student groups and a classroom. An admin will review your request."
          )}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="bf-title">Event Title</Label>
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

        {/* Multi-select student groups dropdown */}
        <GroupMultiSelect
          groups={studentGroups}
          selectedIds={selectedGroupIds}
          onToggle={toggleGroup}
        />

        <div className="space-y-2">
          <Label htmlFor="bf-classroom">Classroom</Label>
          <select
            id="bf-classroom"
            className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={classroomId}
            onChange={(e) => setClassroomId(e.target.value)}
            required
          >
            <option value="">Select room</option>
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.capacity ? `(${c.capacity})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bf-eventDate">Date</Label>
          <Input
            id="bf-eventDate"
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bf-startTime">Start Time</Label>
            <Input
              id="bf-startTime"
              type="time"
              step="1800"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bf-endTime">End Time</Label>
            <Input
              id="bf-endTime"
              type="time"
              step="1800"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Past time warning */}
        {pastWarning && (
          <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
            <p className="text-sm text-orange-700">{pastWarning}</p>
          </div>
        )}

        {/* Conflict warning */}
        {conflictWarning && !pastWarning && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{conflictWarning}</p>
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={submitting || !!conflictWarning || !!pastWarning}
        >
          {submitting
            ? "Submitting..."
            : pastWarning
              ? "Past Time"
              : conflictWarning
                ? "Slot Unavailable"
                : "Submit Request"}
        </Button>
      </form>
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
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectedNames = groups
    .filter((g) => selectedIds.includes(g.id))
    .map((g) => g.name);

  return (
    <div className="space-y-2" ref={ref}>
      <Label>Student Groups</Label>
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
          <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-lg">
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
