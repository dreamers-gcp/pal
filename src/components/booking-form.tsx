"use client";

import { useState } from "react";
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
  const supabase = createClient();
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [studentGroupId, setStudentGroupId] = useState("");
  const [classroomId, setClassroomId] = useState(prefill?.classroomId ?? "");
  const [eventDate, setEventDate] = useState(prefill?.eventDate ?? "");
  const [startTime, setStartTime] = useState(prefill?.startTime ?? "");
  const [endTime, setEndTime] = useState(prefill?.endTime ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const { error } = await supabase.from("calendar_requests").insert({
      professor_id: profileId,
      title,
      description: description || null,
      student_group_id: studentGroupId,
      classroom_id: classroomId,
      event_date: eventDate,
      start_time: startTime,
      end_time: endTime,
    });

    if (error) {
      toast.error("Failed to create request: " + error.message);
      setSubmitting(false);
      return;
    }

    toast.success("Request submitted successfully!");
    setSubmitting(false);
    onSuccess();
    onClose();
  }

  const selectedRoom = classrooms.find((c) => c.id === classroomId);

  return (
    <DialogContent className="max-w-lg">
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
            "Request to block a time slot for a student group and classroom. An admin will review your request."
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
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bf-studentGroup">Student Group</Label>
            <select
              id="bf-studentGroup"
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={studentGroupId}
              onChange={(e) => setStudentGroupId(e.target.value)}
              required
            >
              <option value="">Select group</option>
              {studentGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
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
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit Request"}
        </Button>
      </form>
    </DialogContent>
  );
}
