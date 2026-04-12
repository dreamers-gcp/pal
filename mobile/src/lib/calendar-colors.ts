import type { Classroom, TaskKanbanStatus } from "../types";

export const classroomPalette = ["#2563eb", "#7c3aed", "#0f766e", "#ea580c", "#db2777"] as const;

export const facilityOverlayColor = "#0d9488";

/** Approved / busy blocks in admin resource-availability view (web parity). */
export const availabilityBusyColor = "#64748b";

export const taskStatusColors: Record<TaskKanbanStatus, string> = {
  todo: "#64748b",
  in_progress: "#f59e0b",
  completed: "#94a3b8",
};

export function colorForClassroom(classrooms: Classroom[], classroomId: string): string {
  const idx = classrooms.findIndex((c) => c.id === classroomId);
  return classroomPalette[(idx >= 0 ? idx : 0) % classroomPalette.length];
}
