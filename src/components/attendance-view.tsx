"use client";

import { useCallback, useEffect, useState } from "react";
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
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Users,
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
  totalStudents: number;
}

export function AttendanceView({ profile }: Props) {
  const supabase = createClient();
  const [data, setData] = useState<EventAttendanceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const { data: events } = await supabase
      .from("calendar_requests")
      .select(
        "*, student_group:student_groups(*), classroom:classrooms(*)"
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

    const groupIds = [...new Set(events.map((e) => e.student_group_id))];
    const { data: members } = await supabase
      .from("student_group_members")
      .select("group_id")
      .in("group_id", groupIds);

    const memberCounts: Record<string, number> = {};
    for (const m of members ?? []) {
      memberCounts[m.group_id] = (memberCounts[m.group_id] || 0) + 1;
    }

    const infos: EventAttendanceInfo[] = events.map((e) => ({
      event: e,
      records: recordsByEvent[e.id] ?? [],
      totalStudents: memberCounts[e.student_group_id] || 0,
    }));

    setData(infos);
    setLoading(false);
  }, [profile.id, profile.email, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
    <div className="space-y-3">
      {data.map(({ event, records, totalStudents }) => {
        const isExpanded = expanded === event.id;
        const attendedCount = records.length;
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
                  <CardTitle className="text-sm font-medium truncate">
                    {event.title}
                  </CardTitle>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {format(new Date(event.event_date), "MMM d, yyyy")}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={
                    pct >= 75
                      ? "bg-green-50 text-green-700 border-green-200"
                      : pct >= 50
                      ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  }
                >
                  {attendedCount}/{totalStudents} ({pct}%)
                </Badge>
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {event.start_time.slice(0, 5)} – {event.end_time.slice(0, 5)}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {event.classroom?.name ?? "—"}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {event.student_group?.name ?? "—"}
                </span>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0 pb-3 px-4">
                <div className="border-t pt-3 space-y-1">
                  {records.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No students marked attendance.
                    </p>
                  ) : (
                    records
                      .sort((a, b) =>
                        (a.student?.full_name ?? "").localeCompare(
                          b.student?.full_name ?? ""
                        )
                      )
                      .map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between text-sm py-1"
                        >
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                            <span>{r.student?.full_name ?? r.student_id}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>
                              {format(new Date(r.marked_at), "h:mm a")}
                            </span>
                            <span>
                              {(r.similarity_score * 100).toFixed(0)}% match
                            </span>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
