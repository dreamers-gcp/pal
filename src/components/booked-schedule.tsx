"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CalendarRequest, Classroom } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import {
  format,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfToday,
  isSameDay,
  isBefore,
  isToday as isDateToday,
} from "date-fns";

const HOUR_START = 8;
const HOUR_END = 23;
const HOUR_HEIGHT = 60;
const SNAP_MINUTES = 15;
const PX_PER_MINUTE = HOUR_HEIGHT / 60;

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function snapMinutes(mins: number): number {
  return Math.round(mins / SNAP_MINUTES) * SNAP_MINUTES;
}

function clampMinutes(mins: number): number {
  return Math.max(HOUR_START * 60, Math.min(HOUR_END * 60, mins));
}

const STATUS_CARD_COLORS: Record<string, string> = {
  approved: "bg-accent/15 border-accent/40 text-accent-foreground",
  pending: "bg-yellow-100 border-yellow-500 text-yellow-900",
  rejected: "bg-destructive/10 border-destructive/30 text-destructive",
  clarification_needed: "bg-primary/10 border-primary/30 text-primary",
};

const STATUS_DOT: Record<string, string> = {
  approved: "bg-accent",
  pending: "bg-yellow-500",
  rejected: "bg-destructive",
  clarification_needed: "bg-primary",
};

const STATUS_TEXT: Record<string, string> = {
  approved: "text-accent-foreground",
  pending: "text-yellow-700",
  rejected: "text-destructive",
  clarification_needed: "text-primary",
};

export interface SlotClickInfo {
  classroomId: string;
  classroomName: string;
  date: string;
  startTime: string;
  endTime: string;
}

interface BookedScheduleProps {
  onSlotClick?: (info: SlotClickInfo) => void;
  showAllStatuses?: boolean;
  onEventClick?: (event: CalendarRequest) => void;
  refreshKey?: number;
}

