"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CalendarRequest, Classroom, StudentTask } from "@/lib/types";
import { RequestCalendar } from "@/components/request-calendar";

interface StudentCalendarProps {
  studentGroupIds: string[];
  studentId: string;
}

export function StudentCalendar({
  studentGroupIds,
  studentId,
}: StudentCalendarProps) {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [bookings, setBookings] = useState<CalendarRequest[]>([]);
  const [studentTasks, setStudentTasks] = useState<StudentTask[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(true);

  const fetchStudentTasks = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("student_tasks")
      .select("*")
      .eq("student_id", studentId)
      .order("due_date", { ascending: true, nullsFirst: false });
    setStudentTasks((data ?? []) as StudentTask[]);
  }, [studentId]);

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
    let cancelled = false;
    setLoadingTasks(true);
    fetchStudentTasks().finally(() => {
      if (!cancelled) setLoadingTasks(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchStudentTasks]);

  useEffect(() => {
    const onTasksChanged = () => {
      void fetchStudentTasks();
    };
    window.addEventListener("pal:student-tasks-changed", onTasksChanged);
    return () =>
      window.removeEventListener("pal:student-tasks-changed", onTasksChanged);
  }, [fetchStudentTasks]);

  useEffect(() => {
    if (studentGroupIds.length === 0) {
      setBookings([]);
      setLoadingBookings(false);
      return;
    }
    const supabase = createClient();
    setLoadingBookings(true);
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
      setLoadingBookings(false);
    }

    fetchBookings();
  }, [studentGroupIds]);

  const loading = loadingBookings || loadingTasks;

  return (
    <div className="space-y-3">
      <RequestCalendar
        bookings={bookings}
        studentTasks={studentTasks}
        classrooms={classrooms}
        loading={loading}
        colorBy="classroom"
        showDescription={false}
        showStatus={false}
      />
    </div>
  );
}
