"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { StudentTask, TaskStatus } from "@/lib/types";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
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
  CalendarDays,
  GripVertical,
} from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { toast } from "sonner";

const COLUMNS: {
  key: TaskStatus;
  label: string;
  bg: string;
  border: string;
  headerColor: string;
  badgeColor: string;
}[] = [
  {
    key: "todo",
    label: "To Do",
    bg: "bg-slate-50",
    border: "border-slate-200",
    headerColor: "text-slate-700",
    badgeColor: "bg-slate-100 text-slate-600",
  },
  {
    key: "in_progress",
    label: "In Progress",
    bg: "bg-blue-50",
    border: "border-blue-200",
    headerColor: "text-blue-700",
    badgeColor: "bg-blue-100 text-blue-700",
  },
  {
    key: "completed",
    label: "Completed",
    bg: "bg-green-50",
    border: "border-green-200",
    headerColor: "text-green-700",
    badgeColor: "bg-green-100 text-green-700",
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

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from("student_tasks")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: true });

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

    const payload = {
      student_id: studentId,
      title: title.trim(),
      description: description.trim() || null,
      status,
      due_date: dueDate,
      updated_at: new Date().toISOString(),
    };

    if (editingTask) {
      const { error } = await supabase
        .from("student_tasks")
        .update(payload)
        .eq("id", editingTask.id);
      if (error) toast.error("Failed to update task");
      else {
        toast.success("Task updated");
        setTasks((prev) =>
          prev.map((t) =>
            t.id === editingTask.id ? { ...t, ...payload } : t
          )
        );
      }
    } else {
      const { data, error } = await supabase
        .from("student_tasks")
        .insert(payload)
        .select()
        .single();
      if (error) toast.error("Failed to create task");
      else {
        toast.success("Task created");
        setTasks((prev) => [...prev, data]);
      }
    }

    setSubmitting(false);
    setDialogOpen(false);
  }

  async function deleteTask(id: string) {
    const { error } = await supabase
      .from("student_tasks")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Failed to delete task");
    } else {
      toast.success("Task deleted");
      setTasks((prev) => prev.filter((t) => t.id !== id));
    }
  }

  async function onDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    )
      return;

    const newStatus = destination.droppableId as TaskStatus;

    // Optimistically reorder local state
    setTasks((prev) => {
      const updated = prev.map((t) =>
        t.id === draggableId ? { ...t, status: newStatus } : t
      );

      // Within the column: reorder by moving item from source.index to destination.index
      const colTasks = updated.filter((t) => t.status === newStatus);
      const otherTasks = updated.filter((t) => t.status !== newStatus);

      if (source.droppableId === destination.droppableId) {
        // Same-column reorder
        const srcColTasks = prev
          .filter((t) => t.status === source.droppableId)
          .map((t) => ({ ...t }));
        const [moved] = srcColTasks.splice(source.index, 1);
        srcColTasks.splice(destination.index, 0, moved);
        return [
          ...prev.filter((t) => t.status !== source.droppableId),
          ...srcColTasks,
        ];
      }

      // Cross-column: place at correct destination index
      const destColTasks = colTasks.filter((t) => t.id !== draggableId);
      const movedTask = updated.find((t) => t.id === draggableId)!;
      destColTasks.splice(destination.index, 0, movedTask);

      return [...otherTasks, ...destColTasks];
    });

    // Persist status change to Supabase (only needed for cross-column)
    if (source.droppableId !== destination.droppableId) {
      const { error } = await supabase
        .from("student_tasks")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", draggableId);
      if (error) {
        toast.error("Failed to move task");
        fetchTasks(); // revert on error
      }
    }
  }

  const tasksByStatus = (s: TaskStatus) =>
    tasks.filter((t) => t.status === s);

  const stats = {
    total: tasks.length,
    completed: tasksByStatus("completed").length,
    overdue: tasks
      .filter((t) => t.status !== "completed")
      .filter(
        (t) => isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))
      ).length,
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Loading tasks...</div>
      </div>
    );
  }

  if (!tableReady) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="py-6">
          <p className="text-sm text-yellow-800">
            <strong>Setup required:</strong> The tasks table hasn&apos;t been created
            yet. Ask your admin to run the{" "}
            <code className="bg-yellow-100 px-1 rounded">
              supabase/migrate-tasks-to-kanban.sql
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
            <strong className="text-green-600">{stats.completed}</strong> completed
          </span>
          {stats.overdue > 0 && (
            <span className="text-muted-foreground">
              <strong className="text-red-600">{stats.overdue}</strong> overdue
            </span>
          )}
        </div>
        <Button onClick={openNewTask} size="sm" className="ml-auto">
          <Plus className="h-4 w-4 mr-1" />
          Add Task
        </Button>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map((col) => {
            const colTasks = tasksByStatus(col.key);
            return (
              <div
                key={col.key}
                className={`rounded-xl border-2 ${col.border} ${col.bg} p-4 flex flex-col min-h-[300px]`}
              >
                {/* Column header */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`font-semibold text-sm ${col.headerColor}`}>
                    {col.label}
                  </h3>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${col.badgeColor}`}
                  >
                    {colTasks.length}
                  </span>
                </div>

                {/* Droppable area */}
                <Droppable droppableId={col.key}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 space-y-2 rounded-lg transition-colors ${
                        snapshot.isDraggingOver ? "bg-black/5" : ""
                      }`}
                    >
                      {colTasks.length === 0 && !snapshot.isDraggingOver && (
                        <p className="text-xs text-muted-foreground text-center py-8">
                          No tasks
                        </p>
                      )}
                      {colTasks.map((task, index) => (
                        <Draggable
                          key={task.id}
                          draggableId={task.id}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`${
                                snapshot.isDragging ? "opacity-80 rotate-1 shadow-lg" : ""
                              }`}
                            >
                              <TaskCard
                                task={task}
                                dragHandleProps={provided.dragHandleProps}
                                onEdit={() => openEditTask(task)}
                                onDelete={() => deleteTask(task.id)}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Add / Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) setDialogOpen(false);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTask ? "Edit Task" : "New Task"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">
                Title <span className="text-red-500">*</span>
              </Label>
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

            <div className="space-y-2">
              <Label htmlFor="task-status">
                Status <span className="text-red-500">*</span>
              </Label>
              <select
                id="task-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                required
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-due">
                Due Date <span className="text-red-500">*</span>
              </Label>
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
  dragHandleProps,
  onEdit,
  onDelete,
}: {
  task: StudentTask;
  dragHandleProps: React.HTMLAttributes<HTMLDivElement> | null | undefined;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isOverdue =
    task.status !== "completed" &&
    isPast(new Date(task.due_date)) &&
    !isToday(new Date(task.due_date));

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow bg-white">
      <CardContent className="p-3 space-y-1">
        <div className="flex items-start gap-2">
          {/* Drag handle */}
          <div
            {...dragHandleProps}
            className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </div>

          <div className="flex-1 min-w-0">
            <span
              className={`text-sm font-medium leading-tight block ${
                task.status === "completed"
                  ? "line-through text-muted-foreground"
                  : ""
              }`}
            >
              {task.title}
            </span>
            {task.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                {task.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`inline-flex items-center gap-1 text-[10px] ${
                  isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"
                }`}
              >
                <CalendarDays className="h-3 w-3" />
                {isOverdue && "Overdue · "}
                {format(new Date(task.due_date), "MMM d")}
              </span>
            </div>
          </div>

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
      </CardContent>
    </Card>
  );
}
