"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  StudentTask,
  ImportanceLevel,
  UrgencyLevel,
  Quadrant,
} from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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
  CheckCircle2,
  Circle,
  Flame,
  CalendarDays,
  Users,
  Coffee,
  Undo2,
} from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { toast } from "sonner";

function getQuadrant(importance: ImportanceLevel, urgency: UrgencyLevel): Quadrant {
  if (importance === "high" && urgency === "high") return "do_first";
  if (importance === "high" && urgency === "low") return "schedule";
  if (importance === "low" && urgency === "high") return "delegate";
  return "do_later";
}

const QUADRANTS: {
  key: Quadrant;
  label: string;
  subtitle: string;
  icon: typeof Flame;
  bg: string;
  border: string;
  iconColor: string;
}[] = [
  {
    key: "do_first",
    label: "Do First",
    subtitle: "Important & Urgent",
    icon: Flame,
    bg: "bg-red-50",
    border: "border-red-200",
    iconColor: "text-red-500",
  },
  {
    key: "schedule",
    label: "Schedule",
    subtitle: "Important & Not Urgent",
    icon: CalendarDays,
    bg: "bg-blue-50",
    border: "border-blue-200",
    iconColor: "text-blue-500",
  },
  {
    key: "delegate",
    label: "Delegate",
    subtitle: "Not Important & Urgent",
    icon: Users,
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    iconColor: "text-yellow-600",
  },
  {
    key: "do_later",
    label: "Do Later",
    subtitle: "Not Important & Not Urgent",
    icon: Coffee,
    bg: "bg-green-50",
    border: "border-green-200",
    iconColor: "text-green-500",
  },
];

interface TaskTrackerProps {
  studentId: string;
}

