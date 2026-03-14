"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CalendarRequest, Classroom } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import {
  format,
  addDays,
  startOfWeek,
  endOfWeek,
  startOfToday,
  isSameDay,
} from "date-fns";

const HOUR_START = 8;
const HOUR_END = 21;
const HOUR_HEIGHT = 60;

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

interface StudentCalendarProps {
  studentGroupIds: string[];
}

export function StudentCalendar({ studentGroupIds }: StudentCalendarProps) {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [bookings, setBookings] = useState<CalendarRequest[]>([]);
  const [weekStart, setWeekStart] = useState(
    startOfWeek(startOfToday(), { weekStartsOn: 1 })
  );
  const [loading, setLoading] = useState(true);

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from(
    { length: HOUR_END - HOUR_START },
    (_, i) => HOUR_START + i
  );

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
    if (studentGroupIds.length === 0) return;
    const supabase = createClient();
    setLoading(true);

    const wsStr = format(weekStart, "yyyy-MM-dd");
    const weStr = format(
      endOfWeek(weekStart, { weekStartsOn: 1 }),
      "yyyy-MM-dd"
    );

    supabase
      .from("calendar_requests")
      .select(
        "*, professor:profiles!calendar_requests_professor_id_fkey(*), student_group:student_groups(*), classroom:classrooms(*)"
      )
      .eq("status", "approved")
      .in("student_group_id", studentGroupIds)
      .gte("event_date", wsStr)
      .lte("event_date", weStr)
      .order("start_time", { ascending: true })
      .then(({ data }) => {
        if (data) setBookings(data);
        setLoading(false);
      });
  }, [weekStart, studentGroupIds]);

  function getEventsForDay(day: Date): CalendarRequest[] {
    return bookings.filter((b) => b.event_date === format(day, "yyyy-MM-dd"));
  }

  function getEventStyle(event: CalendarRequest) {
    const startMins = timeToMinutes(event.start_time);
    const endMins = timeToMinutes(event.end_time);
    const topOffset = startMins - HOUR_START * 60;
    const duration = endMins - startMins;
    const top = (topOffset / 60) * HOUR_HEIGHT;
    const height = Math.max((duration / 60) * HOUR_HEIGHT, 20);
    return { top, height };
  }

  const today = startOfToday();
  const isThisWeek = isSameDay(
    weekStart,
    startOfWeek(today, { weekStartsOn: 1 })
  );

  const eventColors = [
    "bg-blue-100 border-blue-400 text-blue-800",
    "bg-purple-100 border-purple-400 text-purple-800",
    "bg-teal-100 border-teal-400 text-teal-800",
    "bg-orange-100 border-orange-400 text-orange-800",
    "bg-pink-100 border-pink-400 text-pink-800",
  ];

  function getColorForClassroom(classroomId: string): string {
    const idx = classrooms.findIndex((c) => c.id === classroomId);
    return eventColors[idx % eventColors.length];
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setWeekStart((d) => addDays(d, -7))
            }
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setWeekStart((d) => addDays(d, 7))
            }
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isThisWeek && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setWeekStart(startOfWeek(startOfToday(), { weekStartsOn: 1 }))
              }
            >
              This Week
            </Button>
          )}
          <span className="text-sm font-semibold ml-2">
            {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-pulse text-muted-foreground">
            Loading calendar...
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden select-none">
          {/* Day headers */}
          <div
            className="grid border-b"
            style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}
          >
            <div className="border-r bg-muted/30" />
            {weekDays.map((day) => {
              const isToday_ = isSameDay(day, today);
              return (
                <div
                  key={day.toISOString()}
                  className={`px-2 py-3 text-center border-r last:border-r-0 ${
                    isToday_ ? "bg-primary/5" : "bg-muted/30"
                  }`}
                >
                  <div className="text-[11px] font-medium text-muted-foreground uppercase">
                    {format(day, "EEE")}
                  </div>
                  <div
                    className={`text-lg font-semibold mt-0.5 ${
                      isToday_
                        ? "bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center mx-auto"
                        : ""
                    }`}
                  >
                    {format(day, "d")}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div
            className="grid relative"
            style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}
          >
            <div className="relative border-r">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="relative"
                  style={{ height: HOUR_HEIGHT }}
                >
                  <span className="absolute -top-2.5 right-2 text-[10px] text-muted-foreground">
                    {String(hour).padStart(2, "0")}:00
                  </span>
                </div>
              ))}
            </div>

            {weekDays.map((day) => {
              const dayEvents = getEventsForDay(day);
              const isToday_ = isSameDay(day, today);
              return (
                <div
                  key={day.toISOString()}
                  className={`relative border-r last:border-r-0 ${
                    isToday_ ? "bg-primary/[0.02]" : ""
                  }`}
                  style={{ height: hours.length * HOUR_HEIGHT }}
                >
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="absolute left-0 right-0 border-t border-dashed border-muted"
                      style={{
                        top: (hour - HOUR_START) * HOUR_HEIGHT,
                        height: HOUR_HEIGHT,
                      }}
                    >
                      <div
                        className="absolute left-0 right-0 border-t border-dotted border-muted/50"
                        style={{ top: HOUR_HEIGHT / 2 }}
                      />
                    </div>
                  ))}

                  {dayEvents.map((event) => {
                    const { top, height } = getEventStyle(event);
                    const colorClass = getColorForClassroom(event.classroom_id);
                    return (
                      <div
                        key={event.id}
                        className={`absolute left-0.5 right-0.5 rounded px-1.5 py-0.5 border-l-[3px] overflow-hidden z-10 ${colorClass}`}
                        style={{ top, height }}
                        title={`${event.title}\n${event.start_time.slice(0, 5)}–${event.end_time.slice(0, 5)}\n${event.classroom?.name ?? ""}\nProf. ${event.professor?.full_name ?? ""}`}
                      >
                        <div className="text-[10px] font-semibold leading-tight truncate">
                          {event.title}
                        </div>
                        <div className="text-[9px] leading-tight truncate opacity-80">
                          {event.classroom?.name}
                        </div>
                        {height >= 40 && (
                          <div className="text-[9px] leading-tight truncate opacity-70">
                            {event.start_time.slice(0, 5)}–
                            {event.end_time.slice(0, 5)}
                          </div>
                        )}
                        {height >= 56 && (
                          <div className="text-[9px] leading-tight truncate opacity-70">
                            Prof. {event.professor?.full_name}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {isToday_ && <CurrentTimeLine />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {bookings.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-muted-foreground font-medium">Classrooms:</span>
          {classrooms
            .filter((c) => bookings.some((b) => b.classroom_id === c.id))
            .map((c) => {
              const colorClass = getColorForClassroom(c.id);
              const bgColor = colorClass.split(" ")[0];
              const textColor = colorClass.split(" ")[2];
              return (
                <span
                  key={c.id}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${bgColor} ${textColor}`}
                >
                  {c.name}
                </span>
              );
            })}
        </div>
      )}
    </div>
  );
}

function CurrentTimeLine() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const minutes = now.getHours() * 60 + now.getMinutes();
  const offset = minutes - HOUR_START * 60;
  if (offset < 0 || offset > (HOUR_END - HOUR_START) * 60) return null;

  const top = (offset / 60) * HOUR_HEIGHT;

  return (
    <div
      className="absolute left-0 right-0 z-30 pointer-events-none"
      style={{ top }}
    >
      <div className="relative flex items-center">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1 shadow-sm" />
        <div className="flex-1 border-t-2 border-red-500" />
      </div>
    </div>
  );
}
