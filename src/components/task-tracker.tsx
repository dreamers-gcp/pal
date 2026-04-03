"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createClient } from "@/lib/supabase/client";
import type { StudentTask, TaskKanbanStatus } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { TaskBoardSkeleton } from "@/components/ui/loading-skeletons";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  CalendarDays,
  GripVertical,
  ArrowRightLeft,
} from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { toast } from "sonner";
import { DatePicker } from "@/components/ui/date-picker";

const COLUMN_IDS = ["todo", "in_progress", "completed"] as const;

const COLUMNS: {
  id: TaskKanbanStatus;
  title: string;
  subtitle: string;
  border: string;
  bg: string;
}[] = [
  {
    id: "todo",
    title: "To do",
    subtitle: "Not started",
    border: "border-border",
    bg: "bg-muted/70 dark:bg-muted/25",
  },
  {
    id: "in_progress",
    title: "In progress",
    subtitle: "Active",
    border: "border-amber-200",
    bg: "bg-amber-50/80 dark:bg-amber-950/20",
  },
  {
    id: "completed",
    title: "Completed",
    subtitle: "Done",
    border: "border-emerald-200",
    bg: "bg-emerald-50/80 dark:bg-emerald-950/20",
  },
];

const COLUMN_LABEL: Record<TaskKanbanStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  completed: "Completed",
};

function notifyStudentTasksCalendarChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pal:student-tasks-changed"));
  }
}

function toLocalISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function groupTasksToColumns(tasks: StudentTask[]): Record<TaskKanbanStatus, string[]> {
  const cols: Record<TaskKanbanStatus, string[]> = {
    todo: [],
    in_progress: [],
    completed: [],
  };
  const byStatus: Record<TaskKanbanStatus, StudentTask[]> = {
    todo: [],
    in_progress: [],
    completed: [],
  };
  for (const t of tasks) {
    const s = t.status in cols ? t.status : "todo";
    byStatus[s].push(t);
  }
  for (const c of COLUMN_IDS) {
    byStatus[c].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
    cols[c] = byStatus[c].map((t) => t.id);
  }
  return cols;
}

interface TaskTrackerProps {
  studentId: string;
}

