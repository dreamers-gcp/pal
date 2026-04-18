import {
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";

const HOUR_PX = 22;
const FIRST_HOUR = 8;
/** Hour labels 8:00 … 16:00 — nine rows so blocks can run until 16:30 like the live calendar. */
const HOUR_COUNT = 9;

/** Matches `classroomPalette` + facility teal in `request-calendar.tsx`. */
const COLORS = {
  room1: "#2563eb",
  room2: "#7c3aed",
  room3: "#ea580c",
  room4: "#db2777",
  facility: "#0d9488",
} as const;

function slotStyle(
  startH: number,
  startM: number,
  endH: number,
  endM: number
): { top: number; height: number } {
  const startDec = startH + startM / 60 - FIRST_HOUR;
  const endDec = endH + endM / 60 - FIRST_HOUR;
  return {
    top: Math.max(0, startDec) * HOUR_PX,
    height: Math.max(12, (endDec - startDec) * HOUR_PX),
  };
}

/**
 * Static preview of the in-app `RequestCalendar` week view (react-big-calendar + theme from `student-calendar.css`).
 */
export function LandingCalendarMock() {
  const hours = Array.from({ length: HOUR_COUNT }, (_, i) => FIRST_HOUR + i);
  const gridHeight = HOUR_COUNT * HOUR_PX;
  const days = [
    { label: "Mon", date: "13" },
    { label: "Tue", date: "14" },
    { label: "Wed", date: "15" },
    { label: "Thu", date: "16" },
    { label: "Fri", date: "17" },
    { label: "Sat", date: "18" },
    { label: "Sun", date: "19" },
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background p-2">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="rounded-lg bg-primary px-2.5 py-1 text-[10px] font-medium text-primary-foreground">
            All rooms
          </span>
          <span className="rounded-lg bg-muted px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
            My schedule
          </span>
        </div>
        <span className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[10px] font-medium text-primary-foreground">
          <Plus className="h-3 w-3" aria-hidden />
          New request
        </span>
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
          <span className="rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium text-foreground">
            Today
          </span>
          <span className="inline-flex overflow-hidden rounded-md border border-border">
            <span className="border-r border-border px-1.5 py-1 text-muted-foreground">
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span className="px-1.5 py-1 text-muted-foreground">
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </span>
          </span>
        </div>
        <p className="text-center text-[11px] font-semibold text-foreground sm:min-w-0 sm:flex-1">
          Apr 13 – Apr 19, 2026
        </p>
        <div className="flex justify-center gap-1 sm:justify-end">
          <span className="rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium text-foreground">
            Month
          </span>
          <span className="rounded-md border border-primary bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground">
            Week
          </span>
          <span className="rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium text-foreground">
            Day
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <div className="min-w-[340px]">
          <div
            className="grid border-b border-border bg-muted"
            style={{
              gridTemplateColumns: `2.25rem repeat(${days.length}, minmax(0, 1fr))`,
            }}
          >
            <div className="border-r border-border" />
            {days.map((d) => (
              <div
                key={d.label}
                className="border-l border-border px-0.5 py-1.5 text-center sm:px-1"
              >
                <div className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {d.label}
                </div>
                <div className="text-[10px] font-semibold text-foreground">{d.date}</div>
              </div>
            ))}
          </div>

          <div
            className="grid border-b border-border bg-background"
            style={{
              gridTemplateColumns: `2.25rem repeat(${days.length}, minmax(0, 1fr))`,
            }}
          >
            <div className="flex items-center justify-center border-r border-border bg-muted/50 px-0.5 text-[7px] font-medium uppercase tracking-wide text-muted-foreground">
              All day
            </div>
            {days.map((d) => (
              <div
                key={`allday-${d.label}`}
                className="min-h-[22px] border-l border-border"
              />
            ))}
          </div>

          <div className="flex">
            <div
              className="shrink-0 border-r border-border bg-background"
              style={{ width: "2.25rem" }}
            >
              {hours.map((h) => (
                <div
                  key={h}
                  className="relative border-t border-border/50 text-right text-[8px] text-muted-foreground first:border-t-0"
                  style={{ height: HOUR_PX }}
                >
                  <span className="absolute right-0.5 top-0 -translate-y-1/2 bg-background px-0.5 leading-none">
                    {h}:00
                  </span>
                </div>
              ))}
            </div>

            <div
              className="grid min-w-0 flex-1"
              style={{
                gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
                height: gridHeight,
              }}
            >
              {days.map((d, colIdx) => (
                <div key={d.label} className="relative border-l border-border">
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="border-t border-border/50 first:border-t-0"
                      style={{ height: HOUR_PX }}
                    />
                  ))}

                  {colIdx === 0 ? (
                    <div
                      className="pointer-events-none absolute inset-x-0.5 rounded px-1 py-0.5 text-[8px] font-medium leading-tight text-white shadow-sm"
                      style={{
                        ...slotStyle(10, 0, 11, 30),
                        backgroundColor: COLORS.room1,
                      }}
                    >
                      <span className="flex min-w-0 items-center gap-0.5">
                        <CalendarDays className="h-2.5 w-2.5 shrink-0 opacity-95" aria-hidden />
                        <span className="truncate">Data Structures</span>
                      </span>
                    </div>
                  ) : null}

                  {colIdx === 1 ? (
                    <div
                      className="pointer-events-none absolute inset-x-0.5 rounded px-1 py-0.5 text-[8px] font-medium leading-tight text-white shadow-sm"
                      style={{
                        ...slotStyle(14, 0, 15, 45),
                        backgroundColor: COLORS.room2,
                      }}
                    >
                      <span className="flex min-w-0 items-center gap-0.5">
                        <CalendarDays className="h-2.5 w-2.5 shrink-0 opacity-95" aria-hidden />
                        <span className="truncate">DBMS Lab</span>
                      </span>
                    </div>
                  ) : null}

                  {colIdx === 2 ? (
                    <div
                      className="pointer-events-none absolute inset-x-0.5 rounded px-1 py-0.5 text-[8px] font-medium leading-tight text-white shadow-sm"
                      style={{
                        ...slotStyle(9, 30, 11, 0),
                        backgroundColor: COLORS.facility,
                      }}
                    >
                      <span className="flex min-w-0 items-center gap-0.5">
                        <Building2 className="h-2.5 w-2.5 shrink-0 opacity-95" aria-hidden />
                        <span className="truncate">Auditorium · Orientation</span>
                      </span>
                    </div>
                  ) : null}

                  {colIdx === 3 ? (
                    <div
                      className="pointer-events-none absolute inset-x-0.5 rounded px-1 py-0.5 text-[8px] font-medium leading-tight text-white shadow-sm"
                      style={{
                        ...slotStyle(11, 0, 12, 30),
                        backgroundColor: COLORS.room3,
                      }}
                    >
                      <span className="flex min-w-0 items-center gap-0.5">
                        <CalendarDays className="h-2.5 w-2.5 shrink-0 opacity-95" aria-hidden />
                        <span className="truncate">Office hours</span>
                      </span>
                    </div>
                  ) : null}

                  {colIdx === 4 ? (
                    <div
                      className="pointer-events-none absolute inset-x-0.5 rounded px-1 py-0.5 text-[8px] font-medium leading-tight text-white shadow-sm"
                      style={{
                        ...slotStyle(15, 0, 16, 30),
                        backgroundColor: COLORS.room4,
                      }}
                    >
                      <span className="flex min-w-0 items-center gap-0.5">
                        <CalendarDays className="h-2.5 w-2.5 shrink-0 opacity-95" aria-hidden />
                        <span className="truncate">Research seminar</span>
                      </span>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
