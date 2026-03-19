"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CalendarRequest, Classroom } from "@/lib/types";
import { RequestCalendar } from "@/components/request-calendar";

interface StudentCalendarProps {
  studentGroupIds: string[];
}

export function StudentCalendar({ studentGroupIds }: StudentCalendarProps) {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [bookings, setBookings] = useState<CalendarRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("classrooms")
      .select("*")
      .order("name")
      .then(({ data }) => {
        if (data) setClassrooms(data);
      });
  }, []);

  useEffect(() => {
    if (studentGroupIds.length === 0) {
      setBookings([]);
      setLoading(false);
      return;
    }
    const supabase = createClient();
    setLoading(true);
    async function fetchBookings() {
      const { data: direct } = await supabase
        .from("calendar_requests")
        .select(
          "*, professor:profiles!calendar_requests_professor_id_fkey(*), student_group:student_groups(*), classroom:classrooms(*)"
        )
        .eq("status", "approved")
        .in("student_group_id", studentGroupIds)
        .order("event_date", { ascending: true })
        .order("start_time", { ascending: true });

      const { data: links } = await supabase
        .from("calendar_request_groups")
        .select("calendar_request_id")
        .in("student_group_id", studentGroupIds);

      const directIds = new Set((direct ?? []).map((e) => e.id));
      const extraIds = (links ?? [])
        .map((l) => l.calendar_request_id)
        .filter((id) => !directIds.has(id));

      let all = direct ?? [];
      if (extraIds.length > 0) {
        const { data: extra } = await supabase
          .from("calendar_requests")
          .select(
            "*, professor:profiles!calendar_requests_professor_id_fkey(*), student_group:student_groups(*), classroom:classrooms(*)"
          )
          .eq("status", "approved")
          .in("id", extraIds)
          .order("event_date", { ascending: true })
          .order("start_time", { ascending: true });
        if (extra) all = [...all, ...extra];
      }

      setBookings(all);
      setLoading(false);
    }

    fetchBookings();
  }, [studentGroupIds]);

  return (
    <div className="space-y-3">
      <RequestCalendar
        bookings={bookings}
        classrooms={classrooms}
        loading={loading}
        colorBy="classroom"
      />
    </div>
  );
}