export function BookedSchedule({ onSlotClick, showAllStatuses, onEventClick, refreshKey }: BookedScheduleProps) {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [bookings, setBookings] = useState<CalendarRequest[]>([]);
  const [weekStart, setWeekStart] = useState(
    startOfWeek(startOfToday(), { weekStartsOn: 1 })
  );
  const [selectedClassroom, setSelectedClassroom] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from(
    { length: HOUR_END - HOUR_START },
    (_, i) => HOUR_START + i
  );

  useEffect(() => {
    const supabase = createClient();
    supabase.from("classrooms").select("*").order("name").then(({ data }) => {
      if (data) setClassrooms(data);
    });
  }, []);

  useEffect(() => {
    const supabase = createClient();
    setLoading(true);
    const wsStr = format(weekStart, "yyyy-MM-dd");
    const weStr = format(endOfWeek(weekStart, { weekStartsOn: 1 }), "yyyy-MM-dd");

    async function fetchBookings() {
      const baseQuery = supabase
        .from("calendar_requests")
        .select(
          "*, professor:profiles!calendar_requests_professor_id_fkey(*), student_group:student_groups(*), classroom:classrooms(*), student_groups:calendar_request_groups(student_group:student_groups(*))"
        )
        .gte("event_date", wsStr)
        .lte("event_date", weStr)
        .order("start_time", { ascending: true });

      const { data } = showAllStatuses
        ? await baseQuery
        : await baseQuery.eq("status", "approved");

      if (data) {
        // Transform the data to extract student_groups from the junction table
        const transformedData = data.map((req: any) => ({
          ...req,
          student_groups: req.student_groups?.map((sg: any) => sg.student_group) || [],
        }));
        setBookings(transformedData);
      }
      setLoading(false);
    }

    fetchBookings();
  }, [weekStart, showAllStatuses, refreshKey]);

  function getEventsForDay(day: Date): CalendarRequest[] {
    const dayStr = format(day, "yyyy-MM-dd");
    return bookings.filter((b) => {
      if (b.event_date !== dayStr) return false;
      if (selectedClassroom !== "all" && b.classroom_id !== selectedClassroom)
        return false;
      return true;
    });
  }

  function hasConflict(
    date: string,
    classroomId: string,
    startTime: string,
    endTime: string
  ): boolean {
    const startM = timeToMinutes(startTime);
    const endM = timeToMinutes(endTime);

    return bookings.some((b) => {
      if (b.status !== "approved") return false;
      if (b.event_date !== date) return false;
      if (b.classroom_id !== classroomId) return false;
      const bs = timeToMinutes(b.start_time);
      const be = timeToMinutes(b.end_time);
      return startM < be && bs < endM;
    });
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

  function getClassroomForSlot() {
    if (selectedClassroom !== "all") {
      const room = classrooms.find((c) => c.id === selectedClassroom);
      return { roomId: room?.id ?? "", roomName: room?.name ?? "" };
    }
    return { roomId: "", roomName: "" };
  }

  function isSlotInPast(day: Date, endMinutes: number): boolean {
    const now = new Date();
    if (isBefore(day, startOfToday())) return true;
    if (isDateToday(day)) {
      const currentMins = now.getHours() * 60 + now.getMinutes();
      return endMinutes <= currentMins;
    }
    return false;
  }

  const today = startOfToday();
  const isThisWeek = isSameDay(
    weekStart,
    startOfWeek(today, { weekStartsOn: 1 })
  );

  const eventColors = [
    "bg-primary/10 border-primary/30 text-primary",
    "bg-purple-100 border-purple-400 text-purple-800",
    "bg-teal-100 border-teal-400 text-teal-800",
    "bg-orange-100 border-orange-400 text-orange-800",
    "bg-pink-100 border-pink-400 text-pink-800",
    "bg-cyan-100 border-cyan-400 text-cyan-800",
    "bg-amber-100 border-amber-400 text-amber-800",
  ];

  function getColorForClassroom(classroomId: string): string {
    const idx = classrooms.findIndex((c) => c.id === classroomId);
    return eventColors[idx % eventColors.length];
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekStart((d) => subDays(d, 7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart((d) => addDays(d, 7))}>
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

        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <select
            className="flex h-8 rounded-md border border-input bg-transparent px-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={selectedClassroom}
            onChange={(e) => setSelectedClassroom(e.target.value)}
          >
            <option value="all">All Classrooms</option>
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.capacity ? `(${c.capacity})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Legends */}
      <div className="space-y-2 border rounded-lg bg-muted/40 p-3">
        {/* Classroom color legend - only show in professor view, not admin */}
        {!showAllStatuses && selectedClassroom === "all" && bookings.length > 0 && (
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

        {showAllStatuses && (
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-muted-foreground font-medium">Status:</span>
            {(["pending", "approved", "rejected", "clarification_needed"] as const).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className={`inline-block w-2 h-2 rounded-full ${STATUS_DOT[s]}`} />
                <span className="text-muted-foreground capitalize">
                  {s === "clarification_needed" ? "Clarification" : s}
                </span>
              </span>
            ))}
          </div>
        )}

        {onSlotClick && (
          <p className="text-xs text-muted-foreground">
            Click and drag on the calendar to select a time range (snaps to 15-min increments).
            {selectedClassroom === "all" && " Tip: filter by a classroom to prefill it in the booking form."}
          </p>
        )}
      </div>

      {/* Calendar */}
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
            {/* Hour labels */}
            <div className="relative border-r">
              {hours.map((hour) => (
                <div key={hour} className="relative" style={{ height: HOUR_HEIGHT }}>
                  <span className="absolute -top-2.5 right-2 text-[10px] text-muted-foreground">
                    {String(hour).padStart(2, "0")}:00
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              return (
                <DayColumn
                  key={day.toISOString()}
                  day={day}
                  events={getEventsForDay(day)}
                  hours={hours}
                  isToday={isSameDay(day, today)}
                  canDrag={!!onSlotClick}
                  showAllStatuses={showAllStatuses}
                  onEventClick={onEventClick}
                  getColorForClassroom={getColorForClassroom}
                  getEventStyle={getEventStyle}
                  checkPast={(endMins) => isSlotInPast(day, endMins)}
                  checkOverlap={(startMins, endMins) => {
                    const { roomId } = getClassroomForSlot();
                    if (!roomId) return false;
                    return hasConflict(dateStr, roomId, minutesToTime(startMins), minutesToTime(endMins));
                  }}
                  onDragCreate={(startMins, endMins) => {
                    if (!onSlotClick) return;
                    if (isSlotInPast(day, endMins)) return;
                    const { roomId, roomName } = getClassroomForSlot();
                    const startTime = minutesToTime(startMins);
                    const endTime = minutesToTime(endMins);

                    if (roomId && hasConflict(dateStr, roomId, startTime, endTime)) {
                      return;
                    }

                    onSlotClick({
                      classroomId: roomId,
                      classroomName: roomName,
                      date: dateStr,
                      startTime,
                      endTime,
                    });
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Day Column with drag-to-create ──────────────────────────────────

interface DayColumnProps {
  day: Date;
  events: CalendarRequest[];
  hours: number[];
  isToday: boolean;
  canDrag: boolean;
  showAllStatuses?: boolean;
  onEventClick?: (event: CalendarRequest) => void;
  getColorForClassroom: (id: string) => string;
  getEventStyle: (event: CalendarRequest) => { top: number; height: number };
  onDragCreate: (startMins: number, endMins: number) => void;
  checkOverlap: (startMins: number, endMins: number) => boolean;
  checkPast: (endMins: number) => boolean;
}

function DayColumn({
  day,
  events,
  hours,
  isToday,
  canDrag,
  showAllStatuses,
  onEventClick,
  getColorForClassroom,
  getEventStyle,
  onDragCreate,
  checkOverlap,
  checkPast,
}: DayColumnProps) {
  const columnRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{
    startMins: number;
    currentMins: number;
  } | null>(null);
  const isDragging = useRef(false);
  const dragStartRef = useRef(0);
  const onDragCreateRef = useRef(onDragCreate);
  const checkOverlapRef = useRef(checkOverlap);
  const checkPastRef = useRef(checkPast);

  // Calculate overlapping event positions for Google Calendar-style layout
  const getEventPositioning = (event: CalendarRequest) => {
    const eventStart = timeToMinutes(event.start_time);
    const eventEnd = timeToMinutes(event.end_time);

    // Find all events that overlap with this event
    const overlappingEvents = events.filter((e) => {
      const eStart = timeToMinutes(e.start_time);
      const eEnd = timeToMinutes(e.end_time);
      return !(eventEnd <= eStart || eventStart >= eEnd);
    });

    // Sort overlapping events by start time, then by ID for consistent ordering
    const sortedOverlapping = [...overlappingEvents].sort((a, b) => {
      const aStart = timeToMinutes(a.start_time);
      const bStart = timeToMinutes(b.start_time);
      if (aStart !== bStart) return aStart - bStart;
      return a.id.localeCompare(b.id);
    });

    // Find the position of this event in the sorted list
    const position = sortedOverlapping.findIndex((e) => e.id === event.id);
    const totalOverlapping = sortedOverlapping.length;

    // Calculate width and left position
    const width = 100 / totalOverlapping;
    const left = (position * width);

    return { left, width, totalOverlapping };
  };

  // Keep refs fresh on every render so callbacks always use latest props
  onDragCreateRef.current = onDragCreate;
  checkOverlapRef.current = checkOverlap;
  checkPastRef.current = checkPast;

  function getMinutesFromY(clientY: number): number {
    if (!columnRef.current) return HOUR_START * 60;
    const rect = columnRef.current.getBoundingClientRect();
    const y = clientY - rect.top;
    const rawMins = HOUR_START * 60 + y / PX_PER_MINUTE;
    return clampMinutes(snapMinutes(rawMins));
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (!canDrag) return;
    if (e.button !== 0) return;
    e.preventDefault();

    const mins = getMinutesFromY(e.clientY);
    isDragging.current = true;
    dragStartRef.current = mins;
    setDragState({ startMins: mins, currentMins: mins + SNAP_MINUTES });
  }

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!isDragging.current) return;
      const mins = getMinutesFromY(e.clientY);
      setDragState((prev) => (prev ? { ...prev, currentMins: mins } : null));
    }

    function handleMouseUp() {
      if (!isDragging.current) return;
      isDragging.current = false;

      setDragState((prev) => {
        if (prev) {
          const start = Math.min(prev.startMins, prev.currentMins);
          let end = Math.max(prev.startMins, prev.currentMins);
          if (end - start < SNAP_MINUTES) end = start + SNAP_MINUTES;
          setTimeout(() => onDragCreateRef.current(start, end), 0);
        }
        return null;
      });
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const dragPreview = dragState
    ? (() => {
        const start = Math.min(dragState.startMins, dragState.currentMins);
        const end = Math.max(dragState.startMins, dragState.currentMins);
        const duration = Math.max(end - start, SNAP_MINUTES);
        const top = (start - HOUR_START * 60) * PX_PER_MINUTE;
        const height = duration * PX_PER_MINUTE;
        const overlap = checkOverlapRef.current(start, start + duration);
        const isPast = checkPastRef.current(start + duration);
        return { top, height, startTime: minutesToTime(start), endTime: minutesToTime(start + duration), hasConflict: overlap, isPast };
      })()
    : null;

  return (
    <div
      ref={columnRef}
      className={`relative border-r last:border-r-0 ${
        isToday ? "bg-primary/[0.02]" : ""
      }`}
      style={{ height: hours.length * HOUR_HEIGHT }}
      onMouseDown={handleMouseDown}
    >
      {/* Hour grid lines */}
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
            className="absolute left-0 right-0 border-t border-dotted border-muted/40"
            style={{ top: HOUR_HEIGHT / 4 }}
          />
          <div
            className="absolute left-0 right-0 border-t border-dotted border-muted/50"
            style={{ top: HOUR_HEIGHT / 2 }}
          />
          <div
            className="absolute left-0 right-0 border-t border-dotted border-muted/40"
            style={{ top: (HOUR_HEIGHT * 3) / 4 }}
          />
        </div>
      ))}

      {/* Existing events */}
      {events.map((event) => {
        const { top, height } = getEventStyle(event);
        const { left, width } = getEventPositioning(event);
        const colorClass = showAllStatuses
          ? STATUS_CARD_COLORS[event.status] ?? getColorForClassroom(event.classroom_id)
          : getColorForClassroom(event.classroom_id);
        const clickable = !!onEventClick;
        return (
          <div
            key={event.id}
            className={`absolute rounded px-1.5 py-0.5 border-l-[3px] overflow-hidden z-10 ${
              clickable
                ? "pointer-events-auto cursor-pointer hover:brightness-95 transition-all"
                : canDrag
                  ? "pointer-events-auto cursor-not-allowed"
                  : "pointer-events-none"
            } ${colorClass}`}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (clickable) onEventClick(event);
            }}
            style={{ 
              top, 
              height,
              left: `calc(${left}% + 2px)`,
              width: `calc(${width}% - 4px)`,
            }}
            title={`${event.title}\n${event.start_time.slice(0, 5)}–${event.end_time.slice(0, 5)}\n${event.classroom?.name ?? ""}\n${
              event.student_groups && event.student_groups.length > 0
                ? event.student_groups.map((sg) => sg.name).join(", ")
                : event.student_group?.name ?? ""
            }\nProf. ${event.professor?.full_name ?? ""}\nStatus: ${event.status}`}
          >
            <div className="flex items-center gap-0.5">
              {showAllStatuses && (
                <span className={`inline-block shrink-0 w-1.5 h-1.5 rounded-full ${STATUS_DOT[event.status]}`} />
              )}
              <span className="text-[10px] font-semibold leading-tight truncate">
                {event.title}
              </span>
            </div>
            {height >= 32 && showAllStatuses && (
              <div className={`text-[8px] font-bold uppercase tracking-wide mt-0.5 ${STATUS_TEXT[event.status]}`}>
                {event.status === "clarification_needed" ? "Clarify" : event.status}
              </div>
            )}
            {height >= 44 && (
              <div className="text-[9px] leading-tight truncate opacity-80">
                {event.start_time.slice(0, 5)}–{event.end_time.slice(0, 5)}
              </div>
            )}
            {height >= 56 && (
              <div className="text-[9px] leading-tight truncate opacity-70">
                {event.classroom?.name}
              </div>
            )}
            {height >= 70 && (
              <div className="text-[9px] leading-tight truncate opacity-70">
                {event.student_groups && event.student_groups.length > 0
                  ? event.student_groups.map((sg) => sg.name).join(", ")
                  : event.student_group?.name}
              </div>
            )}
          </div>
        );
      })}

      {/* Drag preview */}
      {dragPreview && (
        <div
          className={`absolute left-0.5 right-0.5 rounded border-2 border-dashed z-20 flex flex-col items-center justify-center ${
            dragPreview.hasConflict || dragPreview.isPast
              ? "bg-destructive/10/60 border-destructive/30"
              : "bg-primary/20 border-primary/50"
          }`}
          style={{ top: dragPreview.top, height: dragPreview.height }}
        >
          <span className={`text-[11px] font-semibold ${dragPreview.hasConflict || dragPreview.isPast ? "text-destructive" : "text-primary"}`}>
            {dragPreview.isPast
              ? "Past time"
              : dragPreview.hasConflict
                ? "Slot taken"
                : `${dragPreview.startTime} – ${dragPreview.endTime}`}
          </span>
        </div>
      )}

      {/* Current time indicator */}
      {isToday && (
        <CurrentTimeLine hourStart={HOUR_START} hourHeight={HOUR_HEIGHT} />
      )}

      {/* Cursor style for draggable columns */}
      {canDrag && !dragState && (
        <div className="absolute inset-0 cursor-crosshair z-[1]" />
      )}
    </div>
  );
}

// ─── Current Time Line ───────────────────────────────────────────────

function CurrentTimeLine({
  hourStart,
  hourHeight,
}: {
  hourStart: number;
  hourHeight: number;
}) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const minutes = now.getHours() * 60 + now.getMinutes();
  const offset = minutes - hourStart * 60;
  if (offset < 0 || offset > (HOUR_END - hourStart) * 60) return null;

  const top = (offset / 60) * hourHeight;

  return (
    <div
      className="absolute left-0 right-0 z-30 pointer-events-none"
      style={{ top }}
    >
      <div className="relative flex items-center">
        <div className="w-2.5 h-2.5 rounded-full bg-destructive -ml-1 shadow-sm" />
        <div className="flex-1 border-t-2 border-destructive" />
      </div>
    </div>
  );
}
