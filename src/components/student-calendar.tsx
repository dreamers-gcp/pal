"use client";

import { useCallback, useEffect, useState } from "react";
import { addMonths, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import type {
  CalendarRequest,
  Classroom,
  FacilityBooking,
  StudentTask,
} from "@/lib/types";
import { RequestCalendar } from "@/components/request-calendar";

interface StudentCalendarProps {
  studentId: string;
}

export function StudentCalendar({ studentId }: StudentCalendarProps) {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [bookings, setBookings] = useState<CalendarRequest[]>([]);
  const [facilityBookings, setFacilityBookings] = useState<FacilityBooking[]>([]);
  const [studentTasks, setStudentTasks] = useState<StudentTask[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [loadingFacility, setLoadingFacility] = useState(true);
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
    function onTasksChanged() {
      void fetchStudentTasks();
    }
    window.addEventListener("pal:student-tasks-changed", onTasksChanged);
    return () =>
      window.removeEventListener("pal:student-tasks-changed", onTasksChanged);
  }, [fetchStudentTasks]);

  /** Same window as professor “All rooms”: campus-wide approved bookings (not limited to the student’s groups). */
  useEffect(() => {
    const supabase = createClient();
    const from = format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd");
    const to = format(endOfMonth(addMonths(new Date(), 5)), "yyyy-MM-dd");

    setLoadingBookings(true);
    setLoadingFacility(true);

    supabase
      .from("calendar_requests")
      .select(
        "*, professor:profiles!calendar_requests_professor_id_fkey(*), student_group:student_groups(*), classroom:classrooms(*), student_groups:calendar_request_groups(student_group:student_groups(*))"
      )
      .eq("status", "approved")
      .gte("event_date", from)
      .lte("event_date", to)
      .order("event_date", { ascending: true })
      .order("start_time", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
          setBookings([]);
        } else {
          const transformed = (data ?? []).map((req: any) => ({
            ...req,
            student_groups:
              req.student_groups?.map((sg: any) => sg.student_group) || [],
          }));
          setBookings(transformed);
        }
        setLoadingBookings(false);
      });

    supabase
      .from("facility_bookings")
      .select("*, requester:profiles!facility_bookings_requester_id_fkey(*)")
      .eq("status", "approved")
      .gte("booking_date", from)
      .lte("booking_date", to)
      .order("booking_date", { ascending: true })
      .order("start_time", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
          setFacilityBookings([]);
        } else {
          setFacilityBookings((data as FacilityBooking[]) ?? []);
        }
        setLoadingFacility(false);
      });
  }, []);

  const loading = loadingBookings || loadingFacility || loadingTasks;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Colored blocks are approved classroom sessions;{" "}
        <span className="font-medium text-teal-700 dark:text-teal-400">teal</span> blocks are
        approved facility bookings (auditorium, halls, rooms). Everyone sees the same occupied
        slots.
      </p>
      <RequestCalendar
        bookings={bookings}
        studentTasks={studentTasks}
        classrooms={classrooms}
        facilityBookings={facilityBookings}
        loading={loading}
        colorBy="classroom"
        showDescription={false}
        showStatus={false}
      />
    </div>
  );
}
