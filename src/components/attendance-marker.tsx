"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Filter,
  User,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format, parse, addMinutes, isWithinInterval } from "date-fns";
import type { CalendarRequest, AttendanceRecord, Profile } from "@/lib/types";
import {
  decodeCalendarRequestSubjects,
  attendanceSubjectLabelsForEvent,
  eventMatchesAttendanceSubjectFilter,
  uniqueAttendanceSubjectLabels,
} from "@/lib/calendar-request-subject";
import {
  isProfessorMarkedAbsent,
  isStudentPresent,
} from "@/lib/attendance-record";
import {
  classroomExpectsWifi,
  WEB_ATTENDANCE_WIFI_BLOCKED,
} from "@/lib/attendance-wifi-match";
import { DatePicker } from "@/components/ui/date-picker";
import { AttendanceMarkerListSkeleton } from "@/components/ui/loading-skeletons";

const ATTENDANCE_WINDOW_MINUTES = 15;

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
  const [camStream, setCamStream] = useState<MediaStream | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);

  function killCamStream() {
    camStreamRef.current?.getTracks().forEach((t) => t.stop());
    camStreamRef.current = null;
    setCamStream(null);
    setCaptureFor(null);
  }

  async function openCameraFor(eventId: string) {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      camStreamRef.current = s;
      setCamStream(s);
      setCaptureFor(eventId);
    } catch {
      toast.error("Camera permission denied or unavailable.");
    }
  }
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
    const windowStart = startTime; // only after class start
    const windowEnd = addMinutes(startTime, ATTENDANCE_WINDOW_MINUTES);
    return isWithinInterval(now, { start: windowStart, end: windowEnd });
  }

  async function handleCapture(event: CalendarRequest, blob: Blob) {
    killCamStream();
    setVerifying(event.id);

    try {
      // Double-check the time window at the moment we verify (prevents front-end tampering).
      if (!isWithinAttendanceWindow(event)) {
        toast.error("Attendance window not active for this class. Please try again within 15 minutes of start time.");
        return;
      }

      const { data: existingRow } = await supabase
        .from("attendance_records")
        .select("verified, photo_path")
        .eq("student_id", profile.id)
        .eq("event_id", event.id)
        .maybeSingle();

      if (isProfessorMarkedAbsent(existingRow)) {
        toast.error(
          "Your instructor marked you absent for this class. Contact them if this is a mistake."
        );
        return;
      }
      if (existingRow?.verified) {
        toast.info("Attendance already marked for this class");
        return;
      }

      // Path must start with student_id/ to satisfy storage RLS
      const filename = `${profile.id}/attendance-${event.id}-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("face-photos")
        .upload(filename, blob, { contentType: "image/jpeg" });

      if (upErr) {
        toast.error(
          `Face verification — Could not upload your photo: ${upErr.message}`
        );
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
        toast.error(
          `Face verification failed — ${data.error ?? "Could not verify your face."}`
        );
        await supabase.storage.from("face-photos").remove([filename]);
        setVerifying(null);
        return;
      }

      if (!data.match) {
        toast.error(
          "Face verification failed — Your face was not recognized. Try again with better lighting, facing the camera."
        );
        await supabase.storage.from("face-photos").remove([filename]);
        setVerifying(null);
        return;
      }

      const similarity = Number(data.similarity ?? 0);
      // Keep at least threshold when API said match (avoids float/rounding edge cases vs RLS >= 0.35)
      const similarityScore = data.match ? Math.max(similarity, 0.35) : similarity;

      if (classroomExpectsWifi(event.classroom)) {
        toast.error(`Wi‑Fi verification — ${WEB_ATTENDANCE_WIFI_BLOCKED}`);
        await supabase.storage.from("face-photos").remove([filename]);
        setVerifying(null);
        return;
      }

      const { error: dbErr } = await supabase.from("attendance_records").insert({
        student_id: profile.id,
        event_id: event.id,
        photo_path: filename,
        similarity_score: similarityScore,
        verified: true,
      });

      if (dbErr) {
        if (dbErr.code === "23505") {
          toast.info(
            "Attendance is already recorded for this class (present or marked absent by your instructor)."
          );
        } else {
          const msg = dbErr.message ?? "";
          const looksLikeWifi = /wi-?fi|ssid|bssid/i.test(msg);
          toast.error(
            looksLikeWifi
              ? `Wi‑Fi verification failed — ${msg}`
              : `Could not save attendance — ${msg}`
          );
        }
        setVerifying(null);
        return;
      }

      toast.success("Attendance marked!");
      await fetchAttendance();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setVerifying(null);
    }
  }

  if (loading) {
    return (
      <div className="py-4">
        <span className="sr-only">Loading attendance</span>
        <AttendanceMarkerListSkeleton />
      </div>
    );
  }

  if (!faceRegistered) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="py-4">
          <p className="text-sm text-yellow-800">
            <strong>Face not registered.</strong> Go to the{" "}
            <strong>Face Registration</strong> page to register your face before marking
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
          Mark attendance within {ATTENDANCE_WINDOW_MINUTES} minutes after class start
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
            const present = isStudentPresent(att);
            const profAbsent = isProfessorMarkedAbsent(att);

            return (
              <Card key={event.id} className="relative">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{event.title}</CardTitle>
                    {present ? (
                      <Badge className="bg-accent/15 text-accent-foreground border-accent/30 gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Present
                      </Badge>
                    ) : profAbsent ? (
                      <Badge
                        variant="outline"
                        className="border-destructive/40 bg-destructive/10 text-destructive gap-1"
                      >
                        <XCircle className="h-3 w-3" /> Absent (instructor)
                      </Badge>
                    ) : inWindow ? (
                      <Badge className="bg-primary/10 text-primary border-primary/30 animate-pulse">
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
                  {present ? (
                    <div className="pt-2 text-xs text-accent-foreground">
                      Marked at {format(new Date(att!.marked_at), "h:mm a")}
                    </div>
                  ) : profAbsent ? (
                    <p className="pt-2 text-xs text-destructive">
                      Your instructor marked you absent. You cannot submit attendance for this class
                      here. Contact them if this is a mistake.
                    </p>
                  ) : verifying === event.id ? (
                    <div className="flex items-center gap-2 pt-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Verifying face…
                    </div>
                  ) : captureFor === event.id && camStream ? (
                    <div className="pt-2">
                      <WebcamCapture
                        stream={camStream}
                        onCapture={(blob) => handleCapture(event, blob)}
                        onClose={killCamStream}
                        buttonLabel="Take attendance photo"
                      />
                    </div>
                  ) : inWindow ? (
                    classroomExpectsWifi(event.classroom) ? (
                      <p className="pt-2 text-xs text-amber-800 dark:text-amber-200">
                        This room requires Wi‑Fi verification with your face. Use The Nucleus mobile app
                        on the class network — web cannot read your Wi‑Fi network.
                      </p>
                    ) : (
                      <Button
                        size="sm"
                        className="mt-2 gap-1.5"
                        onClick={() => openCameraFor(event.id)}
                      >
                        <Camera className="h-4 w-4" /> Mark Attendance
                      </Button>
                    )
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
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [dayFilter, setDayFilter] = useState("");

  const pastEvents = events.filter(
    (e) => new Date(e.event_date) <= new Date() && !isEventToday(e.event_date)
  );

  if (pastEvents.length === 0) return null;

  const sortedPast = [...pastEvents].sort(
    (a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
  );

  const subjectOptions = useMemo(
    () => uniqueAttendanceSubjectLabels(sortedPast),
    [sortedPast]
  );

  const filteredPast = sortedPast.filter((event) => {
    const day = format(new Date(event.event_date), "yyyy-MM-dd");

    if (!eventMatchesAttendanceSubjectFilter(event, subjectFilter)) return false;
    if (dayFilter && day !== dayFilter) return false;
    return true;
  });

  /** Overall rate uses every past class day, not the active subject/date filters. */
  const overallPastTotal = sortedPast.length;
  const overallPastAttended = sortedPast.filter((e) =>
    isStudentPresent(attendanceMap[e.id])
  ).length;
  const subjectSummary = useMemo(() => {
    const bucket = new Map<string, { total: number; attended: number }>();

    for (const event of sortedPast) {
      for (const subject of attendanceSubjectLabelsForEvent(event)) {
        const row = bucket.get(subject) ?? { total: 0, attended: 0 };
        row.total += 1;
        if (isStudentPresent(attendanceMap[event.id])) row.attended += 1;
        bucket.set(subject, row);
      }
    }

    return Array.from(bucket.entries())
      .map(([subject, stats]) => ({
        subject,
        total: stats.total,
        attended: stats.attended,
        percentage:
          stats.total > 0 ? Math.round((stats.attended / stats.total) * 100) : 0,
      }))
      .sort((a, b) => a.subject.localeCompare(b.subject));
  }, [sortedPast, attendanceMap]);

  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-semibold tracking-tight">Attendance History</h3>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-3.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Overall Attendance</p>
            <span className="text-sm font-semibold text-primary">
              {overallPastTotal > 0
                ? Math.round((overallPastAttended / overallPastTotal) * 100)
                : 0}
              %
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {overallPastAttended}/{overallPastTotal} classes attended
          </p>
          <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary"
              style={{
                width: `${overallPastTotal > 0 ? Math.round((overallPastAttended / overallPastTotal) * 100) : 0}%`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-base font-semibold text-foreground">Subject Summary</h4>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {subjectSummary.map((item) => (
            <div key={item.subject} className="rounded-lg border bg-card p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground truncate">{item.subject}</p>
                <span className="text-sm font-semibold text-primary">{item.percentage}%</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {item.attended}/{item.total} classes attended
              </p>
              <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="h-4 w-4" />
          Filters
        </div>
        <select
          className="h-9 min-w-[180px] rounded-md border border-input bg-background px-3 text-sm"
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
        >
          <option value="all">All subjects</option>
          {subjectOptions.map((subject) => (
            <option key={subject} value={subject}>
              {subject}
            </option>
          ))}
        </select>
        <DatePicker
          value={dayFilter}
          onChange={setDayFilter}
          placeholder="Pick date"
        />
        {(subjectFilter !== "all" || dayFilter) && (
          <button
            onClick={() => {
              setSubjectFilter("all");
              setDayFilter("");
            }}
            className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>

      <div className="space-y-2">
        {filteredPast.slice(0, 30).map((event) => {
          const att = attendanceMap[event.id];
          const pastPresent = isStudentPresent(att);
          const pastProfAbsent = isProfessorMarkedAbsent(att);
          return (
            <div
              key={event.id}
              className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-base"
            >
              {pastPresent ? (
                <CheckCircle2 className="h-4 w-4 text-accent-foreground shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive shrink-0" />
              )}
              <span className="truncate flex-1">{event.title}</span>
              <span className="text-sm text-muted-foreground shrink-0">
                {decodeCalendarRequestSubjects(event.subject).join(", ") || "—"}
              </span>
              <span className="text-sm text-muted-foreground shrink-0">
                {format(new Date(event.event_date), "MMM d, yyyy")}
              </span>
              <span
                className={`text-sm font-medium shrink-0 ${pastPresent ? "text-accent-foreground" : "text-destructive"}`}
              >
                {pastPresent
                  ? "Present"
                  : pastProfAbsent
                    ? "Absent (instructor)"
                    : "Absent"}
              </span>
            </div>
          );
        })}
        {filteredPast.length === 0 && (
          <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            No attendance history for selected filters.
          </div>
        )}
      </div>
    </div>
  );
}
