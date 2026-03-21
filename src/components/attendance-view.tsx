"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  Camera,
  ChevronDown,
  CheckCircle2,
  Clock,
  Filter,
  Loader2,
  MapPin,
  Upload,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import type { CalendarRequest, Profile, AttendanceRecord } from "@/lib/types";

interface Props {
  profile: Profile;
}

interface EventAttendanceInfo {
  event: CalendarRequest;
  records: (AttendanceRecord & { student?: Profile })[];
  enrolledStudents: Profile[];
}

type CalendarRequestWithGroups = CalendarRequest & {
  student_groups?: { student_group?: { id: string } | null }[] | null;
};

function groupIdsForCalendarEvent(e: CalendarRequestWithGroups): string[] {
  const ids = new Set<string>();
  if (e.student_group_id) ids.add(e.student_group_id);
  for (const row of e.student_groups ?? []) {
    const id = row?.student_group?.id;
    if (id) ids.add(id);
  }
  return Array.from(ids);
}

interface ClassPhotoPreview {
  face_count: number;
  threshold: number;
  matches: {
    student_id: string;
    face_index: number;
    similarity: number;
    student_name: string;
  }[];
  unmatched_face_indices: number[];
  enrolled_count: number;
  students_with_face: number;
  students_missing_face: { student_id: string; student_name: string }[];
}

