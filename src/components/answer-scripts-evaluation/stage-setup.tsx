"use client";

import { useMemo } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { Info, GripVertical, Plus, ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import type { ExamQuestion, ExamSetup, ExamStep, EvaluationStrictness } from "./types";
import { STRICTNESS_OPTIONS } from "./constants";

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Next label like (a), (b), (c) from existing sub-parts in this question. */
function nextSubPartLabel(existingSteps: { subPartLabel: string }[]): string {
  let maxLetterIdx = -1;
  for (const s of existingSteps) {
    const t = s.subPartLabel.trim();
    const paren = t.match(/\(([a-z])\)/i);
    const bare = t.match(/^([a-z])$/i);
    const m = paren || bare;
    if (m) {
      const code = m[1].toLowerCase().charCodeAt(0) - 97;
      if (code >= 0 && code < 26) maxLetterIdx = Math.max(maxLetterIdx, code);
    }
  }
  if (maxLetterIdx >= 0) {
    const n = maxLetterIdx + 1;
    return n < 26 ? `(${String.fromCharCode(97 + n)})` : `(part-${n + 1})`;
  }
  const i = existingSteps.length;
  return i < 26 ? `(${String.fromCharCode(97 + i)})` : `(part-${i + 1})`;
}

function createStepForQuestion(existingSteps: ExamStep[]): ExamStep {
  const marks = 2;
  return {
    id: newId("step"),
    subPartLabel: nextSubPartLabel(existingSteps),
    description: "",
    marks,
  };
}

function defaultQuestion(no: number): ExamQuestion {
  return {
    id: newId("q"),
    questionNo: no,
    steps: [createStepForQuestion([])],
  };
}

export function createInitialSetup(): ExamSetup {
  return {
    name: "",
    subject: "",
    date: new Date().toISOString().slice(0, 10),
    totalMarks: 10,
    questions: [defaultQuestion(1)],
    strictness: "conceptual",
  };
}

function sumMarks(questions: ExamQuestion[]) {
  return questions.reduce(
    (acc, q) => acc + q.steps.reduce((s, st) => s + (Number(st.marks) || 0), 0),
    0
  );
}

function SortableQuestionCard({
  question,
  onUpdateQuestionNo,
  onRemoveQuestion,
  onAddStep,
  onUpdateStep,
  onRemoveStep,
  onMoveStep,
  disabled,
}: {
  question: ExamQuestion;
  onUpdateQuestionNo: (n: number) => void;
  onRemoveQuestion: () => void;
  onAddStep: () => void;
  onUpdateStep: (stepId: string, patch: Partial<ExamStep>) => void;
  onRemoveStep: (stepId: string) => void;
  onMoveStep: (stepId: string, dir: -1 | 1) => void;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-xl border bg-card shadow-sm",
        isDragging && "z-10 opacity-90 ring-2 ring-[#01696f]/30"
      )}
    >
      <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
        <button
          type="button"
          className="touch-none rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          disabled={disabled}
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder question"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Label className="sr-only">Question number</Label>
        <Input
          className="h-8 w-14 font-mono text-sm"
          type="number"
          min={1}
          value={question.questionNo}
          onChange={(e) => onUpdateQuestionNo(parseInt(e.target.value, 10) || 1)}
          disabled={disabled}
        />
        <span className="text-sm font-medium text-muted-foreground">Question</span>
        <div className="ml-auto flex gap-1">
          <Button type="button" size="sm" variant="outline" className="h-8" onClick={onAddStep} disabled={disabled}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add step
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive"
            onClick={onRemoveQuestion}
            disabled={disabled}
            aria-label="Remove question"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="space-y-3 p-3">
        {question.steps.map((st, idx) => (
          <div
            key={st.id}
            className="rounded-lg border border-border/70 bg-muted/10 p-3 shadow-sm"
          >
            <div className="grid gap-3 sm:grid-cols-[minmax(0,5.5rem)_1fr_minmax(0,5rem)] sm:items-end">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Sub-part</Label>
                <Input
                  value={st.subPartLabel}
                  onChange={(e) => onUpdateStep(st.id, { subPartLabel: e.target.value })}
                  className="h-9 font-mono text-sm"
                  disabled={disabled}
                  placeholder="(a)"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-1 min-w-0">
                <Label className="text-xs text-muted-foreground">What this step assesses</Label>
                <Input
                  value={st.description}
                  onChange={(e) => onUpdateStep(st.id, { description: e.target.value })}
                  placeholder="Short label, e.g. Derive the objective function"
                  className="h-9"
                  disabled={disabled}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Marks</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={st.marks}
                  onChange={(e) =>
                    onUpdateStep(st.id, { marks: parseFloat(e.target.value) || 0 })
                  }
                  className="h-9 tabular-nums"
                  disabled={disabled}
                  title="Maximum marks for a fully correct answer"
                />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-end gap-1 border-t border-border/50 pt-2">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                disabled={disabled || idx === 0}
                onClick={() => onMoveStep(st.id, -1)}
                aria-label="Move step up"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                disabled={disabled || idx === question.steps.length - 1}
                onClick={() => onMoveStep(st.id, 1)}
                aria-label="Move step down"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive"
                disabled={disabled || question.steps.length <= 1}
                onClick={() => onRemoveStep(st.id)}
                aria-label="Remove step"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StageSetup({
  value,
  onChange,
  onNext,
}: {
  value: ExamSetup;
  onChange: (next: ExamSetup) => void;
  onNext: () => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const computedTotal = useMemo(() => sumMarks(value.questions), [value.questions]);

  function setStrictness(s: EvaluationStrictness) {
    onChange({ ...value, strictness: s });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = value.questions.findIndex((q) => q.id === active.id);
    const newIndex = value.questions.findIndex((q) => q.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange({ ...value, questions: arrayMove(value.questions, oldIndex, newIndex) });
  }

  function addQuestion() {
    const nextNo = Math.max(0, ...value.questions.map((q) => q.questionNo)) + 1;
    const questions = [...value.questions, defaultQuestion(nextNo)];
    onChange({
      ...value,
      questions,
      totalMarks: sumMarks(questions),
    });
  }

  function removeQuestion(id: string) {
    if (value.questions.length <= 1) return;
    const questions = value.questions.filter((q) => q.id !== id);
    onChange({ ...value, questions, totalMarks: sumMarks(questions) });
  }

  function updateQuestionNo(id: string, n: number) {
    onChange({
      ...value,
      questions: value.questions.map((q) => (q.id === id ? { ...q, questionNo: n } : q)),
    });
  }

  function addStep(qid: string) {
    const questions = value.questions.map((q) =>
      q.id === qid ? { ...q, steps: [...q.steps, createStepForQuestion(q.steps)] } : q
    );
    onChange({
      ...value,
      questions,
      totalMarks: sumMarks(questions),
    });
  }

  function updateStep(qid: string, stepId: string, patch: Partial<ExamStep>) {
    const questions = value.questions.map((q) => {
      if (q.id !== qid) return q;
      return {
        ...q,
        steps: q.steps.map((s) => {
          if (s.id !== stepId) return s;
          const next = { ...s, ...patch };
          if (next.marks < 0) next.marks = 0;
          return next;
        }),
      };
    });
    onChange({ ...value, questions, totalMarks: sumMarks(questions) });
  }

  function removeStep(qid: string, stepId: string) {
    const questions = value.questions.map((q) => {
      if (q.id !== qid) return q;
      if (q.steps.length <= 1) return q;
      return { ...q, steps: q.steps.filter((s) => s.id !== stepId) };
    });
    onChange({ ...value, questions, totalMarks: sumMarks(questions) });
  }

  function moveStep(qid: string, stepId: string, dir: -1 | 1) {
    const questions = value.questions.map((q) => {
      if (q.id !== qid) return q;
      const idx = q.steps.findIndex((s) => s.id === stepId);
      const ni = idx + dir;
      if (idx < 0 || ni < 0 || ni >= q.steps.length) return q;
      const steps = arrayMove(q.steps, idx, ni);
      return { ...q, steps };
    });
    onChange({ ...value, questions });
  }

  const canNext = value.name.trim() && value.subject.trim() && value.questions.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-[#01696f]/25 bg-[#01696f]/[0.06] px-4 py-3 text-sm">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#01696f]" aria-hidden />
        <p className="text-foreground/90">
          <span className="font-semibold text-[#01696f]">Tip:</span> For each sub-part, enter what it
          assesses and the maximum marks. The AI assigns partial credit using the{" "}
          <strong>evaluation strictness</strong> you choose below (exact vs conceptual vs generous
          partial credit).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Exam setup</CardTitle>
          <CardDescription>
            Step 1 — add questions and steps (sub-part label, what it assesses, maximum marks).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ae-exam-name">Exam name</Label>
              <Input
                id="ae-exam-name"
                value={value.name}
                onChange={(e) => onChange({ ...value, name: e.target.value })}
                placeholder="e.g. Mid-term — Data Structures"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ae-subject">Subject</Label>
              <Input
                id="ae-subject"
                value={value.subject}
                onChange={(e) => onChange({ ...value, subject: e.target.value })}
                placeholder="e.g. CS201"
              />
            </div>
            <div className="space-y-2">
              <Label>Exam date</Label>
              <DatePicker
                value={value.date}
                onChange={(d) => onChange({ ...value, date: d })}
                placeholder="Pick date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ae-total">Total marks</Label>
              <Input
                id="ae-total"
                type="number"
                min={1}
                value={value.totalMarks}
                onChange={(e) =>
                  onChange({ ...value, totalMarks: parseFloat(e.target.value) || 0 })
                }
              />
              <p className="text-xs text-muted-foreground">
                Sum from steps: <strong>{computedTotal}</strong>
                {computedTotal !== value.totalMarks && (
                  <span className="text-amber-700"> · differs from total field</span>
                )}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Evaluation strictness</Label>
            <div className="flex flex-wrap gap-2">
              {STRICTNESS_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setStrictness(opt.id)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-left text-sm font-medium transition-colors",
                    value.strictness === opt.id
                      ? "border-[#01696f] bg-[#01696f] text-white shadow-sm"
                      : "border-border bg-background hover:bg-muted/60"
                  )}
                >
                  <span className="block">{opt.label}</span>
                  <span
                    className={cn(
                      "mt-0.5 block text-xs font-normal",
                      value.strictness === opt.id ? "text-white/85" : "text-muted-foreground"
                    )}
                  >
                    {opt.hint}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Label className="text-base">Question builder</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Sub-part label, description, and marks — strictness controls how the AI awards
                  partial credit.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-[#01696f]/40 text-[#01696f] hover:bg-[#01696f]/10"
                onClick={addQuestion}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add question
              </Button>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext
                items={value.questions.map((q) => q.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-4">
                  {value.questions.map((q) => (
                    <SortableQuestionCard
                      key={q.id}
                      question={q}
                      onUpdateQuestionNo={(n) => updateQuestionNo(q.id, n)}
                      onRemoveQuestion={() => removeQuestion(q.id)}
                      onAddStep={() => addStep(q.id)}
                      onUpdateStep={(sid, patch) => updateStep(q.id, sid, patch)}
                      onRemoveStep={(sid) => removeStep(q.id, sid)}
                      onMoveStep={(sid, dir) => moveStep(q.id, sid, dir)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          <div className="flex justify-end border-t pt-4">
            <Button
              type="button"
              className="bg-[#01696f] text-white hover:bg-[#015a5f]"
              disabled={!canNext}
              onClick={onNext}
            >
              Continue to answer key
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
