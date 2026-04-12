import type { AppointmentProviderCode, MessMealPeriod } from "../types";

export const MEAL_PERIOD_LABELS: Record<MessMealPeriod, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

export const APPOINTMENT_PROVIDER_LABELS: Record<AppointmentProviderCode, string> = {
  counsellor_1: "Counsellor",
  doctor_1: "Doctor 1",
  doctor_2: "Doctor 2",
};

export function providersForService(service: "counsellor" | "doctor"): AppointmentProviderCode[] {
  if (service === "counsellor") return ["counsellor_1"];
  return ["doctor_1", "doctor_2"];
}

export function tomorrowDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function normalizeTimeForDb(t: string): string {
  const s = t.trim();
  if (s.length === 5) return `${s}:00`;
  return s;
}

export function timeSlice(t: string): string {
  return t.slice(0, 5);
}

const APPOINTMENT_COUNSELLOR_MINUTES = 45;
const APPOINTMENT_DOCTOR_MINUTES = 15;

export function appointmentDurationMinutes(service: "counsellor" | "doctor"): number {
  return service === "doctor" ? APPOINTMENT_DOCTOR_MINUTES : APPOINTMENT_COUNSELLOR_MINUTES;
}

export function addMinutesToHHmm(time: string, minutes: number): string {
  const [h, m] = time.split(":").map((x) => parseInt(x, 10));
  const total = (h ?? 0) * 60 + (m ?? 0) + minutes;
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

function formatTime12h(h24: number, minute: number): string {
  const h12 = h24 % 12 || 12;
  const ampm = h24 < 12 ? "AM" : "PM";
  return `${h12}:${String(minute).padStart(2, "0")} ${ampm}`;
}

export function appointmentStartTimeOptions(
  durationMins: number,
  stepMinutes = 15
): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (let t = 0; t + durationMins < 24 * 60; t += stepMinutes) {
    const h = Math.floor(t / 60);
    const min = t % 60;
    const value = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    options.push({ value, label: formatTime12h(h, min) });
  }
  return options;
}