export function AttendanceView({ profile }: Props) {
  const supabase = createClient();
  const [data, setData] = useState<EventAttendanceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [overridingKey, setOverridingKey] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState<
    "all" | "today" | "upcoming" | "past" | "low-attendance"
  >("all");
  const [subjectFilter, setSubjectFilter] = useState("all");

  const [classPhotoEventId, setClassPhotoEventId] = useState<string | null>(
    null
  );
  const [classPhotoFile, setClassPhotoFile] = useState<File | null>(null);
  const [classPhotoPreview, setClassPhotoPreview] =
    useState<ClassPhotoPreview | null>(null);
  const [classPhotoLoading, setClassPhotoLoading] = useState(false);
  const [classPhotoApplying, setClassPhotoApplying] = useState(false);
  const [classPhotoError, setClassPhotoError] = useState<string | null>(null);
  /** Live camera for class photo (getUserMedia — works on desktop; file+capture often opens picker). */
  const [cameraEvent, setCameraEvent] = useState<CalendarRequest | null>(null);
  const [cameraStreamReady, setCameraStreamReady] = useState(false);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const fetchData = useCallback(async () => {
    const { data: events } = await supabase
      .from("calendar_requests")
      .select(
        "*, student_group:student_groups(*), classroom:classrooms(*), student_groups:calendar_request_groups(student_group:student_groups(id))"
      )
      .eq("status", "approved")
      .or(`professor_id.eq.${profile.id},professor_email.eq.${profile.email}`)
      .order("event_date", { ascending: false })
      .limit(50);

    if (!events || events.length === 0) {
      setData([]);
      setLoading(false);
      return;
    }

    const eventIds = events.map((e) => e.id);
    const { data: records } = await supabase
      .from("attendance_records")
      .select("*, student:profiles!attendance_records_student_id_fkey(*)")
      .in("event_id", eventIds);

    const recordsByEvent: Record<string, (AttendanceRecord & { student?: Profile })[]> = {};
    for (const r of records ?? []) {
      if (!recordsByEvent[r.event_id]) recordsByEvent[r.event_id] = [];
      recordsByEvent[r.event_id].push(r);
    }

    const allGroupIds = [
      ...new Set(
        events.flatMap((e) =>
          groupIdsForCalendarEvent(e as CalendarRequestWithGroups)
        )
      ),
    ];

    type MemberRow = { group_id: string; student?: Profile | null };
    let members: MemberRow[] = [];
    if (allGroupIds.length > 0) {
      const { data: m } = await supabase
        .from("student_group_members")
        .select("group_id, student:profiles!student_group_members_student_id_fkey(*)")
        .in("group_id", allGroupIds);
      members = (m ?? []) as unknown as MemberRow[];
    }

    function enrolledForEvent(ev: CalendarRequestWithGroups): Profile[] {
      const gids = new Set(groupIdsForCalendarEvent(ev));
      const seen = new Set<string>();
      const out: Profile[] = [];
      for (const row of members) {
        if (!gids.has(row.group_id)) continue;
        const student = row.student;
        if (!student || seen.has(student.id)) continue;
        seen.add(student.id);
        out.push(student);
      }
      return out;
    }

    const infos: EventAttendanceInfo[] = events.map((e) => ({
      event: e as CalendarRequest,
      records: recordsByEvent[e.id] ?? [],
      enrolledStudents: enrolledForEvent(e as CalendarRequestWithGroups),
    }));

    setData(infos);
    setLoading(false);
  }, [profile.id, profile.email, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setClassPhotoFile(null);
    setClassPhotoPreview(null);
    setClassPhotoError(null);
    setClassPhotoEventId(null);
    setCameraEvent(null);
  }, [expanded]);

  useEffect(() => {
    if (!cameraEvent) {
      setCameraStreamReady(false);
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
      return;
    }

    setCameraStreamReady(false);
    let cancelled = false;

    async function start() {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setClassPhotoError(
          "Camera is not available in this browser. Use Upload photo instead."
        );
        setCameraEvent(null);
        return;
      }

      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        cameraStreamRef.current = stream;
        const el = cameraVideoRef.current;
        if (el) {
          el.srcObject = stream;
          await el.play().catch(() => {});
        }
      } catch {
        setClassPhotoError(
          "Could not open camera. Allow permission or use Upload photo."
        );
        setCameraEvent(null);
      }
    }

    void start();

    return () => {
      cancelled = true;
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    };
  }, [cameraEvent]);

  function captureClassPhotoFromCamera() {
    const event = cameraEvent;
    const video = cameraVideoRef.current;
    if (!event || !video || video.videoWidth < 2) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `class-photo-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        setCameraEvent(null);
        void onClassPhotoSelected(event, file);
      },
      "image/jpeg",
      0.92
    );
  }

  async function setStudentAttendance(
    event: CalendarRequest,
    student: Profile,
    present: boolean
  ) {
    const key = `${event.id}:${student.id}`;
    setOverridingKey(key);

    try {
      if (present) {
        const { error } = await supabase
          .from("attendance_records")
          .upsert(
            {
              student_id: student.id,
              event_id: event.id,
              photo_path: `manual-override/${event.id}/${student.id}`,
              similarity_score: 1,
              verified: true,
              marked_at: new Date().toISOString(),
            },
            { onConflict: "student_id,event_id" }
          );
        if (error) {
          throw new Error(error.message);
        }
      } else {
        const { error } = await supabase
          .from("attendance_records")
          .delete()
          .eq("event_id", event.id)
          .eq("student_id", student.id);
        if (error) {
          throw new Error(error.message);
        }
      }

      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update attendance";
      console.error(msg);
    } finally {
      setOverridingKey(null);
    }
  }

  async function runClassPhotoScan(
    event: CalendarRequest,
    file: File,
    apply: boolean
  ) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("eventId", event.id);
    if (apply) fd.append("apply", "true");

    const res = await fetch("/api/face/class-photo", { method: "POST", body: fd });
    const json = (await res.json()) as Record<string, unknown>;

    if (!res.ok) {
      const err =
        typeof json.error === "string"
          ? json.error
          : "Could not process class photo";
      throw new Error(err);
    }

    return json as Record<string, unknown>;
  }

  async function onClassPhotoSelected(
    event: CalendarRequest,
    file: File | undefined
  ) {
    if (!file) return;
    setClassPhotoEventId(event.id);
    setClassPhotoFile(file);
    setClassPhotoPreview(null);
    setClassPhotoError(null);
    setClassPhotoLoading(true);
    try {
      const json = await runClassPhotoScan(event, file, false);
      if (json.preview) {
        setClassPhotoPreview({
          face_count: Number(json.face_count),
          threshold: Number(json.threshold),
          matches: (json.matches ?? []) as ClassPhotoPreview["matches"],
          unmatched_face_indices: (json.unmatched_face_indices ?? []) as number[],
          enrolled_count: Number(json.enrolled_count),
          students_with_face: Number(json.students_with_face),
          students_missing_face: (json.students_missing_face ??
            []) as ClassPhotoPreview["students_missing_face"],
        });
      }
    } catch (e: unknown) {
      setClassPhotoError(
        e instanceof Error ? e.message : "Failed to scan class photo"
      );
    } finally {
      setClassPhotoLoading(false);
    }
  }

  async function applyClassPhotoAttendance(event: CalendarRequest) {
    if (!classPhotoFile || classPhotoEventId !== event.id || !classPhotoPreview) {
      return;
    }
    setClassPhotoApplying(true);
    setClassPhotoError(null);
    try {
      const json = await runClassPhotoScan(event, classPhotoFile, true);
      if (json.applied === true) {
        setClassPhotoPreview(null);
        setClassPhotoFile(null);
        setClassPhotoEventId(null);
        if (
          Array.isArray(json.attendance_errors) &&
          json.attendance_errors.length > 0
        ) {
          setClassPhotoError(
            `Some rows failed: ${(json.attendance_errors as string[]).join("; ")}`
          );
        }
        await fetchData();
      }
    } catch (e: unknown) {
      setClassPhotoError(
        e instanceof Error ? e.message : "Failed to apply attendance"
      );
    } finally {
      setClassPhotoApplying(false);
    }
  }

  const subjectOptions = useMemo(() => {
    return Array.from(
      new Set(data.map((d) => d.event.student_group?.name ?? "Unknown subject"))
    ).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const filteredData = useMemo(() => {
    const now = new Date();
    const today = format(now, "yyyy-MM-dd");

    return data.filter(({ event, records, enrolledStudents }) => {
      const eventDate = event.event_date;
      const subject = event.student_group?.name ?? "Unknown subject";
      const total = enrolledStudents.length;
      const attended = enrolledStudents.filter((s) =>
        records.some((r) => r.student_id === s.id)
      ).length;
      const pct = total > 0 ? Math.round((attended / total) * 100) : 0;

      if (subjectFilter !== "all" && subject !== subjectFilter) return false;

      if (quickFilter === "today") return eventDate === today;
      if (quickFilter === "upcoming") return eventDate > today;
      if (quickFilter === "past") return eventDate < today;
      if (quickFilter === "low-attendance") return total > 0 && pct < 75;

      return true;
    });
  }, [data, quickFilter, subjectFilter]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No class events found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground mr-1" />
          {[
            { id: "all", label: "All" },
            { id: "today", label: "Today" },
            { id: "upcoming", label: "Upcoming" },
            { id: "past", label: "Past" },
            { id: "low-attendance", label: "Low attendance" },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setQuickFilter(f.id as typeof quickFilter)}
              className={`rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                quickFilter === f.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}

          <select
            className="ml-auto h-9 min-w-[180px] rounded-md border border-input bg-background px-3 text-sm"
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
        </div>
      </div>

      {filteredData.map(({ event, records, enrolledStudents }) => {
        const isExpanded = expanded === event.id;
        const recordByStudent = new Map(records.map((r) => [r.student_id, r]));
        const attendedCount = enrolledStudents.filter((s) => recordByStudent.has(s.id)).length;
        const totalStudents = enrolledStudents.length;
        const pct = totalStudents > 0 ? Math.round((attendedCount / totalStudents) * 100) : 0;

        return (
          <Card
            key={event.id}
            className="cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => setExpanded(isExpanded ? null : event.id)}
          >
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <CardTitle className="text-base font-semibold truncate">
                    {event.title}
                  </CardTitle>
                  <span className="text-sm text-muted-foreground shrink-0">
                    {format(new Date(event.event_date), "MMM d, yyyy")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      pct >= 75
                        ? "bg-accent/15 text-accent-foreground border-accent/30"
                        : pct >= 50
                        ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                        : "bg-destructive/10 text-destructive border-destructive/30"
                    }
                  >
                    {attendedCount}/{totalStudents} ({pct}%)
                  </Badge>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </div>
              <div className="flex gap-4 text-sm text-muted-foreground mt-1.5">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {event.start_time.slice(0, 5)} – {event.end_time.slice(0, 5)}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {event.classroom?.name ?? "—"}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {event.student_group?.name ?? "—"}
                </span>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0 pb-3 px-4">
                <div className="border-t pt-3 space-y-1">
                  {enrolledStudents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No enrolled students found for this class.</p>
                  ) : (
                    [...enrolledStudents]
                      .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""))
                      .map((student) => {
                        const record = recordByStudent.get(student.id);
                        const present = Boolean(record);
                        const key = `${event.id}:${student.id}`;
                        const busy = overridingKey === key;
                        return (
                          <div
                            key={student.id}
                          className="flex items-center justify-between gap-3 text-base py-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="min-w-0 flex items-center gap-2">
                              {present ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-accent-foreground shrink-0" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                              )}
                              <span className="truncate">{student.full_name || student.email}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge
                                variant="outline"
                                className={
                                  present
                                    ? "bg-accent/15 text-accent-foreground border-accent/30"
                                    : "bg-destructive/10 text-destructive border-destructive/30"
                                }
                              >
                                {present ? "Present" : "Absent"}
                              </Badge>
                              {present ? (
                                <button
                                  className="text-sm underline text-muted-foreground hover:text-foreground disabled:opacity-50"
                                  disabled={busy}
                                  onClick={() => setStudentAttendance(event, student, false)}
                                >
                                  Mark Absent
                                </button>
                              ) : (
                                <button
                                  className="text-sm underline text-primary hover:text-primary/80 disabled:opacity-50"
                                  disabled={busy}
                                  onClick={() => setStudentAttendance(event, student, true)}
                                >
                                  Mark Present
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })
                  )}
                </div>

                <div
                  className="border-t mt-3 pt-3 space-y-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    Class photo attendance
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Upload a file, or use Capture photo to open your device camera
                    (browser will ask for permission). We match faces to enrolled
                    students who registered their face (similarity ≥{" "}
                    {classPhotoPreview?.threshold ?? 0.35}).
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id={`class-photo-upload-${event.id}`}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      void onClassPhotoSelected(event, f);
                      e.target.value = "";
                    }}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="text-sm rounded-md border border-input bg-background px-3 py-1.5 hover:bg-muted/60 disabled:opacity-50 inline-flex items-center gap-1.5"
                      disabled={classPhotoLoading && classPhotoEventId === event.id}
                      onClick={() =>
                        document
                          .getElementById(`class-photo-upload-${event.id}`)
                          ?.click()
                      }
                    >
                      {classPhotoLoading && classPhotoEventId === event.id ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Scanning…
                        </span>
                      ) : (
                        <>
                          <Upload className="h-3.5 w-3.5" />
                          Upload photo
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="text-sm rounded-md border border-input bg-background px-3 py-1.5 hover:bg-muted/60 disabled:opacity-50 inline-flex items-center gap-1.5"
                      disabled={classPhotoLoading && classPhotoEventId === event.id}
                      onClick={() => {
                        setClassPhotoError(null);
                        setCameraEvent(event);
                      }}
                    >
                      <Camera className="h-3.5 w-3.5" />
                      Capture photo
                    </button>
                  </div>
                  {classPhotoError && classPhotoEventId === event.id && (
                    <p className="text-sm text-destructive">{classPhotoError}</p>
                  )}
                  {classPhotoPreview &&
                    classPhotoEventId === event.id &&
                    expanded === event.id && (
                      <div className="rounded-md border bg-muted/20 p-3 space-y-2 text-sm">
                        <p>
                          Detected <strong>{classPhotoPreview.face_count}</strong>{" "}
                          face(s). Matched{" "}
                          <strong>{classPhotoPreview.matches.length}</strong>{" "}
                          enrolled student(s) (
                          {classPhotoPreview.students_with_face} with face data
                          / {classPhotoPreview.enrolled_count} enrolled).
                        </p>
                        {classPhotoPreview.unmatched_face_indices.length > 0 && (
                          <p className="text-muted-foreground text-xs">
                            Unmatched face slot(s):{" "}
                            {classPhotoPreview.unmatched_face_indices
                              .map((i) => `#${i + 1}`)
                              .join(", ")}
                          </p>
                        )}
                        {classPhotoPreview.students_missing_face.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            No face registration:{" "}
                            {classPhotoPreview.students_missing_face
                              .map((s) => s.student_name)
                              .join(", ")}
                          </p>
                        )}
                        {classPhotoPreview.matches.length > 0 && (
                          <ul className="list-disc pl-5 space-y-0.5 max-h-40 overflow-y-auto">
                            {classPhotoPreview.matches.map((m) => (
                              <li key={`${m.student_id}-${m.face_index}`}>
                                {m.student_name}{" "}
                                <span className="text-muted-foreground">
                                  (face #{m.face_index + 1},{" "}
                                  {(m.similarity * 100).toFixed(1)}%)
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <button
                          type="button"
                          className="text-sm rounded-md bg-primary text-primary-foreground px-3 py-1.5 hover:bg-primary/90 disabled:opacity-50"
                          disabled={
                            classPhotoApplying ||
                            classPhotoPreview.matches.length === 0
                          }
                          onClick={() => void applyClassPhotoAttendance(event)}
                        >
                          {classPhotoApplying ? (
                            <span className="inline-flex items-center gap-2">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Applying…
                            </span>
                          ) : (
                            "Apply attendance"
                          )}
                        </button>
                      </div>
                    )}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
      {filteredData.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No classes match the selected filters.
          </CardContent>
        </Card>
      )}

      {cameraEvent && (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Capture class photo"
        >
          <div className="relative w-full max-w-lg overflow-hidden rounded-lg border bg-background shadow-xl">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-sm font-medium">Camera</span>
              <button
                type="button"
                className="rounded-md p-1.5 hover:bg-muted"
                aria-label="Close"
                onClick={() => setCameraEvent(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="relative aspect-video w-full bg-black">
              <video
                ref={cameraVideoRef}
                className="h-full w-full object-cover"
                playsInline
                muted
                autoPlay
                onLoadedData={() => setCameraStreamReady(true)}
              />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 border-t p-3">
              <button
                type="button"
                className="text-sm rounded-md border border-input bg-background px-3 py-1.5 hover:bg-muted"
                onClick={() => setCameraEvent(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="text-sm rounded-md bg-primary text-primary-foreground px-3 py-1.5 hover:bg-primary/90 inline-flex items-center gap-1.5 disabled:opacity-50"
                disabled={!cameraStreamReady}
                onClick={() => captureClassPhotoFromCamera()}
              >
                <Camera className="h-3.5 w-3.5" />
                Use photo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
