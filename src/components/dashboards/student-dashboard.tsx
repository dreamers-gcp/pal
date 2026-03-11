"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, CalendarRequest } from "@/lib/types";
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
  Clock,
  GraduationCap,
  MapPin,
  User,
} from "lucide-react";
import { format, isBefore, startOfToday } from "date-fns";

export function StudentDashboard({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const [events, setEvents] = useState<CalendarRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  async function fetchEvents() {
    const { data } = await supabase
      .from("calendar_requests")
      .select(
        "*, professor:profiles!calendar_requests_professor_id_fkey(*), student_group:student_groups(*), classroom:classrooms(*)"
      )
      .eq("status", "approved")
      .order("event_date", { ascending: true });

    if (data) setEvents(data);
    setLoading(false);
  }

  const today = startOfToday();
  const upcoming = events.filter(
    (e) => !isBefore(new Date(e.event_date), today)
  );
  const past = events.filter((e) => isBefore(new Date(e.event_date), today));

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Student Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome, {profile.full_name}.
          {profile.student_group
            ? ` You belong to group ${profile.student_group}.`
            : " Your group hasn't been assigned yet — contact your admin."}
        </p>
      </div>

      {!profile.student_group && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="py-4">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Your student group hasn&apos;t been assigned
              yet. Once an admin assigns you to a group, your upcoming events
              will appear here. Contact your admin with your email:{" "}
              <strong>{profile.email}</strong>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Events */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Upcoming Events ({upcoming.length})
        </h2>
        {upcoming.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No upcoming events scheduled for your group.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((event) => (
              <Card
                key={event.id}
                className="relative overflow-hidden border-l-4 border-l-green-500"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{event.title}</CardTitle>
                    <Badge className="bg-green-100 text-green-800" variant="outline">
                      Upcoming
                    </Badge>
                  </div>
                  {event.description && (
                    <CardDescription>{event.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="h-4 w-4" />
                    <span>
                      {format(new Date(event.event_date), "EEEE, MMM d, yyyy")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      {event.start_time.slice(0, 5)} -{" "}
                      {event.end_time.slice(0, 5)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{event.classroom?.name ?? "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>Prof. {event.professor?.full_name ?? "—"}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Past Events */}
      {past.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 text-muted-foreground">
            Past Events ({past.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {past.map((event) => (
              <Card key={event.id} className="opacity-60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{event.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="h-4 w-4" />
                    <span>
                      {format(new Date(event.event_date), "MMM d, yyyy")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      {event.start_time.slice(0, 5)} -{" "}
                      {event.end_time.slice(0, 5)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{event.classroom?.name ?? "—"}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