export function TaskTracker({ studentId }: TaskTrackerProps) {
  const supabase = createClient();
  const [tasks, setTasks] = useState<StudentTask[]>([]);
  const [columnItems, setColumnItems] = useState<
    Record<TaskKanbanStatus, string[]>
  >({
    todo: [],
    in_progress: [],
    completed: [],
  });
  const columnItemsRef = useRef(columnItems);
  const [loading, setLoading] = useState(true);
  const [tableReady, setTableReady] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<StudentTask | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskKanbanStatus>("todo");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const taskMap = Object.fromEntries(tasks.map((t) => [t.id, t])) as Record<
    string,
    StudentTask
  >;

  const minDueDate = toLocalISODate(new Date());

  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from("student_tasks")
      .select("*")
      .eq("student_id", studentId);

    if (error) {
      if (
        error.code === "42P01" ||
        error.message?.includes("does not exist") ||
        error.message?.includes("column")
      ) {
        setTableReady(false);
      } else {
        toast.error("Failed to load tasks");
      }
    } else {
      const rows = (data ?? []) as StudentTask[];
      setTasks(rows);
      const grouped = groupTasksToColumns(rows);
      setColumnItems(grouped);
      columnItemsRef.current = grouped;
    }
    setLoading(false);
  }, [studentId, supabase]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  async function persistKanban(
    items: Record<TaskKanbanStatus, string[]>
  ): Promise<boolean> {
    for (const col of COLUMN_IDS) {
      for (let index = 0; index < items[col].length; index++) {
        const taskId = items[col][index];
        const { error } = await supabase
          .from("student_tasks")
          .update({
            status: col,
            sort_order: index,
            updated_at: new Date().toISOString(),
          })
          .eq("id", taskId)
          .eq("student_id", studentId);
        if (error) {
          toast.error("Failed to save board");
          await fetchTasks();
          notifyStudentTasksCalendarChanged();
          return false;
        }
      }
    }
    setTasks((prev) => {
      const map = new Map(prev.map((t) => [t.id, { ...t }]));
      for (const col of COLUMN_IDS) {
        items[col].forEach((id, idx) => {
          const t = map.get(id);
          if (t) {
            t.status = col;
            t.sort_order = idx;
          }
        });
      }
      return Array.from(map.values());
    });
    notifyStudentTasksCalendarChanged();
    return true;
  }

  function handleColumnDragStart(_col: TaskKanbanStatus, event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function handleColumnDragEnd(col: TaskKanbanStatus, event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) {
      await fetchTasks();
      notifyStudentTasksCalendarChanged();
      return;
    }
    if (active.id === over.id) return;

    const prev = columnItemsRef.current;
    const arr = [...prev[col]];
    const oldIndex = arr.indexOf(String(active.id));
    const newIndex = arr.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const next = { ...prev, [col]: arrayMove(arr, oldIndex, newIndex) };
    columnItemsRef.current = next;
    setColumnItems(next);
    await persistKanban(next);
  }

  async function moveTaskToColumn(taskId: string, target: TaskKanbanStatus) {
    const task = taskMap[taskId];
    if (!task || task.status === target) return;

    const prev = columnItemsRef.current;
    const fromCol = task.status;
    const from = prev[fromCol].filter((id) => id !== taskId);
    const to = [...prev[target], taskId];
    const next = { ...prev, [fromCol]: from, [target]: to };
    columnItemsRef.current = next;
    setColumnItems(next);
    await persistKanban(next);
  }

  function openNewTask() {
    setEditingTask(null);
    setTitle("");
    setDescription("");
    setStatus("todo");
    setDueDate("");
    setDialogOpen(true);
  }

  function openEditTask(task: StudentTask) {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description ?? "");
    setStatus(task.status);
    setDueDate(task.due_date);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    let success = false;

    if (editingTask) {
      const { error } = await supabase
        .from("student_tasks")
        .update({
          title: title.trim(),
          description: description.trim() || null,
          status,
          due_date: dueDate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingTask.id);
      if (error) toast.error("Failed to update task");
      else {
        toast.success("Task updated");
        success = true;
        if (editingTask.status !== status) {
          const others = tasks.filter((t) => t.id !== editingTask.id);
          const inCol = others.filter((t) => t.status === status);
          const maxOrder = inCol.reduce((m, t) => Math.max(m, t.sort_order), -1);
          await supabase
            .from("student_tasks")
            .update({ sort_order: maxOrder + 1 })
            .eq("id", editingTask.id);
        }
      }
    } else {
      if (dueDate && dueDate < minDueDate) {
        toast.error("Due date cannot be in the past");
        setSubmitting(false);
        return;
      }
      const colTasks = tasks.filter((t) => t.status === status);
      const maxOrder = colTasks.reduce((m, t) => Math.max(m, t.sort_order), -1);
      const { error } = await supabase.from("student_tasks").insert({
        student_id: studentId,
        title: title.trim(),
        description: description.trim() || null,
        status,
        sort_order: maxOrder + 1,
        due_date: dueDate,
        updated_at: new Date().toISOString(),
      });
      if (error) toast.error("Failed to create task");
      else {
        toast.success("Task created");
        success = true;
      }
    }

    setSubmitting(false);
    if (success) {
      setDialogOpen(false);
      await fetchTasks();
      notifyStudentTasksCalendarChanged();
    }
  }

  async function deleteTask(id: string) {
    const { error } = await supabase
      .from("student_tasks")
      .delete()
      .eq("id", id);
    if (error) toast.error("Failed to delete task");
    else {
      toast.success("Task deleted");
      await fetchTasks();
      notifyStudentTasksCalendarChanged();
    }
  }

  if (loading) {
    return (
      <div className="py-4">
        <span className="sr-only">Loading tasks</span>
        <TaskBoardSkeleton />
      </div>
    );
  }

  if (!tableReady) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="py-6 space-y-2 text-sm text-yellow-800">
          <p>
            <strong>Setup required:</strong> Run{" "}
            <code className="bg-yellow-100 px-1 rounded">
              supabase/add-student-tasks.sql
            </code>{" "}
            for new projects, or{" "}
            <code className="bg-yellow-100 px-1 rounded">
              supabase/migrate-student-tasks-kanban.sql
            </code>{" "}
            to upgrade an existing Eisenhower matrix.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 gap-y-1">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Reorder tasks by dragging the grip. Move tasks using the Move selector on each card.
        </p>
        <Button
          onClick={openNewTask}
          size="lg"
          className="shrink-0 text-base"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Task
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            taskIds={columnItems[col.id]}
            taskMap={taskMap}
            sensors={sensors}
            activeId={activeId}
            onDragStart={(e) => handleColumnDragStart(col.id, e)}
            onDragEnd={(e) => handleColumnDragEnd(col.id, e)}
            onEdit={openEditTask}
            onDelete={deleteTask}
            onMoveToColumn={moveTaskToColumn}
          />
        ))}
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) setDialogOpen(false);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {editingTask ? "Edit Task" : "New Task"}
          </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
            <Label htmlFor="task-title" className="text-base">
                Title
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Complete assignment 3"
                required
              className="text-base"
              />
            </div>
            <div className="space-y-2">
            <Label htmlFor="task-desc" className="text-base">
              Description (optional)
            </Label>
              <Textarea
                id="task-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add details..."
                rows={3}
              className="text-base"
              />
            </div>
            <div className="space-y-2">
            <Label htmlFor="task-status" className="text-base">
                Status
                <span className="text-destructive">*</span>
              </Label>
              <select
                id="task-status"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as TaskKanbanStatus)
                }
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-base"
                required
              >
                <option value="todo">To do</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="space-y-2">
            <Label htmlFor="task-due" className="text-base">
                Due Date
                <span className="text-destructive">*</span>
              </Label>
              <DatePicker
                value={dueDate}
                onChange={setDueDate}
                min={editingTask ? undefined : minDueDate}
                placeholder="Pick due date"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? "Saving..."
                  : editingTask
                    ? "Update Task"
                    : "Create Task"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KanbanColumn({
  column,
  taskIds,
  taskMap,
  sensors,
  activeId,
  onDragStart,
  onDragEnd,
  onEdit,
  onDelete,
  onMoveToColumn,
}: {
  column: (typeof COLUMNS)[number];
  taskIds: string[];
  taskMap: Record<string, StudentTask>;
  sensors: ReturnType<typeof useSensors>;
  activeId: string | null;
  onDragStart: (e: DragStartEvent) => void;
  onDragEnd: (e: DragEndEvent) => void;
  onEdit: (t: StudentTask) => void;
  onDelete: (id: string) => void;
  onMoveToColumn: (taskId: string, target: TaskKanbanStatus) => void;
}) {
  const overlayTask =
    activeId && taskIds.includes(activeId) ? taskMap[activeId] : null;

  return (
    <div
      className={`rounded-xl border-2 ${column.border} ${column.bg} p-4 min-h-[320px] flex flex-col`}
    >
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <div>
          <h3 className="font-semibold text-base">{column.title}</h3>
          <p className="text-xs text-muted-foreground">{column.subtitle}</p>
        </div>
        <Badge variant="outline" className="text-sm ml-auto">
          {taskIds.length}
        </Badge>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex-1 flex flex-col gap-2 min-h-[120px]">
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            {taskIds.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-10 border border-dashed rounded-lg">
                No tasks
              </p>
            )}
            {taskIds.map((id) => {
              const task = taskMap[id];
              if (!task) return null;
              return (
                <SortableTaskCard
                  key={id}
                  task={task}
                  onEdit={() => onEdit(task)}
                  onDelete={() => onDelete(id)}
                  onMoveToColumn={onMoveToColumn}
                />
              );
            })}
          </SortableContext>
        </div>
        <DragOverlay dropAnimation={null}>
          {overlayTask ? (
            <div className="opacity-95 shadow-lg rounded-lg cursor-grabbing">
              <TaskCardStatic task={overlayTask} dragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function SortableTaskCard({
  task,
  onEdit,
  onDelete,
  onMoveToColumn,
}: {
  task: StudentTask;
  onEdit: () => void;
  onDelete: () => void;
  onMoveToColumn: (taskId: string, target: TaskKanbanStatus) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TaskCardStatic
        task={task}
        dragHandleProps={{ ...attributes, ...listeners }}
        onEdit={onEdit}
        onDelete={onDelete}
        onMoveToColumn={onMoveToColumn}
      />
    </div>
  );
}

function TaskCardStatic({
  task,
  onEdit,
  onDelete,
  onMoveToColumn,
  dragHandleProps,
  dragging,
}: {
  task: StudentTask;
  onEdit?: () => void;
  onDelete?: () => void;
  onMoveToColumn?: (taskId: string, target: TaskKanbanStatus) => void;
  dragHandleProps?: Record<string, unknown>;
  dragging?: boolean;
}) {
  const isOverdue =
    task.status !== "completed" &&
    isPast(new Date(task.due_date)) &&
    !isToday(new Date(task.due_date));

  return (
    <Card
      className={`shadow-sm hover:shadow-md transition-shadow ${
        dragging ? "cursor-grabbing" : ""
      }`}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none p-0.5 -ml-0.5 rounded"
            aria-label="Drag to reorder in this column"
            {...dragHandleProps}
          >
            <GripVertical className="h-5 w-5" />
          </button>
          <span
            className={`flex-1 text-base font-medium leading-tight min-w-0 ${
              task.status === "completed"
                ? "line-through text-muted-foreground"
                : ""
            }`}
          >
            {task.title}
          </span>
          {onEdit && onDelete && (
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={onEdit}
                className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                aria-label="Edit task"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="p-1 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                aria-label="Delete task"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {onMoveToColumn && (
          <div className="flex items-center gap-1.5 pl-6 flex-wrap">
            <ArrowRightLeft className="h-3 w-3 text-muted-foreground shrink-0" />
            <Label
              htmlFor={`move-${task.id}`}
                className="text-xs text-muted-foreground sr-only"
            >
              Move to column
            </Label>
            <select
              id={`move-${task.id}`}
              value={task.status}
              onChange={(e) => {
                onMoveToColumn(
                  task.id,
                  e.target.value as TaskKanbanStatus
                );
              }}
              className="h-9 flex-1 min-w-0 max-w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {COLUMN_IDS.map((id) => (
                <option key={id} value={id}>
                  {COLUMN_LABEL[id]}
                </option>
              ))}
            </select>
          </div>
        )}

        {task.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 pl-6">
            {task.description}
          </p>
        )}

        <div className="flex items-center gap-2 pl-6">
          <span
            className={`inline-flex items-center gap-1 text-sm ${
              isOverdue
                ? "text-destructive font-medium"
                : "text-muted-foreground"
            }`}
          >
            <CalendarDays className="h-4 w-4" />
            {isOverdue && "Overdue · "}
            {format(new Date(task.due_date), "MMM d")}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
