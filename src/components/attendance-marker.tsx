"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { WebcamCapture } from "@/components/webcam-capture";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  ScanFace,
  User,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format, parse, addMinutes, subMinutes, isWithinInterval } from "date-fns";
import type { CalendarRequest, AttendanceRecord, Profile } from "@/lib/types";

const ATTENDANCE_WINDOW_MINUTES = 30;

function isEventToday(dateStr: string): boolean {
  const now = new Date();
  const [y, m, d] = dateStr.split("-").map(Number);
  return (
    now.getFullYear() === y &&
    now.getMonth() + 1 === m &&
    now.getDate() === d
  );
}

interface Props {
  profile: Profile;
  events: CalendarRequest[];
}

export function AttendanceMarker({ profile, events }: Props) {
  const supabase = createClient();
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceRecord>>({});
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [captureFor, setCaptureFor] = useState<string | null>(null);
  const [faceRegistered, setFaceRegistered] = useState(profile.face_registered);

  const fetchAttendance = useCallback(async () => {
    const [{ data: attData }, { data: profileData }] = await Promise.all([
      supabase
        .from("attendance_records")
        .select("*")
        .eq("student_id", profile.id),
      supabase
        .from("profiles")
        .select("face_registered")
        .eq("id", profile.id)
        .single(),
    ]);

    if (profileData) setFaceRegistered(profileData.face_registered);

    const map: Record<string, AttendanceRecord> = {};
    for (const r of attData ?? []) {
      map[r.event_id] = r;
    }
    setAttendanceMap(map);
    setLoading(false);
  }, [profile.id, supabase]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const todayEvents = events.filter((e) => isEventToday(e.event_date));

  function isWithinAttendanceWindow(event: CalendarRequest): boolean {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startTime = parse(event.start_time, "HH:mm:ss", today);
    const windowStart = subMinutes(startTime, ATTENDANCE_WINDOW_MINUTES);
    const windowEnd = addMinutes(startTime, ATTENDANCE_WINDOW_MINUTES);
    return isWithinInterval(now, { start: windowStart, end: windowEnd });
  }

  async function handleCapture(eventId: string, blob: Blob) {
    setCaptureFor(null);
    setVerifying(eventId);

    try {
      // Path must start with student_id/ to satisfy storage RLS
      const filename = `${profile.id}/attendance-${eventId}-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("face-photos")
        .upload(filename, blob, { contentType: "image/jpeg" });

      if (upErr) {
        toast.error("Upload failed: " + upErr.message);
        setVerifying(null);
        return;
      }

      // Send photo to face comparison API
      const form = new FormData();
      form.append("file", blob, "face.jpg");
      form.append("studentId", profile.id);

      const res = await fetch("/api/face/compare", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Verification failed");
        setVerifying(null);
        return;
      }

      if (!data.match) {
        toast.error(
          `Face not recognized (similarity: ${(data.similarity * 100).toFixed(1)}%). Please try again with better lighting.`
        );
        await supabase.storage.from("face-photos").remove([filename]);
        setVerifying(null);
        return;
      }

      // Save attendance record
      const { error: dbErr } = await supabase.from("attendance_records").insert({
        student_id: profile.id,
        event_id: eventId,
        photo_path: filename,
        similarity_score: data.similarity,
        verified: true,
      });

      if (dbErr) {
        if (dbErr.code === "23505") {
          toast.info("Attendance already marked for this class");
        } else {
          toast.error("Could not save attendance: " + dbErr.message);
        }
        setVerifying(null);
        return;
      }

      toast.success(
        `Attendance marked! (confidence: ${(data.similarity * 100).toFixed(1)}%)`
      );
      await fetchAttendance();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setVerifying(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!faceRegistered) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="py-4">
          <p className="text-sm text-yellow-800">
            <strong>Face not registered.</strong> Go to the{" "}
            <strong>Face ID</strong> tab to register your face before marking
            attendance.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <ScanFace className="h-5 w-5" />
          Today&apos;s Attendance
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Mark attendance within ±{ATTENDANCE_WINDOW_MINUTES} minutes of class start
        </p>
      </div>

      {todayEvents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No classes scheduled for today.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {todayEvents.map((event) => {
            const att = attendanceMap[event.id];
            const inWindow = isWithinAttendanceWindow(event);

            return (
              <Card key={event.id} className="relative">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{event.title}</CardTitle>
                    {att ? (
                      <Badge className="bg-green-50 text-green-700 border-green-200 gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Present
                      </Badge>
                    ) : inWindow ? (
                      <Badge className="bg-blue-50 text-blue-700 border-blue-200 animate-pulse">
                        Open
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        {(() => {
                          const now = new Date();
                          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                          return parse(event.start_time, "HH:mm:ss", today) > now
                            ? "Upcoming"
                            : "Missed";
                        })()}
                      </Badge>
                    )}
                  </div>
                  {event.description && (
                    <CardDescription className="text-xs">
                      {event.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {event.start_time.slice(0, 5)} – {event.end_time.slice(0, 5)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{event.classroom?.name ?? "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    <span>Prof. {event.professor?.full_name ?? "—"}</span>
                  </div>

                  {/* Attendance action */}
                  {att ? (
                    <div className="pt-2 text-xs text-green-700">
                      Marked at {format(new Date(att.marked_at), "h:mm a")} —
                      confidence {(att.similarity_score * 100).toFixed(1)}%
                    </div>
                  ) : verifying === event.id ? (
                    <div className="flex items-center gap-2 pt-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Verifying face…
                    </div>
                  ) : captureFor === event.id ? (
                    <div className="pt-2">
                      <WebcamCapture
                        onCapture={(blob) => handleCapture(event.id, blob)}
                        onCancel={() => setCaptureFor(null)}
                        buttonLabel="Take attendance photo"
                      />
                    </div>
                  ) : inWindow ? (
                    <Button
                      size="sm"
                      className="mt-2 gap-1.5"
                      onClick={() => setCaptureFor(event.id)}
                    >
                      <Camera className="h-4 w-4" /> Mark Attendance
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground pt-2">
                      Attendance window not active
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Attendance history for all events (not just today) */}
      <AttendanceHistory
        attendanceMap={attendanceMap}
        events={events}
      />
    </div>
  );
}

function AttendanceHistory({
  attendanceMap,
  events,
}: {
  attendanceMap: Record<string, AttendanceRecord>;
  events: CalendarRequest[];
}) {
  const pastEvents = events.filter(
    (e) => new Date(e.event_date) <= new Date() && !isEventToday(e.event_date)
  );

  if (pastEvents.length === 0) return null;

  const sortedPast = [...pastEvents].sort(
    (a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
  );

  const totalPast = sortedPast.length;
  const attended = sortedPast.filter((e) => attendanceMap[e.id]).length;

  return (
    <div className="space-y-3 pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Attendance History</h3>
        <Badge variant="outline">
          {attended}/{totalPast} attended ({totalPast > 0 ? Math.round((attended / totalPast) * 100) : 0}%)
        </Badge>
      </div>
      <div className="space-y-1.5">
        {sortedPast.slice(0, 20).map((event) => {
          const att = attendanceMap[event.id];
          return (
            <div
              key={event.id}
              className="flex items-center gap-3 py-1.5 px-2 rounded text-sm"
            >
              {att ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-red-400 shrink-0" />
              )}
              <span className="truncate flex-1">{event.title}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {format(new Date(event.event_date), "MMM d")}
              </span>
              {att && (
                <span className="text-xs text-green-600 shrink-0">
                  {(att.similarity_score * 100).toFixed(0)}%
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