export function TaskTracker({ studentId }: TaskTrackerProps) {
  const supabase = createClient();
  const [tasks, setTasks] = useState<StudentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableReady, setTableReady] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<StudentTask | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [importance, setImportance] = useState<ImportanceLevel>("low");
  const [urgency, setUrgency] = useState<UrgencyLevel>("low");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from("student_tasks")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        setTableReady(false);
      } else {
        toast.error("Failed to load tasks");
      }
    } else {
      setTasks(data ?? []);
    }
    setLoading(false);
  }, [studentId, supabase]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  function openNewTask() {
    setEditingTask(null);
    setTitle("");
    setDescription("");
    setImportance("low");
    setUrgency("low");
    setDueDate("");
    setDialogOpen(true);
  }

  function openEditTask(task: StudentTask) {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description ?? "");
    setImportance(task.importance);
    setUrgency(task.urgency);
    setDueDate(task.due_date);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      student_id: studentId,
      title: title.trim(),
      description: description.trim() || null,
      importance,
      urgency,
      due_date: dueDate,
      updated_at: new Date().toISOString(),
    };

    if (editingTask) {
      const { error } = await supabase
        .from("student_tasks")
        .update(payload)
        .eq("id", editingTask.id);
      if (error) toast.error("Failed to update task");
      else toast.success("Task updated");
    } else {
      const { error } = await supabase
        .from("student_tasks")
        .insert({ ...payload, completed: false });
      if (error) toast.error("Failed to create task");
      else toast.success("Task created");
    }

    setSubmitting(false);
    setDialogOpen(false);
    fetchTasks();
  }

  async function toggleComplete(task: StudentTask) {
    const { error } = await supabase
      .from("student_tasks")
      .update({
        completed: !task.completed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", task.id);

    if (error) {
      toast.error("Failed to update task");
    } else {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, completed: !t.completed } : t
        )
      );
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
      fetchTasks();
    }
  }

  const activeTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);

  const tasksByQuadrant = (q: Quadrant) =>
    activeTasks.filter((t) => getQuadrant(t.importance, t.urgency) === q);

  const stats = {
    total: tasks.length,
    completed: completedTasks.length,
    overdue: activeTasks.filter(
      (t) => isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))
    ).length,
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-pulse text-muted-foreground">
          Loading tasks...
        </div>
      </div>
    );
  }

  if (!tableReady) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="py-6">
          <p className="text-sm text-yellow-800">
            <strong>Setup required:</strong> The tasks table hasn&apos;t been
            created yet. Ask your admin to run the{" "}
            <code className="bg-yellow-100 px-1 rounded">
              supabase/add-student-tasks.sql
            </code>{" "}
            migration in the Supabase SQL Editor.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-6 text-sm">
          <span className="text-muted-foreground">
            <strong className="text-foreground">{stats.total}</strong> total
          </span>
          <span className="text-muted-foreground">
            <strong className="text-green-600">{stats.completed}</strong>{" "}
            completed
          </span>
          {stats.overdue > 0 && (
            <span className="text-muted-foreground">
              <strong className="text-red-600">{stats.overdue}</strong> overdue
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="rounded"
            />
            Show completed
          </label>
          <Button onClick={openNewTask} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Axis labels */}
      <div className="relative">
        <div className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          Urgent → Not Urgent
        </div>

        <div className="flex gap-1">
          {/* Y-axis label */}
          <div className="flex items-center justify-center w-5 shrink-0">
            <span
              className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              Important → Not Important
            </span>
          </div>

          {/* 2x2 matrix */}
          <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-3">
            {QUADRANTS.map((q) => {
              const qTasks = tasksByQuadrant(q.key);
              const Icon = q.icon;
              return (
                <div
                  key={q.key}
                  className={`rounded-xl border-2 ${q.border} ${q.bg} p-4 min-h-[200px]`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className={`h-4 w-4 ${q.iconColor}`} />
                    <div>
                      <h3 className="font-semibold text-sm">{q.label}</h3>
                      <p className="text-[10px] text-muted-foreground">
                        {q.subtitle}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs ml-auto">
                      {qTasks.length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {qTasks.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-6">
                        No tasks
                      </p>
                    )}
                    {qTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onEdit={() => openEditTask(task)}
                        onDelete={() => deleteTask(task.id)}
                        onToggleComplete={() => toggleComplete(task)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Completed tasks */}
      {showCompleted && completedTasks.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">
            Completed ({completedTasks.length})
          </h3>
          <div className="space-y-2 opacity-60">
            {completedTasks.map((task) => (
              <CompletedTaskCard
                key={task.id}
                task={task}
                onUndo={() => toggleComplete(task)}
                onDelete={() => deleteTask(task.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) setDialogOpen(false);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTask ? "Edit Task" : "New Task"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Complete assignment 3"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-desc">Description (optional)</Label>
              <Textarea
                id="task-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add details..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task-importance">Importance</Label>
                <select
                  id="task-importance"
                  value={importance}
                  onChange={(e) =>
                    setImportance(e.target.value as ImportanceLevel)
                  }
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="high">High</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-urgency">Urgency</Label>
                <select
                  id="task-urgency"
                  value={urgency}
                  onChange={(e) =>
                    setUrgency(e.target.value as UrgencyLevel)
                  }
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="high">High</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            {/* Quadrant preview */}
            <div
              className={`rounded-lg px-3 py-2 text-sm flex items-center gap-2 ${
                QUADRANTS.find(
                  (q) => q.key === getQuadrant(importance, urgency)
                )!.bg
              } ${
                QUADRANTS.find(
                  (q) => q.key === getQuadrant(importance, urgency)
                )!.border
              } border`}
            >
              {(() => {
                const q = QUADRANTS.find(
                  (q) => q.key === getQuadrant(importance, urgency)
                )!;
                const Icon = q.icon;
                return (
                  <>
                    <Icon className={`h-4 w-4 ${q.iconColor}`} />
                    <span className="font-medium">{q.label}</span>
                    <span className="text-muted-foreground text-xs">
                      — {q.subtitle}
                    </span>
                  </>
                );
              })()}
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-due">Due Date</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
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

function TaskCard({
  task,
  onEdit,
  onDelete,
  onToggleComplete,
}: {
  task: StudentTask;
  onEdit: () => void;
  onDelete: () => void;
  onToggleComplete: () => void;
}) {
  const isOverdue =
    !task.completed &&
    isPast(new Date(task.due_date)) &&
    !isToday(new Date(task.due_date));

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-3 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <button
            onClick={onToggleComplete}
            className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
            title={task.completed ? "Mark incomplete" : "Mark complete"}
          >
            {task.completed ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <Circle className="h-4 w-4" />
            )}
          </button>
          <span
            className={`flex-1 text-sm font-medium leading-tight ${
              task.completed ? "line-through text-muted-foreground" : ""
            }`}
          >
            {task.title}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onEdit}
              className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="p-1 rounded hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 pl-6">
            {task.description}
          </p>
        )}

        <div className="flex items-center gap-2 pl-6">
          <span
            className={`inline-flex items-center gap-1 text-[10px] ${
              isOverdue
                ? "text-red-600 font-medium"
                : "text-muted-foreground"
            }`}
          >
            <CalendarDays className="h-3 w-3" />
            {isOverdue && "Overdue · "}
            {format(new Date(task.due_date), "MMM d")}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function CompletedTaskCard({
  task,
  onUndo,
  onDelete,
}: {
  task: StudentTask;
  onUndo: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-3 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-green-600" />
          <span className="flex-1 text-sm font-medium leading-tight line-through text-muted-foreground">
            {task.title}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onUndo}
              className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              title="Undo — move back to matrix"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="p-1 rounded hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
              title="Delete task"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 pl-6">
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <CalendarDays className="h-3 w-3" />
            {format(new Date(task.due_date), "MMM d")}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
