"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  DndContext,
  DragOverlay,
  type DragCancelEvent,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Bookmark,
  Calendar,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  GripVertical,
  Hash,
  ImageDown,
  Library,
  Loader2,
  Pencil,
  Plus,
  Search,
  Table2,
  Tag,
  Trash2,
  Upload,
} from "lucide-react";
import { endOfDay, format, startOfDay, startOfYear, subDays } from "date-fns";
import { toast } from "sonner";
import { toJpeg } from "html-to-image";

import { createClient } from "@/lib/supabase/client";
import type { Profile, AdminSavedChart } from "@/lib/types";
import {
  ingestTabularFile,
  type FieldKind,
  type TabularDataset,
} from "@/lib/tabular-dataset";
import {
  fieldAcceptsCategoryAxis,
  fieldAcceptsMeasure,
} from "@/lib/dataset-field-inference";
import {
  aggregateByCategory,
  aggregateStackedByCategory,
  applyRowFilters,
  rowsForInvestigate,
  STACK_COLOR_BY_OTHER,
  uniqueColumnValues,
  type AggregateMode,
  type AggregatePoint,
  type CatRowFilter,
  type DateBin,
  type DateRowFilter,
  type NumRowFilter,
  type RowFilter,
} from "@/lib/admin-analytics-compute";
import {
  ADMIN_ANALYTICS_SNAPSHOT_VERSION,
  parseAdminAnalyticsSnapshot,
  type AdminAnalyticsChartSnapshot,
} from "@/lib/admin-analytics-snapshot";
import { toTitleCaseLabel } from "@/lib/analytics-camel";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const SLOT_CATEGORY = "slot-category";
const SLOT_MEASURE = "slot-measure";
const SLOT_FILTER_ADD = "slot-filter-add";

type ChartKind = "bar" | "table";
type BucketSort = "alpha_asc" | "alpha_desc" | "value_desc" | "value_asc";

function compareAlphaBuckets(a: string, b: string, sort: BucketSort): number {
  const c = a.localeCompare(b);
  return sort === "alpha_desc" ? -c : c;
}

function compareNumericMeasure(va: number, vb: number, sort: BucketSort): number {
  return sort === "value_asc" ? va - vb : vb - va;
}

const DEFAULT_MAX_CHART_BUCKETS = 20;
const MAX_CHART_BUCKETS_CAP = 2000;

const DEFAULT_MAX_COLOR_SEGMENTS = 10;
const MAX_COLOR_SEGMENTS_CAP = 50;

/** Internal key on stacked chart rows for bar total labels (not a stack segment). */
const STACK_TOTAL_KEY = "__stackTotal";

const STACK_HUES = [175, 217, 265, 305, 330, 32, 48, 142, 188, 205, 245, 280, 22, 350] as const;

function stackSeriesColor(index: number): string {
  const h = STACK_HUES[index % STACK_HUES.length];
  return `hsl(${h} 65% 48%)`;
}

function makeStackedBarInspectHandler(
  segmentKey: string,
  openInspect: (bucket: string, drill?: { colorSegment: string | null }) => void
): (state: unknown) => void {
  return (state: unknown) => {
    const p = (state as { payload?: { bucket?: string } })?.payload;
    if (p?.bucket == null) return;
    openInspect(String(p.bucket), { colorSegment: segmentKey });
  };
}

const KIND_LABEL: Record<FieldKind, string> = {
  categorical: "Category",
  numerical: "Number",
  date: "Date",
};

const DATE_BIN_OPTIONS: { value: DateBin; label: string }[] = [
  { value: "none", label: "None" },
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
];

const KIND_ICON: Record<FieldKind, typeof Tag> = {
  categorical: Tag,
  numerical: Hash,
  date: Calendar,
};

function formatAxisNumber(n: number) {
  if (!Number.isFinite(n)) return "";
  const rounded = Math.round(n * 100) / 100;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(rounded);
}

function truncateTickLabel(value: string, maxLen: number): string {
  const m = Math.floor(maxLen);
  if (!Number.isFinite(m) || m < 1) return value;
  if (value.length <= m) return value;
  if (m <= 3) return value.slice(0, m);
  return `${value.slice(0, m - 3)}...`;
}

function parseYAxisDomainToken(raw: string): number | "auto" | undefined {
  const s = raw.trim().toLowerCase();
  if (s === "" || s === "auto") return "auto";
  const n = Number.parseFloat(raw.trim());
  return Number.isFinite(n) ? n : undefined;
}

/** Recharts `domain` prop, or `undefined` to infer from data. */
function buildYAxisDomain(
  minRaw: string,
  maxRaw: string
): [number | string, number | string] | undefined {
  const a = parseYAxisDomainToken(minRaw);
  const b = parseYAxisDomainToken(maxRaw);
  if (a === undefined || b === undefined) return undefined;
  if (a === "auto" && b === "auto") return undefined;
  return [a === "auto" ? "auto" : a, b === "auto" ? "auto" : b];
}

/** Outlined field with label on the top border (Customize tab). */
function OutlineLabeledField({
  label,
  id,
  className,
  children,
}: {
  label: string;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative rounded-md border border-input bg-background px-2 pb-2 pt-2.5",
        className
      )}
    >
      <Label
        htmlFor={id}
        className="absolute -top-2.5 left-2 bg-background px-1 text-[10px] font-medium leading-none text-muted-foreground"
      >
        {label}
      </Label>
      {children}
    </div>
  );
}

function CustomizeAccordionSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/80 bg-muted/5">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/30"
      >
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {open ? <div className="border-t border-border/70 px-3 pb-3 pt-2">{children}</div> : null}
    </div>
  );
}

function CustomizeSubsection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2.5 rounded-md border border-border/60 bg-background/40 p-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-400/95">{title}</p>
      {children}
    </div>
  );
}

function formatTooltipBucketValue(
  bucket: string | number | undefined,
  categoryKind: FieldKind
): string {
  if (bucket === undefined || bucket === null) return "";
  const s = String(bucket);
  if (s === "(empty)") return "Empty";
  if (categoryKind === "date") return s;
  return toTitleCaseLabel(s);
}

/** Recharts 3 omits `label` for item-mode tooltips (`shared={false}`); bucket lives on the row payload. */
function tooltipChartRow(
  entry: { payload?: unknown } | undefined
): Record<string, unknown> | null {
  const p = entry?.payload;
  if (p && typeof p === "object" && !Array.isArray(p)) {
    return p as Record<string, unknown>;
  }
  return null;
}

function tooltipBucketRaw(
  label: string | number | undefined,
  row: Record<string, unknown> | null
): string | number | undefined {
  if (label !== undefined && label !== null && label !== "") return label;
  const b = row?.bucket;
  if (typeof b === "string" || typeof b === "number") return b;
  return undefined;
}

/** Stacked tooltip title: keep raw part codes (e.g. ALL CAPS) from the dataset. */
function stackedTooltipSegmentTitle(seg: string): string {
  const t = seg.trim();
  if (t === STACK_COLOR_BY_OTHER || /^\(\s*other\s*\)$/i.test(t)) return "Other";
  return t;
}

function measureFieldShowsCurrency(measureField: string | null): boolean {
  if (!measureField) return false;
  return /\bUSD\b|\(USD\)/i.test(measureField);
}

function formatBarTooltipMeasure(
  n: number,
  aggregate: AggregateMode,
  asCurrency: boolean
): string {
  if (!Number.isFinite(n)) return "";
  if (asCurrency) {
    const core = aggregate === "avg" ? n.toFixed(2) : formatAxisNumber(n);
    return `$${core}`;
  }
  if (aggregate === "avg") return n.toFixed(2);
  return formatAxisNumber(n);
}

function tooltipXAxisColumnTitle(xAxisLabelOverride: string, categoryField: string): string {
  const o = xAxisLabelOverride.trim();
  if (o) return o;
  return toTitleCaseLabel(categoryField);
}

function AdminStackedBarTooltip({
  active,
  payload,
  label,
  categoryField,
  categoryKind,
  yAxisTitle,
  aggregate,
  measureField,
  xAxisLabelOverride,
  colorByColumnTitle,
}: {
  active?: boolean;
  label?: string | number;
  payload?: ReadonlyArray<{
    value?: unknown;
    dataKey?: unknown;
    name?: unknown;
    color?: string;
    payload?: unknown;
  }>;
  categoryField: string;
  categoryKind: FieldKind;
  yAxisTitle: string;
  aggregate: AggregateMode;
  measureField: string;
  xAxisLabelOverride: string;
  colorByColumnTitle: string;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0]!;
  const row = tooltipChartRow(item);
  const segKey =
    typeof item.dataKey === "string" || typeof item.dataKey === "number"
      ? String(item.dataKey)
      : String(item.name ?? "");
  const cell = row && segKey && segKey !== STACK_TOTAL_KEY ? row[segKey] : undefined;
  const fromRow =
    typeof cell === "number"
      ? cell
      : typeof cell === "string"
        ? Number.parseFloat(cell)
        : Number.NaN;
  const raw = Number.isFinite(fromRow)
    ? fromRow
    : typeof item.value === "number"
      ? item.value
      : Number.parseFloat(String(item.value ?? ""));
  const asCurrency = aggregate !== "count" && measureFieldShowsCurrency(measureField);
  const color = item.color ?? "hsl(var(--muted-foreground))";
  const xColDisplay = tooltipXAxisColumnTitle(xAxisLabelOverride, categoryField);
  const bucketStr = formatTooltipBucketValue(tooltipBucketRaw(label, row), categoryKind);
  return (
    <div className="max-w-[min(100vw-2rem,18rem)] rounded-md border border-border/80 bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
      <div className="flex gap-2">
        <span
          className="mt-1 h-2.5 w-2.5 shrink-0 rounded-[2px]"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <div className="min-w-0 space-y-1">
          <p className="text-[13px] leading-snug">
            <span className="font-semibold text-foreground">{colorByColumnTitle}</span>
            <span className="text-muted-foreground">: </span>
            <span className="font-normal tabular-nums text-foreground">
              {stackedTooltipSegmentTitle(segKey)}
            </span>
          </p>
          <p className="text-[13px] leading-snug">
            <span className="font-semibold text-foreground">{xColDisplay}</span>
            <span className="text-muted-foreground">: </span>
            <span className="font-normal tabular-nums text-foreground">{bucketStr}</span>
          </p>
          <p className="text-[13px] leading-snug">
            <span className="font-semibold text-foreground">{yAxisTitle}</span>
            <span className="text-muted-foreground">: </span>
            <span className="font-normal tabular-nums text-foreground">
              {formatBarTooltipMeasure(raw, aggregate, asCurrency)}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

function AdminSingleBarTooltip({
  active,
  payload,
  label,
  categoryField,
  categoryKind,
  yAxisTitle,
  aggregate,
  measureField,
  barFill,
  xAxisLabelOverride,
}: {
  active?: boolean;
  label?: string | number;
  payload?: ReadonlyArray<{ value?: unknown; color?: string; payload?: unknown }>;
  categoryField: string;
  categoryKind: FieldKind;
  yAxisTitle: string;
  aggregate: AggregateMode;
  measureField: string;
  barFill: string;
  xAxisLabelOverride: string;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0]!;
  const row = tooltipChartRow(item);
  const cell = row?.value;
  const fromRow =
    typeof cell === "number"
      ? cell
      : typeof cell === "string"
        ? Number.parseFloat(cell)
        : Number.NaN;
  const raw = Number.isFinite(fromRow)
    ? fromRow
    : typeof item.value === "number"
      ? item.value
      : Number.parseFloat(String(item.value ?? ""));
  const asCurrency = aggregate !== "count" && measureFieldShowsCurrency(measureField);
  const color = item.color ?? barFill;
  const xColDisplay = tooltipXAxisColumnTitle(xAxisLabelOverride, categoryField);
  const bucketStr = formatTooltipBucketValue(tooltipBucketRaw(label, row), categoryKind);
  return (
    <div className="max-w-[min(100vw-2rem,18rem)] rounded-md border border-border/80 bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
      <div className="flex gap-2">
        <span
          className="mt-1 h-2.5 w-2.5 shrink-0 rounded-[2px]"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <div className="min-w-0 space-y-1">
          <p className="text-[13px] leading-snug">
            <span className="font-semibold text-foreground">{xColDisplay}</span>
            <span className="text-muted-foreground">: </span>
            <span className="font-normal tabular-nums text-foreground">{bucketStr}</span>
          </p>
          <p className="text-[13px] leading-snug">
            <span className="font-semibold text-foreground">{yAxisTitle}</span>
            <span className="text-muted-foreground">: </span>
            <span className="font-normal tabular-nums text-foreground">
              {formatBarTooltipMeasure(raw, aggregate, asCurrency)}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

function toFilterDayISO(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** Segmented control style (mockup: muted track, filled selected). */
function FilterSegmentChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-border bg-secondary text-secondary-foreground shadow-sm"
          : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function FilterQuickChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors",
        active
          ? "border-border bg-secondary text-secondary-foreground"
          : "border-border/60 bg-background/80 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function DraggableFieldRow({
  field,
  index,
  kind,
  used,
}: {
  field: string;
  index: number;
  kind: FieldKind;
  used: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `col-${index}`,
    data: { type: "column" as const, field, kind },
  });
  const Icon = KIND_ICON[kind];

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "flex cursor-grab touch-none items-center gap-1 rounded-md border bg-card px-1.5 py-1 text-sm shadow-sm transition-colors hover:bg-muted/50 active:cursor-grabbing",
        isDragging && "z-10 opacity-40 ring-2 ring-primary/40",
        used && "border-primary/50 bg-primary/5"
      )}
    >
      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 truncate font-medium select-none" title={field}>
        {toTitleCaseLabel(field)}
      </span>
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
    </div>
  );
}

function FieldDragPreview({ field, kind }: { field: string; kind: FieldKind }) {
  const Icon = KIND_ICON[kind];
  return (
    <div className="flex cursor-grabbing items-center gap-1 rounded-md border border-primary/40 bg-card px-2 py-1.5 text-sm shadow-xl ring-2 ring-primary/25">
      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="max-w-[200px] truncate font-medium">{toTitleCaseLabel(field)}</span>
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
    </div>
  );
}

function FieldsPane({
  dataset,
  usedFields,
  search,
  onSearchChange,
}: {
  dataset: TabularDataset;
  usedFields: Set<string>;
  search: string;
  onSearchChange: (v: string) => void;
}) {
  const byKind = useMemo(() => {
    const buckets: Record<FieldKind, string[]> = {
      categorical: [],
      numerical: [],
      date: [],
    };
    const q = search.trim().toLowerCase();
    for (const h of dataset.headers) {
      if (q && !h.toLowerCase().includes(q)) continue;
      buckets[dataset.kinds[h] ?? "categorical"].push(h);
    }
    return buckets;
  }, [dataset, search]);

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-border bg-muted/20">
      <div className="shrink-0 space-y-2 border-b border-border p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search Fields"
            className="h-9 pl-8 text-sm"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-3 pb-3 pt-0">
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">Fields</p>
        {( ["categorical", "numerical", "date"] as const ).map((kind) => {
          const list = byKind[kind];
          if (list.length === 0) return null;
          const Icon = KIND_ICON[kind];
          return (
            <div key={kind}>
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Icon className="h-3 w-3" aria-hidden />
                {KIND_LABEL[kind]} ({list.length})
              </div>
              <div className="flex flex-col gap-1">
                {list.map((field) => {
                  const i = dataset.headers.indexOf(field);
                  return (
                    <DraggableFieldRow
                      key={field}
                      field={field}
                      index={i}
                      kind={kind}
                      used={usedFields.has(field)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SourceDatasetBadge({ label }: { label: string }) {
  const display = label.trim() || "Dataset";
  const short = display.length > 24 ? `${display.slice(0, 21)}…` : display;
  return (
    <Badge
      variant="secondary"
      className="w-fit max-w-full truncate border border-border/60 bg-muted/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
      title={display}
    >
      {short}
    </Badge>
  );
}

function SortAzHashToggle({
  bucketSort,
  onChange,
  disabled,
}: {
  bucketSort: BucketSort;
  onChange: (v: BucketSort) => void;
  disabled?: boolean;
}) {
  const isAlpha = bucketSort === "alpha_asc" || bucketSort === "alpha_desc";
  const isValue = bucketSort === "value_desc" || bucketSort === "value_asc";
  const onAlphaClick = () => {
    if (bucketSort === "alpha_asc") onChange("alpha_desc");
    else if (bucketSort === "alpha_desc") onChange("alpha_asc");
    else onChange("alpha_asc");
  };
  const onValueClick = () => {
    if (bucketSort === "value_desc") onChange("value_asc");
    else if (bucketSort === "value_asc") onChange("value_desc");
    else onChange("value_desc");
  };
  return (
    <div className="inline-flex w-full max-w-[220px] rounded-lg border border-border bg-muted/40 p-0.5">
      <button
        type="button"
        disabled={disabled}
        onClick={onAlphaClick}
        className={cn(
          "flex flex-1 items-center justify-center gap-0.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50",
          isAlpha
            ? "border border-primary bg-primary/10 text-primary shadow-sm"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        )}
      >
        <span className="text-[10px] leading-none">
          {bucketSort === "alpha_desc" ? "↓" : "↑"}
        </span>
        <span>AZ</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onValueClick}
        className={cn(
          "flex flex-1 items-center justify-center gap-0.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50",
          isValue
            ? "border border-primary bg-primary/10 text-primary shadow-sm"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        )}
      >
        <span className="text-[10px] leading-none">
          {bucketSort === "value_asc" ? "↑" : "↓"}
        </span>
        <span>#</span>
      </button>
    </div>
  );
}

/**
 * Human-readable color-by legend label (handles repr-like `['a', 'b']` cell values).
 */
function formatColorByLegendSegment(segmentKey: string): string {
  const t = segmentKey.trim();
  if (t === STACK_COLOR_BY_OTHER || /^\(\s*other\s*\)$/i.test(t)) {
    return "Other";
  }
  if (t.startsWith("[") && t.endsWith("]")) {
    const inner = t.slice(1, -1);
    const sq = [...inner.matchAll(/'([^']*)'/g)].map((m) => m[1]);
    if (sq.length > 0) {
      return sq.map((p) => toTitleCaseLabel(p.trim())).join(" · ");
    }
    const dq = [...inner.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
    if (dq.length > 0) {
      return dq.map((p) => toTitleCaseLabel(p.trim())).join(" · ");
    }
  }
  return toTitleCaseLabel(t);
}

function StackLegendBar({
  colorByColumn,
  measureTitle,
  segments,
  activeSegments,
  onSegmentClick,
  onClearSelection,
}: {
  colorByColumn: string;
  measureTitle: string;
  segments: string[];
  activeSegments: string[];
  onSegmentClick: (segment: string) => void;
  onClearSelection: () => void;
}) {
  if (segments.length === 0) return null;
  const activeSet = new Set(activeSegments);
  const heading = `${toTitleCaseLabel(colorByColumn)} · ${measureTitle}`;
  const hasSelection = activeSegments.length > 0;
  return (
    <aside className="flex max-h-full min-h-0 w-[min(15.5rem,40vw)] shrink-0 flex-col border-l border-border/70 bg-muted/10 pl-3 pr-1 pt-1">
      <p
        className="mb-2 line-clamp-2 shrink-0 border-b border-border/60 pb-2 text-left text-[11px] font-semibold leading-snug text-foreground"
        title={heading}
      >
        {heading}
      </p>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-y-contain py-1 pr-1">
        {segments.map((seg, i) => {
          const isOther = seg === STACK_COLOR_BY_OTHER;
          const active = !isOther && activeSet.has(seg);
          return (
            <button
              key={seg}
              type="button"
              disabled={isOther}
              title={isOther ? "Combined smaller categories" : formatColorByLegendSegment(seg)}
              onClick={() => {
                if (!isOther) onSegmentClick(seg);
              }}
              className={cn(
                "flex w-full min-w-0 items-start gap-2 rounded-md px-1.5 py-1 text-left text-[11px] leading-snug transition-colors",
                isOther
                  ? "cursor-default text-muted-foreground opacity-90"
                  : active
                    ? "bg-primary/12 text-foreground ring-1 ring-primary/35"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <span
                className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-[2px] border border-border/50 shadow-sm"
                style={{ background: stackSeriesColor(i) }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 break-words">{formatColorByLegendSegment(seg)}</span>
            </button>
          );
        })}
      </div>
      <div className="shrink-0 border-t border-border/60 pt-2 pb-1">
        <button
          type="button"
          disabled={!hasSelection}
          onClick={onClearSelection}
          className={cn(
            "w-full py-1.5 text-center text-[11px] font-medium transition-colors",
            hasSelection
              ? "text-amber-600 hover:text-amber-500 hover:underline dark:text-amber-400 dark:hover:text-amber-300"
              : "cursor-default text-muted-foreground/50"
          )}
        >
          Clear selection
        </button>
      </div>
    </aside>
  );
}

function SeriesAxisCard({
  variant,
  slotId,
  value,
  kind,
  sourceLabel,
  onClear,
  emptyHint,
  bucketSort,
  onBucketSortChange,
  dateBin,
  onDateBinChange,
  aggregate,
  onAggregateChange,
  colorByField,
  onColorByFieldChange,
  colorByOptions,
}: {
  variant: "x" | "y";
  slotId: string;
  value: string | null;
  kind: FieldKind | null;
  sourceLabel: string;
  onClear: () => void;
  emptyHint: string;
  bucketSort: BucketSort;
  onBucketSortChange: (v: BucketSort) => void;
  dateBin: DateBin;
  onDateBinChange: (b: DateBin) => void;
  aggregate: AggregateMode;
  onAggregateChange: (a: AggregateMode) => void;
  /** Y-axis only */
  colorByField?: string | null;
  onColorByFieldChange?: (field: string | null) => void;
  colorByOptions?: string[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId });
  const filled = Boolean(value);

  return (
    <div className="rounded-lg border border-border bg-card/60 p-3 shadow-sm">
      <Label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {variant === "x" ? "X-axis" : "Y-axis"}
      </Label>
      {!filled ? (
        <div
          ref={setNodeRef}
          className={cn(
            "relative flex min-h-[4.25rem] items-center rounded-lg border border-dashed border-muted-foreground/35 bg-muted/15 px-3 py-3 text-xs leading-snug text-muted-foreground transition-colors",
            isOver && "border-primary bg-primary/5 text-foreground ring-2 ring-primary/20",
            variant === "y" && "pr-10"
          )}
        >
          <span className="pr-1">{emptyHint}</span>
          {variant === "y" ? (
            <Pencil
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70"
              aria-hidden
            />
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="truncate text-sm font-semibold text-foreground" title={value ?? ""}>
                {value ?? ""}
              </p>
              <SourceDatasetBadge label={sourceLabel} />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-muted-foreground"
              aria-label={`Remove ${variant === "x" ? "X" : "Y"} field`}
              onClick={onClear}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {variant === "x" ? (
            <>
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">Sort</span>
                <SortAzHashToggle bucketSort={bucketSort} onChange={onBucketSortChange} />
              </div>
              {kind === "date" ? (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Binning</Label>
                  <Select value={dateBin} onValueChange={(v) => onDateBinChange(v as DateBin)}>
                    <SelectTrigger className="h-9 w-full min-w-0 font-normal">
                      <SelectValue className="min-w-0 truncate">
                        {DATE_BIN_OPTIONS.find((o) => o.value === dateBin)?.label ?? dateBin}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_BIN_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Aggregate</Label>
                <Select value={aggregate} onValueChange={(v) => onAggregateChange(v as AggregateMode)}>
                  <SelectTrigger className="h-9 w-full min-w-0 font-normal">
                    <SelectValue className="min-w-0 truncate">
                      {aggregate === "count"
                        ? "Count"
                        : aggregate === "sum"
                          ? "Sum"
                          : "Average"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="count">Count</SelectItem>
                    <SelectItem value="sum">Sum</SelectItem>
                    <SelectItem value="avg">Average</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Color By</Label>
                <Select
                  value={colorByField ?? "__none__"}
                  onValueChange={(v) => onColorByFieldChange?.(v === "__none__" ? null : v)}
                >
                  <SelectTrigger className="h-9 w-full min-w-0 font-normal">
                    <SelectValue placeholder="None" className="min-w-0 truncate">
                      {colorByField ?? "None"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {(colorByOptions ?? []).map((col) => (
                      <SelectItem key={col} value={col}>
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function newFilterId() {
  return `f-${Math.random().toString(36).slice(2, 10)}`;
}

function summarizeFilter(f: RowFilter): string {
  const col = toTitleCaseLabel(f.column);
  if (f.kind === "categorical") {
    const mode = f.mode === "not_in" ? "Not In" : "In";
    if (f.values.length === 0) return `${col} (${mode})`;
    const vs = f.values.join(", ");
    return `${col} ${mode} (${vs})`;
  }
  if (f.kind === "numerical") {
    if (f.op === "between") return `${col} Between ${f.a} And ${f.b ?? ""}`;
    const sym = f.op === "gt" ? ">" : f.op === "lt" ? "<" : "=";
    return `${col} ${sym} ${f.a}`;
  }
  if (f.op === "between") return `${col} In (${f.a} – ${f.b ?? ""})`;
  const word = f.op === "before" ? "Before" : "After";
  return `${col} ${word} ${f.a}`;
}

function FilterDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: SLOT_FILTER_ADD });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[3rem] items-center justify-center rounded-lg border border-dashed border-muted-foreground/35 bg-muted/10 px-3 py-3 text-center text-xs font-medium text-muted-foreground transition-colors",
        isOver && "border-primary bg-primary/5 text-foreground ring-2 ring-primary/25"
      )}
    >
      {"Drag & drop field(s)"}
    </div>
  );
}

function AnalyticsFilterCard({
  filter,
  dataset,
  onChange,
  onRemove,
}: {
  filter: RowFilter;
  dataset: TabularDataset;
  onChange: (next: RowFilter) => void;
  onRemove: () => void;
}) {
  const title = toTitleCaseLabel(filter.column);

  if (filter.kind === "categorical") {
    return (
      <CategoricalFilterCard filter={filter} title={title} dataset={dataset} onChange={onChange} onRemove={onRemove} />
    );
  }
  if (filter.kind === "numerical") {
    return <NumericalFilterCard filter={filter} title={title} onChange={onChange} onRemove={onRemove} />;
  }
  return <DateFilterCard filter={filter} title={title} onChange={onChange} onRemove={onRemove} />;
}

function CategoricalFilterCard({
  filter,
  title,
  dataset,
  onChange,
  onRemove,
}: {
  filter: CatRowFilter;
  title: string;
  dataset: TabularDataset;
  onChange: (next: RowFilter) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const optionValues = useMemo(
    () => uniqueColumnValues(dataset.rows, filter.column),
    [dataset.rows, filter.column]
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return optionValues;
    return optionValues.filter((v) => v.toLowerCase().includes(q));
  }, [optionValues, query]);

  const mode = filter.mode === "not_in" ? "not_in" : "in";
  const needsOptions = filter.values.length === 0;

  const toggle = (v: string) => {
    const set = new Set(filter.values);
    if (set.has(v)) set.delete(v);
    else set.add(v);
    onChange({ ...filter, values: [...set] });
  };

  const selectAllShown = () => {
    const next = new Set(filter.values);
    for (const v of filtered) next.add(v);
    onChange({ ...filter, values: [...next] });
  };

  const clearAll = () => {
    onChange({ ...filter, values: [] });
  };

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold text-foreground" title={filter.column}>
          {title}
        </p>
        <Button type="button" variant="ghost" size="icon-sm" className="shrink-0" aria-label="Remove filter" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1">
        <FilterSegmentChip active={mode === "in"} onClick={() => onChange({ ...filter, mode: "in" })}>
          Is In
        </FilterSegmentChip>
        <FilterSegmentChip active={mode === "not_in"} onClick={() => onChange({ ...filter, mode: "not_in" })}>
          Is Not In
        </FilterSegmentChip>
      </div>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className={cn(
                "h-9 w-full min-w-0 justify-between px-3 font-normal",
                needsOptions && "border-destructive/50 ring-1 ring-destructive/20"
              )}
              aria-expanded={open}
            >
              <span className={cn("min-w-0 flex-1 truncate text-left", needsOptions && "text-muted-foreground")}>
                {filter.values.length === 0
                  ? "Choose Values"
                  : filter.values.length === 1
                    ? filter.values[0]
                    : `${filter.values.length} Values Selected`}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          }
        />
        <PopoverContent align="start" className="w-80 p-2">
          <Input
            className="mb-2 h-8"
            placeholder="Search Values"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="mb-2 flex gap-2">
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={selectAllShown}>
              Select All Shown
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={clearAll}>
              Clear
            </Button>
          </div>
          <div className="max-h-52 space-y-0.5 overflow-y-auto rounded-md border border-border/60 p-1.5">
            {filtered.length === 0 ? (
              <p className="px-1 py-2 text-xs text-muted-foreground">No Matching Values</p>
            ) : (
              filtered.map((v) => (
                <label
                  key={v}
                  className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted/60"
                >
                  <input
                    type="checkbox"
                    className="size-3.5 rounded border-input"
                    checked={filter.values.includes(v)}
                    onChange={() => toggle(v)}
                  />
                  <span className="min-w-0 truncate">{v}</span>
                </label>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function NumericalFilterCard({
  filter,
  title,
  onChange,
  onRemove,
}: {
  filter: NumRowFilter;
  title: string;
  onChange: (next: RowFilter) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold text-foreground" title={filter.column}>
          {title}
        </p>
        <Button type="button" variant="ghost" size="icon-sm" className="shrink-0" aria-label="Remove filter" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1">
        <FilterSegmentChip active={filter.op === "lt"} onClick={() => onChange({ ...filter, op: "lt" })}>
          &lt;
        </FilterSegmentChip>
        <FilterSegmentChip active={filter.op === "gt"} onClick={() => onChange({ ...filter, op: "gt" })}>
          &gt;
        </FilterSegmentChip>
        <FilterSegmentChip active={filter.op === "eq"} onClick={() => onChange({ ...filter, op: "eq" })}>
          =
        </FilterSegmentChip>
        <FilterSegmentChip active={filter.op === "between"} onClick={() => onChange({ ...filter, op: "between" })}>
          Between
        </FilterSegmentChip>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          className="h-9"
          inputMode="decimal"
          value={filter.a}
          onChange={(e) => onChange({ ...filter, a: e.target.value })}
          placeholder="Value"
        />
        {filter.op === "between" ? (
          <Input
            className="h-9"
            inputMode="decimal"
            value={filter.b ?? ""}
            onChange={(e) => onChange({ ...filter, b: e.target.value })}
            placeholder="To"
          />
        ) : null}
      </div>
    </div>
  );
}

function dateQuickPresetActive(f: DateRowFilter, preset: string): boolean {
  if (preset === "all") return !f.a?.trim();
  if (f.op !== "between" || !f.a?.trim() || !f.b?.trim()) return false;
  const todayStart = startOfDay(new Date());
  const endD = endOfDay(new Date());
  const a = f.a.slice(0, 10);
  const b = (f.b ?? "").slice(0, 10);
  const expect = (days: number) =>
    a === toFilterDayISO(startOfDay(subDays(todayStart, days - 1))) && b === toFilterDayISO(endD);
  if (preset === "7d") return expect(7);
  if (preset === "30d") return expect(30);
  if (preset === "60d") return expect(60);
  if (preset === "90d") return expect(90);
  if (preset === "ytd")
    return a === toFilterDayISO(startOfYear(todayStart)) && b === toFilterDayISO(endD);
  if (preset === "1y")
    return a === toFilterDayISO(startOfDay(subDays(todayStart, 364))) && b === toFilterDayISO(endD);
  return false;
}

function DateFilterCard({
  filter,
  title,
  onChange,
  onRemove,
}: {
  filter: DateRowFilter;
  title: string;
  onChange: (next: RowFilter) => void;
  onRemove: () => void;
}) {
  const applyPreset = (key: "7d" | "30d" | "60d" | "90d" | "ytd" | "1y" | "all") => {
    if (key === "all") {
      onChange({ ...filter, op: "after", a: "", b: undefined });
      return;
    }
    const todayStart = startOfDay(new Date());
    const endD = endOfDay(new Date());
    if (key === "ytd") {
      onChange({
        ...filter,
        op: "between",
        a: toFilterDayISO(startOfYear(todayStart)),
        b: toFilterDayISO(endD),
      });
      return;
    }
    if (key === "1y") {
      onChange({
        ...filter,
        op: "between",
        a: toFilterDayISO(startOfDay(subDays(todayStart, 364))),
        b: toFilterDayISO(endD),
      });
      return;
    }
    const days = key === "7d" ? 7 : key === "30d" ? 30 : key === "60d" ? 60 : 90;
    onChange({
      ...filter,
      op: "between",
      a: toFilterDayISO(startOfDay(subDays(todayStart, days - 1))),
      b: toFilterDayISO(endD),
    });
  };

  const opIsBetween = filter.op === "between";

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold text-foreground" title={filter.column}>
          {title}
        </p>
        <Button type="button" variant="ghost" size="icon-sm" className="shrink-0" aria-label="Remove filter" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {(
          [
            ["7d", "7 Days"],
            ["30d", "30 Days"],
            ["60d", "60 Days"],
            ["90d", "90 Days"],
            ["ytd", "Year To Date"],
            ["1y", "1 Year"],
            ["all", "All Time"],
          ] as const
        ).map(([key, label]) => (
          <FilterQuickChip key={key} active={dateQuickPresetActive(filter, key)} onClick={() => applyPreset(key)}>
            {label}
          </FilterQuickChip>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        <FilterSegmentChip
          active={filter.op === "before"}
          onClick={() => onChange({ ...filter, op: "before", b: undefined })}
        >
          Before
        </FilterSegmentChip>
        <FilterSegmentChip
          active={filter.op === "after"}
          onClick={() => onChange({ ...filter, op: "after", b: undefined })}
        >
          After
        </FilterSegmentChip>
        <FilterSegmentChip
          active={opIsBetween}
          onClick={() =>
            onChange({
              ...filter,
              op: "between",
              a: filter.a || "",
              b: filter.b || filter.a || "",
            })
          }
        >
          In
        </FilterSegmentChip>
      </div>
      <div className="space-y-2">
        {opIsBetween ? (
          <>
            <DatePicker value={filter.a} onChange={(a) => onChange({ ...filter, a })} placeholder="Date" className="h-9" />
            <DatePicker
              value={filter.b ?? ""}
              onChange={(b) => onChange({ ...filter, b })}
              placeholder="End Date"
              className="h-9"
            />
          </>
        ) : (
          <DatePicker value={filter.a} onChange={(a) => onChange({ ...filter, a })} placeholder="Date" className="h-9" />
        )}
      </div>
    </div>
  );
}

function FilterTabPanel({
  dataset,
  filters,
  setFilters,
}: {
  dataset: TabularDataset;
  filters: RowFilter[];
  setFilters: Dispatch<SetStateAction<RowFilter[]>>;
}) {
  const [filterSetOpen, setFilterSetOpen] = useState(true);

  const updateFilter = useCallback(
    (id: string, next: RowFilter) => {
      setFilters((prev) => prev.map((x) => (x.id === id ? next : x)));
    },
    [setFilters]
  );

  const removeFilter = useCallback(
    (id: string) => {
      setFilters((prev) => prev.filter((x) => x.id !== id));
    },
    [setFilters]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <p className="text-xs text-muted-foreground">Filters Apply To The Chart And Record Popups. Drag A Field Below To Add.</p>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-lg border border-border bg-muted/15">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2 text-left text-sm font-semibold text-foreground hover:bg-muted/50"
          onClick={() => setFilterSetOpen((o) => !o)}
        >
          <span>Set A</span>
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 transition-transform", !filterSetOpen && "-rotate-90")}
          />
        </button>
        {filterSetOpen ? (
          <div className="space-y-3 px-3 pt-1">
            {filters.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No Filters Yet — Drag A Field From The Left Into The Zone Below.
              </p>
            ) : (
              filters.map((f) => (
                <AnalyticsFilterCard
                  key={f.id}
                  filter={f}
                  dataset={dataset}
                  onChange={(next) => updateFilter(f.id, next)}
                  onRemove={() => removeFilter(f.id)}
                />
              ))
            )}
          </div>
        ) : null}
        <div className="p-3 pt-0">
          <FilterDropZone />
        </div>
      </div>
    </div>
  );
}

export function AdminAnalyticsPanel({ profile }: { profile: Profile }) {
  const uploadId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dataset, setDataset] = useState<TabularDataset | null>(null);
  const [fileLabel, setFileLabel] = useState<string>("");

  const [categoryField, setCategoryField] = useState<string | null>(null);
  const [measureField, setMeasureField] = useState<string | null>(null);
  const [aggregate, setAggregate] = useState<AggregateMode>("count");
  const [chartKind, setChartKind] = useState<ChartKind>("bar");
  const [bucketSort, setBucketSort] = useState<BucketSort>("value_desc");
  const [maxChartResults, setMaxChartResults] = useState(DEFAULT_MAX_CHART_BUCKETS);
  const [maxColorBySegments, setMaxColorBySegments] = useState(DEFAULT_MAX_COLOR_SEGMENTS);
  const [filters, setFilters] = useState<RowFilter[]>([]);
  const [dateBinning, setDateBinning] = useState<DateBin>("month");
  const [series1Open, setSeries1Open] = useState(true);
  const [colorByField, setColorByField] = useState<string | null>(null);
  const [showBarValueLabels, setShowBarValueLabels] = useState(false);
  const [chartBarColorHex, setChartBarColorHex] = useState("");
  const [customizeGeneralOpen, setCustomizeGeneralOpen] = useState(true);
  const [customizeAllSeriesOpen, setCustomizeAllSeriesOpen] = useState(false);
  const [customizeThemeOpen, setCustomizeThemeOpen] = useState(false);
  const [chartFontSize, setChartFontSize] = useState(12);
  const [xAxisLabelOverride, setXAxisLabelOverride] = useState("");
  const [xAxisLabelMaxLen, setXAxisLabelMaxLen] = useState(17);
  const [yAxisLabelOverride, setYAxisLabelOverride] = useState("");
  const [yAxisLabelMaxLen, setYAxisLabelMaxLen] = useState(17);
  const [yScaleMin, setYScaleMin] = useState("auto");
  const [yScaleMax, setYScaleMax] = useState("auto");
  const [includeStackedOther, setIncludeStackedOther] = useState(true);
  const [limitRecentRows, setLimitRecentRows] = useState(false);
  const [recentRowCount, setRecentRowCount] = useState(5000);
  const [yAxisTargets, setYAxisTargets] = useState<number[]>([]);

  const [fieldSearch, setFieldSearch] = useState("");
  const [inspectBucket, setInspectBucket] = useState<string | null>(null);
  /** Stacked-bar drill-down: filter records to this color-by segment (raw segment key). */
  const [inspectColorSegment, setInspectColorSegment] = useState<string | null>(null);
  const [activeFieldDrag, setActiveFieldDrag] = useState<{ field: string; kind: FieldKind } | null>(null);

  const chartExportRef = useRef<HTMLDivElement>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveTitleInput, setSaveTitleInput] = useState("");
  const [savedChartsOpen, setSavedChartsOpen] = useState(false);
  const [savedCharts, setSavedCharts] = useState<AdminSavedChart[]>([]);
  const [savedChartsLoading, setSavedChartsLoading] = useState(false);
  const [saveSubmitting, setSaveSubmitting] = useState(false);
  const [exportingJpeg, setExportingJpeg] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } })
  );

  useEffect(() => {
    if (!dataset || !measureField) return;
    const k = dataset.kinds[measureField] ?? "categorical";
    if ((aggregate === "sum" || aggregate === "avg") && k !== "numerical") {
      setMeasureField(null);
    }
  }, [aggregate, dataset, measureField]);

  useEffect(() => {
    if (colorByField && categoryField && colorByField === categoryField) {
      setColorByField(null);
    }
  }, [categoryField, colorByField]);

  const colorByOptions = useMemo(() => {
    if (!dataset) return [];
    return dataset.headers.filter(
      (h) => (dataset.kinds[h] ?? "categorical") === "categorical" && h !== categoryField
    );
  }, [dataset, categoryField]);

  useEffect(() => {
    if (colorByField && !colorByOptions.includes(colorByField)) {
      setColorByField(null);
    }
  }, [colorByField, colorByOptions]);

  const filteredRows = useMemo(() => {
    if (!dataset) return [];
    return applyRowFilters(dataset.rows, filters);
  }, [dataset, filters]);

  const chartSourceRows = useMemo(() => {
    if (!limitRecentRows) return filteredRows;
    const n = Math.max(1, Math.floor(recentRowCount) || 1);
    return filteredRows.slice(-n);
  }, [filteredRows, limitRecentRows, recentRowCount]);

  const series = useMemo((): AggregatePoint[] => {
    if (!dataset || !categoryField || !measureField) return [];
    const categoryKind = (dataset.kinds[categoryField] ?? "categorical") as FieldKind;
    return aggregateByCategory(chartSourceRows, categoryField, {
      categoryKind,
      dateBin: dateBinning,
      measureField,
      aggregate,
    });
  }, [dataset, categoryField, measureField, aggregate, chartSourceRows, dateBinning]);

  const effectiveMaxColorSegments = useMemo(() => {
    return Math.min(
      MAX_COLOR_SEGMENTS_CAP,
      Math.max(2, Math.floor(Number(maxColorBySegments)) || DEFAULT_MAX_COLOR_SEGMENTS)
    );
  }, [maxColorBySegments]);

  const stackedAggFiltered = useMemo(() => {
    if (!dataset || !categoryField || !measureField || !colorByField) return null;
    const categoryKind = (dataset.kinds[categoryField] ?? "categorical") as FieldKind;
    return aggregateStackedByCategory(chartSourceRows, categoryField, colorByField, {
      categoryKind,
      dateBin: dateBinning,
      measureField,
      aggregate,
      maxColorSegments: effectiveMaxColorSegments,
    });
  }, [
    dataset,
    categoryField,
    measureField,
    colorByField,
    chartSourceRows,
    dateBinning,
    aggregate,
    effectiveMaxColorSegments,
  ]);

  const stackedChartPresentation = useMemo(() => {
    if (!stackedAggFiltered) return null;
    const segmentsAll = stackedAggFiltered.segments;
    const chartSegments = includeStackedOther
      ? segmentsAll
      : segmentsAll.filter((s) => s !== STACK_COLOR_BY_OTHER);
    const cap = Math.min(
      MAX_CHART_BUCKETS_CAP,
      Math.max(1, Math.floor(Number(maxChartResults)) || DEFAULT_MAX_CHART_BUCKETS)
    );
    const rows = stackedAggFiltered.rows.map((r) => {
      const flat: Record<string, string | number> = { bucket: r.bucket, [STACK_TOTAL_KEY]: 0 };
      let total = 0;
      for (const seg of chartSegments) {
        const v = r.valuesBySegment[seg] ?? 0;
        flat[seg] = v;
        total += v;
      }
      flat[STACK_TOTAL_KEY] = total;
      return flat;
    });
    if (bucketSort.startsWith("alpha")) {
      rows.sort((a, b) =>
        compareAlphaBuckets(String(a.bucket), String(b.bucket), bucketSort)
      );
    } else {
      rows.sort((a, b) =>
        compareNumericMeasure(
          a[STACK_TOTAL_KEY] as number,
          b[STACK_TOTAL_KEY] as number,
          bucketSort
        )
      );
    }
    return { chartRows: rows.slice(0, cap), segments: chartSegments };
  }, [stackedAggFiltered, bucketSort, maxChartResults, includeStackedOther]);

  const displaySeries = useMemo(() => {
    const s = [...series];
    if (bucketSort.startsWith("alpha")) {
      s.sort((a, b) => compareAlphaBuckets(a.bucket, b.bucket, bucketSort));
    } else {
      s.sort((a, b) => compareNumericMeasure(a.value, b.value, bucketSort));
    }
    return s;
  }, [series, bucketSort]);

  const visibleSeries = useMemo(() => {
    const cap = Math.min(
      MAX_CHART_BUCKETS_CAP,
      Math.max(1, Math.floor(Number(maxChartResults)) || DEFAULT_MAX_CHART_BUCKETS)
    );
    return displaySeries.slice(0, cap);
  }, [displaySeries, maxChartResults]);

  const usedFields = useMemo(() => {
    const s = new Set<string>();
    if (categoryField) s.add(categoryField);
    if (measureField) s.add(measureField);
    if (colorByField) s.add(colorByField);
    for (const f of filters) s.add(f.column);
    return s;
  }, [categoryField, measureField, colorByField, filters]);

  const legendSelectedSegments = useMemo((): string[] => {
    if (!colorByField) return [];
    const merged = new Set<string>();
    for (const f of filters) {
      if (f.kind === "categorical" && f.column === colorByField && f.mode === "in") {
        for (const v of f.values) merged.add(v);
      }
    }
    return [...merged];
  }, [filters, colorByField]);

  const onLegendSegmentClick = useCallback((segment: string) => {
    if (!colorByField) return;
    setFilters((prev) => {
      const onCol = prev.filter(
        (f): f is CatRowFilter => f.kind === "categorical" && f.column === colorByField
      );
      const without = prev.filter((f) => !(f.kind === "categorical" && f.column === colorByField));

      const hasNotIn = onCol.some((f) => f.mode === "not_in");
      const current = new Set<string>();
      if (!hasNotIn) {
        for (const f of onCol) {
          if (f.mode === "in") {
            for (const v of f.values) current.add(v);
          }
        }
      }

      if (current.has(segment)) current.delete(segment);
      else current.add(segment);

      const nextVals = [...current];
      if (nextVals.length === 0) return without;

      const keptId = onCol.find((f) => f.mode === "in")?.id ?? newFilterId();
      const nextFilter: CatRowFilter = {
        id: keptId,
        kind: "categorical",
        column: colorByField,
        values: nextVals,
        mode: "in",
      };
      return [...without, nextFilter];
    });
  }, [colorByField]);

  const onLegendClearSelection = useCallback(() => {
    if (!colorByField) return;
    setFilters((prev) => prev.filter((f) => !(f.kind === "categorical" && f.column === colorByField)));
  }, [colorByField]);

  const yAxisTitle = useMemo(() => {
    if (aggregate === "count") {
      if (measureField) return `Count Of ${toTitleCaseLabel(measureField)}`;
      return "Count";
    }
    if (measureField) {
      const t = toTitleCaseLabel(measureField);
      if (aggregate === "sum") return `Sum Of ${t}`;
      return `Average Of ${t}`;
    }
    return "Value";
  }, [aggregate, measureField]);

  const chartTitle = useMemo(() => {
    if (!categoryField) return "Chart Preview";
    if (!measureField) return `${toTitleCaseLabel(categoryField)} Vs ...`;
    return `${toTitleCaseLabel(categoryField)} Vs ${yAxisTitle}`;
  }, [categoryField, measureField, yAxisTitle]);

  const onFile = useCallback(async (file: File | null) => {
    if (!file) return;
    const ok =
      /\.(csv|json)$/i.test(file.name) ||
      file.type === "text/csv" ||
      file.type === "application/json";
    if (!ok) {
      toast.error("Upload A CSV Or JSON File");
      return;
    }
    try {
      const text = await file.text();
      const ds = ingestTabularFile(text, file.name);
      if (ds.headers.length === 0) {
        toast.error("Could Not Read Columns");
        return;
      }
      setDataset(ds);
      setFileLabel(file.name);
      setCategoryField(null);
      setMeasureField(null);
      setFilters([]);
      setInspectBucket(null);
      setInspectColorSegment(null);
      setFieldSearch("");
      setDateBinning("month");
      setBucketSort("value_desc");
      setShowBarValueLabels(false);
      setChartBarColorHex("");
      setColorByField(null);
      setMaxColorBySegments(DEFAULT_MAX_COLOR_SEGMENTS);
      setCustomizeGeneralOpen(true);
      setCustomizeAllSeriesOpen(false);
      setCustomizeThemeOpen(false);
      setChartFontSize(12);
      setXAxisLabelOverride("");
      setXAxisLabelMaxLen(17);
      setYAxisLabelOverride("");
      setYAxisLabelMaxLen(17);
      setYScaleMin("auto");
      setYScaleMax("auto");
      setIncludeStackedOther(true);
      setLimitRecentRows(false);
      setRecentRowCount(5000);
      setYAxisTargets([]);
      toast.success(`Loaded ${ds.rows.length} rows · ${ds.headers.length} columns`);
    } catch (e) {
      console.error(e);
      toast.error("Failed To Read File");
    }
  }, []);

  const clearDataset = useCallback(() => {
    setDataset(null);
    setFileLabel("");
    setCategoryField(null);
    setMeasureField(null);
    setFilters([]);
    setInspectBucket(null);
    setInspectColorSegment(null);
    setFieldSearch("");
    setDateBinning("month");
    setBucketSort("value_desc");
    setShowBarValueLabels(false);
    setChartBarColorHex("");
    setColorByField(null);
    setMaxColorBySegments(DEFAULT_MAX_COLOR_SEGMENTS);
    setCustomizeGeneralOpen(true);
    setCustomizeAllSeriesOpen(false);
    setCustomizeThemeOpen(false);
    setChartFontSize(12);
    setXAxisLabelOverride("");
    setXAxisLabelMaxLen(17);
    setYAxisLabelOverride("");
    setYAxisLabelMaxLen(17);
    setYScaleMin("auto");
    setYScaleMax("auto");
    setIncludeStackedOther(true);
    setLimitRecentRows(false);
    setRecentRowCount(5000);
    setYAxisTargets([]);
  }, []);

  const onDragStart = useCallback((e: DragStartEvent) => {
    const data = e.active.data.current as
      | { type?: string; field?: string; kind?: FieldKind }
      | undefined;
    if (data?.type === "column" && data.field && data.kind) {
      setActiveFieldDrag({ field: data.field, kind: data.kind });
    }
  }, []);

  const onDragCancel = useCallback(() => {
    setActiveFieldDrag(null);
  }, []);

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveFieldDrag(null);
      const { active, over } = e;
      if (!over || !dataset) return;
      const data = active.data.current as
        | { type?: string; field?: string; kind?: FieldKind }
        | undefined;
      if (data?.type !== "column" || !data.field || !data.kind) return;

      if (over.id === SLOT_CATEGORY) {
        if (!fieldAcceptsCategoryAxis(data.kind)) {
          toast.error("This Field Type Cannot Be Placed On The X Axis");
          return;
        }
        setCategoryField(data.field);
        return;
      }
      if (over.id === SLOT_MEASURE) {
        if (!fieldAcceptsMeasure(data.kind, aggregate)) {
          toast.error("Sum Or Average Requires A Numerical Column On The Y Axis");
          return;
        }
        setMeasureField(data.field);
        return;
      }
      if (over.id === SLOT_FILTER_ADD) {
        const field = data.field;
        const kind = data.kind;
        const id = newFilterId();
        if (kind === "categorical") {
          setFilters((prev) => [...prev, { id, kind: "categorical", column: field, values: [] }]);
          return;
        }
        if (kind === "numerical") {
          setFilters((prev) => [...prev, { id, kind: "numerical", column: field, op: "gt", a: "0" }]);
          return;
        }
        if (kind === "date") {
          setFilters((prev) => [...prev, { id, kind: "date", column: field, op: "after", a: "", b: undefined }]);
        }
      }
    },
    [dataset, setFilters, aggregate]
  );

  const openInspect = useCallback((bucket: string, drill?: { colorSegment: string | null }) => {
    setInspectBucket(bucket);
    setInspectColorSegment(drill?.colorSegment ?? null);
  }, []);

  const measureFieldKind =
    measureField && dataset ? (dataset.kinds[measureField] ?? "categorical") : null;
  const chartOk =
    Boolean(categoryField) &&
    Boolean(measureField) &&
    (aggregate === "count" || measureFieldKind === "numerical");

  const chartBarFill = useMemo(
    () => (chartBarColorHex.trim() ? chartBarColorHex.trim() : "hsl(var(--primary))"),
    [chartBarColorHex]
  );

  const chartCategoryKind = useMemo((): FieldKind => {
    if (!dataset || !categoryField) return "categorical";
    return (dataset.kinds[categoryField] ?? "categorical") as FieldKind;
  }, [dataset, categoryField]);

  const yAxisDomain = useMemo(() => buildYAxisDomain(yScaleMin, yScaleMax), [yScaleMin, yScaleMax]);

  const formatXTick = useCallback(
    (v: string | number) =>
      truncateTickLabel(
        chartCategoryKind === "date" ? String(v) : toTitleCaseLabel(String(v)),
        Math.max(1, Math.floor(xAxisLabelMaxLen) || 17)
      ),
    [chartCategoryKind, xAxisLabelMaxLen]
  );

  const formatYTick = useCallback(
    (v: string | number) => {
      const s = typeof v === "number" ? formatAxisNumber(v) : String(v);
      return truncateTickLabel(s, Math.max(1, Math.floor(yAxisLabelMaxLen) || 17));
    },
    [yAxisLabelMaxLen]
  );

  const stackedChartRows = stackedChartPresentation?.chartRows ?? [];
  const stackedSegments = stackedChartPresentation?.segments ?? [];
  const useStackedChart =
    chartOk &&
    Boolean(colorByField) &&
    stackedSegments.length > 0 &&
    stackedChartRows.length > 0;

  const inspectRows = useMemo(() => {
    if (!dataset || inspectBucket === null || !categoryField) return [];
    const categoryKind = (dataset.kinds[categoryField] ?? "categorical") as FieldKind;
    return rowsForInvestigate(
      dataset.rows,
      filters,
      categoryField,
      categoryKind,
      dateBinning,
      inspectBucket,
      inspectColorSegment != null && inspectColorSegment !== "" && colorByField
        ? {
            colorByField,
            colorBySegment: inspectColorSegment,
            stackedSegmentKeys: stackedSegments,
          }
        : undefined
    );
  }, [
    dataset,
    filters,
    categoryField,
    inspectBucket,
    dateBinning,
    inspectColorSegment,
    colorByField,
    stackedSegments,
  ]);

  const buildCurrentSnapshot = useCallback((): AdminAnalyticsChartSnapshot | null => {
    if (!dataset) return null;
    return {
      v: ADMIN_ANALYTICS_SNAPSHOT_VERSION,
      fileLabel,
      dataset,
      categoryField,
      measureField,
      aggregate,
      chartKind,
      bucketSort,
      maxChartResults,
      maxColorBySegments,
      filters,
      dateBinning,
      colorByField,
      showBarValueLabels,
      chartBarColorHex,
      chartFontSize,
      xAxisLabelOverride,
      xAxisLabelMaxLen,
      yAxisLabelOverride,
      yAxisLabelMaxLen,
      yScaleMin,
      yScaleMax,
      includeStackedOther,
      limitRecentRows,
      recentRowCount,
      yAxisTargets,
    };
  }, [
    dataset,
    fileLabel,
    categoryField,
    measureField,
    aggregate,
    chartKind,
    bucketSort,
    maxChartResults,
    maxColorBySegments,
    filters,
    dateBinning,
    colorByField,
    showBarValueLabels,
    chartBarColorHex,
    chartFontSize,
    xAxisLabelOverride,
    xAxisLabelMaxLen,
    yAxisLabelOverride,
    yAxisLabelMaxLen,
    yScaleMin,
    yScaleMax,
    includeStackedOther,
    limitRecentRows,
    recentRowCount,
    yAxisTargets,
  ]);

  const applySnapshot = useCallback((snap: AdminAnalyticsChartSnapshot) => {
    setFileLabel(snap.fileLabel);
    setDataset(snap.dataset);
    setCategoryField(snap.categoryField);
    setMeasureField(snap.measureField);
    setAggregate(snap.aggregate);
    setChartKind(snap.chartKind);
    setBucketSort(snap.bucketSort);
    setMaxChartResults(
      Math.min(MAX_CHART_BUCKETS_CAP, Math.max(1, Math.floor(snap.maxChartResults) || DEFAULT_MAX_CHART_BUCKETS))
    );
    setMaxColorBySegments(
      Math.min(
        MAX_COLOR_SEGMENTS_CAP,
        Math.max(2, Math.floor(snap.maxColorBySegments) || DEFAULT_MAX_COLOR_SEGMENTS)
      )
    );
    setFilters(snap.filters);
    setDateBinning(snap.dateBinning);
    setColorByField(snap.colorByField);
    setShowBarValueLabels(snap.showBarValueLabels);
    setChartBarColorHex(snap.chartBarColorHex);
    setChartFontSize(snap.chartFontSize);
    setXAxisLabelOverride(snap.xAxisLabelOverride);
    setXAxisLabelMaxLen(snap.xAxisLabelMaxLen);
    setYAxisLabelOverride(snap.yAxisLabelOverride);
    setYAxisLabelMaxLen(snap.yAxisLabelMaxLen);
    setYScaleMin(snap.yScaleMin);
    setYScaleMax(snap.yScaleMax);
    setIncludeStackedOther(snap.includeStackedOther);
    setLimitRecentRows(snap.limitRecentRows);
    setRecentRowCount(Math.max(1, Math.floor(snap.recentRowCount) || 5000));
    setYAxisTargets(snap.yAxisTargets);
    setInspectBucket(null);
    setInspectColorSegment(null);
    setFieldSearch("");
    setSeries1Open(true);
    setCustomizeGeneralOpen(true);
    setCustomizeAllSeriesOpen(false);
    setCustomizeThemeOpen(false);
  }, []);

  const refreshSavedCharts = useCallback(async () => {
    setSavedChartsLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("admin_saved_charts")
      .select("id,user_id,title,snapshot,created_at,updated_at")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setSavedChartsLoading(false);
    if (error) {
      console.error(error);
      toast.error("Could not load saved charts: " + error.message);
      setSavedCharts([]);
      return;
    }
    setSavedCharts((data as AdminSavedChart[]) ?? []);
  }, [profile.id]);

  useEffect(() => {
    void refreshSavedCharts();
  }, [refreshSavedCharts]);

  const exportChartAsJpeg = useCallback(async () => {
    const el = chartExportRef.current;
    if (!el) {
      toast.error("Nothing to export yet");
      return;
    }
    if (!chartOk) {
      toast.error("Configure the chart before exporting");
      return;
    }
    setExportingJpeg(true);
    try {
      const dataUrl = await toJpeg(el, {
        quality: 0.92,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });
      const link = document.createElement("a");
      const base =
        chartTitle
          .replace(/[^a-zA-Z0-9\s-]/g, "")
          .trim()
          .replace(/\s+/g, "-")
          .slice(0, 60) || "chart";
      link.download = `${base}-${format(new Date(), "yyyy-MM-dd-HHmm")}.jpg`;
      link.href = dataUrl;
      link.click();
      toast.success("Downloaded chart image");
    } catch (e) {
      console.error(e);
      toast.error("Could not export image. Try again or switch chart view.");
    } finally {
      setExportingJpeg(false);
    }
  }, [chartOk, chartTitle]);

  const openSaveChartDialog = useCallback(() => {
    setSaveTitleInput(chartTitle);
    setSaveDialogOpen(true);
  }, [chartTitle]);

  const persistSavedChart = useCallback(async () => {
    const snap = buildCurrentSnapshot();
    if (!snap) {
      toast.error("Load a dataset before saving");
      return;
    }
    const title = saveTitleInput.trim();
    if (!title) {
      toast.error("Enter a name for this chart");
      return;
    }
    setSaveSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("admin_saved_charts").insert({
      user_id: profile.id,
      title,
      snapshot: snap,
    });
    setSaveSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Chart saved");
    setSaveDialogOpen(false);
    setSaveTitleInput("");
    void refreshSavedCharts();
  }, [buildCurrentSnapshot, saveTitleInput, profile.id, refreshSavedCharts]);

  const loadSavedChartRow = useCallback(
    (row: AdminSavedChart) => {
      const snap = parseAdminAnalyticsSnapshot(row.snapshot);
      if (!snap) {
        toast.error("This saved chart is invalid or from a newer version");
        return;
      }
      applySnapshot(snap);
      setSavedChartsOpen(false);
      toast.success(`Loaded: ${row.title}`);
    },
    [applySnapshot]
  );

  const deleteSavedChartRow = useCallback(
    async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("admin_saved_charts")
        .delete()
        .eq("id", id)
        .eq("user_id", profile.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Removed saved chart");
      void refreshSavedCharts();
    },
    [profile.id, refreshSavedCharts]
  );

  return (
    <div className="space-y-4">
      <input
        id={uploadId}
        ref={fileInputRef}
        type="file"
        accept=".csv,.json,text/csv,application/json"
        className="sr-only"
        onChange={(ev) => void onFile(ev.target.files?.[0] ?? null)}
      />

      {!dataset ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <p className="font-display text-lg font-semibold text-foreground">Chart Builder</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Upload CSV or JSON, then in Setup assign both axes and click a bar to view matching records.
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-6 gap-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            Upload Dataset
          </Button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          autoScroll={false}
          onDragStart={onDragStart}
          onDragCancel={onDragCancel}
          onDragEnd={onDragEnd}
        >
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
              <div className="min-w-0">
                <h2 className="font-display text-base font-semibold tracking-tight text-foreground md:text-lg">
                  Chart Builder
                </h2>
                <p className="truncate text-xs text-muted-foreground">
                  {fileLabel} · {dataset.rows.length.toLocaleString()} Rows
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Replace
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={clearDataset}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear
                </Button>
              </div>
            </div>

            <div className="grid min-h-[min(640px,75vh)] grid-cols-1 divide-border lg:h-[min(640px,75vh)] lg:min-h-0 lg:grid-cols-[220px_minmax(260px,300px)_1fr] lg:divide-x [&>*]:min-h-0">
              <div className="relative z-[2] min-h-0 min-w-0">
                <FieldsPane
                  dataset={dataset}
                  usedFields={usedFields}
                  search={fieldSearch}
                  onSearchChange={setFieldSearch}
                />
              </div>

              <div className="flex min-h-0 flex-col bg-background">
                <Tabs defaultValue="setup" className="flex min-h-0 flex-1 flex-col">
                  <div className="shrink-0 border-b border-border px-2 pt-2">
                    <TabsList className="grid h-11 w-full grid-cols-3 gap-0 rounded-none border-0 border-b border-border bg-transparent p-0">
                      <TabsTrigger
                        value="setup"
                        className="rounded-none border-0 border-b-2 border-transparent text-xs data-active:border-primary data-active:bg-transparent data-active:shadow-none sm:text-sm"
                      >
                        Setup
                      </TabsTrigger>
                      <TabsTrigger
                        value="filter"
                        className="rounded-none border-0 border-b-2 border-transparent text-xs data-active:border-primary data-active:bg-transparent data-active:shadow-none sm:text-sm"
                      >
                        Filter
                      </TabsTrigger>
                      <TabsTrigger
                        value="customize"
                        className="rounded-none border-0 border-b-2 border-transparent text-xs data-active:border-primary data-active:bg-transparent data-active:shadow-none sm:text-sm"
                      >
                        Customize
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="setup" className="mt-0 flex min-h-0 flex-1 flex-col p-3">
                    <div className="space-y-4 overflow-y-auto">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Chart Type</Label>
                        <Select
                          value={chartKind}
                          onValueChange={(v) => setChartKind(v as ChartKind)}
                        >
                          <SelectTrigger className="h-9 w-full min-w-0 font-normal">
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              {chartKind === "bar" ? (
                                <BarChart3 className="h-4 w-4 shrink-0 text-muted-foreground" />
                              ) : (
                                <Table2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                              )}
                              <SelectValue className="min-w-0 truncate">
                                {chartKind === "bar" ? "Bar" : "Table (Aggregated)"}
                              </SelectValue>
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bar">Bar</SelectItem>
                            <SelectItem value="table">Table (Aggregated)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="rounded-lg border border-border bg-muted/10 p-2">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left hover:bg-muted/40"
                          onClick={() => setSeries1Open((o) => !o)}
                        >
                          <span className="text-[11px] font-semibold tracking-wide text-muted-foreground">
                            Series 1
                          </span>
                          {series1Open ? (
                            <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                        </button>
                        {series1Open ? (
                          <div className="space-y-3 px-1 pb-2 pt-1">
                            <SeriesAxisCard
                              variant="x"
                              slotId={SLOT_CATEGORY}
                              value={categoryField}
                              kind={categoryField ? (dataset.kinds[categoryField] ?? "categorical") : null}
                              sourceLabel={fileLabel}
                              onClear={() => setCategoryField(null)}
                              emptyHint="Drag & drop date, categorical or numerical field(s)"
                              bucketSort={bucketSort}
                              onBucketSortChange={setBucketSort}
                              dateBin={dateBinning}
                              onDateBinChange={setDateBinning}
                              aggregate={aggregate}
                              onAggregateChange={setAggregate}
                            />
                            <SeriesAxisCard
                              variant="y"
                              slotId={SLOT_MEASURE}
                              value={measureField}
                              kind={measureField ? (dataset.kinds[measureField] ?? "categorical") : null}
                              sourceLabel={fileLabel}
                              onClear={() => {
                                setMeasureField(null);
                                setColorByField(null);
                              }}
                              emptyHint="Drag & drop date, categorical or numerical field(s)"
                              bucketSort={bucketSort}
                              onBucketSortChange={setBucketSort}
                              dateBin={dateBinning}
                              onDateBinChange={setDateBinning}
                              aggregate={aggregate}
                              onAggregateChange={setAggregate}
                              colorByField={colorByField}
                              onColorByFieldChange={setColorByField}
                              colorByOptions={colorByOptions}
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="filter" className="mt-0 flex min-h-0 flex-1 flex-col p-3">
                    <FilterTabPanel dataset={dataset} filters={filters} setFilters={setFilters} />
                  </TabsContent>

                  <TabsContent value="customize" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden">
                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden p-3 text-sm">
                      <CustomizeAccordionSection
                        title="General"
                        open={customizeGeneralOpen}
                        onToggle={() => setCustomizeGeneralOpen((o) => !o)}
                      >
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-sky-400/95">
                          Global
                        </p>
                        <OutlineLabeledField label="Font size" id="chart-font-size">
                          <Input
                            id="chart-font-size"
                            type="number"
                            inputMode="numeric"
                            min={8}
                            max={24}
                            step={1}
                            className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                            value={chartFontSize}
                            onChange={(e) => {
                              const n = Number.parseInt(e.target.value, 10);
                              if (!Number.isFinite(n)) return;
                              setChartFontSize(Math.min(24, Math.max(8, n)));
                            }}
                          />
                        </OutlineLabeledField>
                      </CustomizeAccordionSection>

                      <CustomizeAccordionSection
                        title="All series"
                        open={customizeAllSeriesOpen}
                        onToggle={() => setCustomizeAllSeriesOpen((o) => !o)}
                      >
                        <div className="space-y-3">
                          <CustomizeSubsection title="X-axis">
                            <OutlineLabeledField label="Label" id="x-axis-label-override">
                              <Input
                                id="x-axis-label-override"
                                placeholder={
                                  categoryField ? toTitleCaseLabel(categoryField) : "Axis label"
                                }
                                className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                                value={xAxisLabelOverride}
                                onChange={(e) => setXAxisLabelOverride(e.target.value)}
                              />
                            </OutlineLabeledField>
                            <OutlineLabeledField label="Label length" id="x-axis-label-len">
                              <Input
                                id="x-axis-label-len"
                                type="number"
                                inputMode="numeric"
                                min={4}
                                max={80}
                                step={1}
                                className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                                value={xAxisLabelMaxLen}
                                onChange={(e) => {
                                  const n = Number.parseInt(e.target.value, 10);
                                  if (!Number.isFinite(n)) return;
                                  setXAxisLabelMaxLen(Math.min(80, Math.max(4, n)));
                                }}
                              />
                            </OutlineLabeledField>
                          </CustomizeSubsection>

                          <CustomizeSubsection title="Series results">
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-medium text-muted-foreground">Sort</span>
                              <SortAzHashToggle
                                bucketSort={bucketSort}
                                onChange={setBucketSort}
                                disabled={!chartOk}
                              />
                            </div>
                            <OutlineLabeledField label="Max series results" id="max-series-results">
                              <Input
                                id="max-series-results"
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={MAX_CHART_BUCKETS_CAP}
                                step={1}
                                className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                                value={maxChartResults}
                                onChange={(e) => {
                                  const n = Number.parseInt(e.target.value, 10);
                                  if (!Number.isFinite(n)) return;
                                  setMaxChartResults(
                                    Math.min(MAX_CHART_BUCKETS_CAP, Math.max(1, n))
                                  );
                                }}
                              />
                            </OutlineLabeledField>
                            <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
                              <input
                                type="checkbox"
                                className="size-4 rounded border-input accent-primary"
                                checked={includeStackedOther}
                                onChange={(e) => setIncludeStackedOther(e.target.checked)}
                                disabled={!colorByField}
                              />
                              <span className={!colorByField ? "text-muted-foreground" : ""}>
                                Include &apos;Other&apos;
                              </span>
                            </label>
                            <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
                              <input
                                type="checkbox"
                                className="size-4 rounded border-input accent-primary"
                                checked={limitRecentRows}
                                onChange={(e) => setLimitRecentRows(e.target.checked)}
                              />
                              <span>Limit by most recent data</span>
                            </label>
                            {limitRecentRows ? (
                              <OutlineLabeledField label="Row window" id="recent-row-count">
                                <Input
                                  id="recent-row-count"
                                  type="number"
                                  inputMode="numeric"
                                  min={1}
                                  step={1}
                                  className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                                  value={recentRowCount}
                                  onChange={(e) => {
                                    const n = Number.parseInt(e.target.value, 10);
                                    if (!Number.isFinite(n)) return;
                                    setRecentRowCount(Math.max(1, n));
                                  }}
                                />
                              </OutlineLabeledField>
                            ) : null}
                          </CustomizeSubsection>

                          <CustomizeSubsection title="Left Y-axis">
                            <OutlineLabeledField label="Label" id="y-axis-label-override">
                              <Input
                                id="y-axis-label-override"
                                placeholder={yAxisTitle}
                                className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                                value={yAxisLabelOverride}
                                onChange={(e) => setYAxisLabelOverride(e.target.value)}
                              />
                            </OutlineLabeledField>
                            <OutlineLabeledField label="Label length" id="y-axis-label-len">
                              <Input
                                id="y-axis-label-len"
                                type="number"
                                inputMode="numeric"
                                min={4}
                                max={40}
                                step={1}
                                className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                                value={yAxisLabelMaxLen}
                                onChange={(e) => {
                                  const n = Number.parseInt(e.target.value, 10);
                                  if (!Number.isFinite(n)) return;
                                  setYAxisLabelMaxLen(Math.min(40, Math.max(4, n)));
                                }}
                              />
                            </OutlineLabeledField>
                            <OutlineLabeledField label="Scale max" id="y-scale-max">
                              <Input
                                id="y-scale-max"
                                className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                                value={yScaleMax}
                                onChange={(e) => setYScaleMax(e.target.value)}
                                placeholder="auto"
                              />
                            </OutlineLabeledField>
                            <OutlineLabeledField label="Scale min" id="y-scale-min">
                              <Input
                                id="y-scale-min"
                                className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                                value={yScaleMin}
                                onChange={(e) => setYScaleMin(e.target.value)}
                                placeholder="auto"
                              />
                            </OutlineLabeledField>
                            <div className="space-y-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-400/95">
                                Targets
                              </p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full gap-1.5"
                                onClick={() => setYAxisTargets((prev) => [...prev, 0])}
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Add target
                              </Button>
                              {yAxisTargets.map((t, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    inputMode="decimal"
                                    className="h-8 min-w-0 flex-1"
                                    value={Number.isFinite(t) ? String(t) : ""}
                                    onChange={(e) => {
                                      const n = Number.parseFloat(e.target.value);
                                      setYAxisTargets((prev) => {
                                        const next = [...prev];
                                        next[i] = Number.isFinite(n) ? n : 0;
                                        return next;
                                      });
                                    }}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    className="shrink-0 text-muted-foreground"
                                    aria-label="Remove target"
                                    onClick={() =>
                                      setYAxisTargets((prev) => prev.filter((_, j) => j !== i))
                                    }
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </CustomizeSubsection>

                          <CustomizeSubsection title="Color by">
                            <OutlineLabeledField label="Max color by results" id="max-color-by-results">
                              <Input
                                id="max-color-by-results"
                                type="number"
                                inputMode="numeric"
                                min={2}
                                max={MAX_COLOR_SEGMENTS_CAP}
                                step={1}
                                className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                                value={maxColorBySegments}
                                onChange={(e) => {
                                  const n = Number.parseInt(e.target.value, 10);
                                  if (!Number.isFinite(n)) return;
                                  setMaxColorBySegments(
                                    Math.min(MAX_COLOR_SEGMENTS_CAP, Math.max(2, n))
                                  );
                                }}
                              />
                            </OutlineLabeledField>
                            <p className="text-[10px] leading-snug text-muted-foreground">
                              Smaller categories roll into {toTitleCaseLabel(STACK_COLOR_BY_OTHER)} when
                              over the cap.
                            </p>
                          </CustomizeSubsection>
                        </div>
                      </CustomizeAccordionSection>

                      <CustomizeAccordionSection
                        title="Theme - Series 1"
                        open={customizeThemeOpen}
                        onToggle={() => setCustomizeThemeOpen((o) => !o)}
                      >
                        <div className="space-y-3">
                          <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
                            <input
                              type="checkbox"
                              className="size-4 rounded border-input accent-primary"
                              checked={showBarValueLabels}
                              onChange={(e) => setShowBarValueLabels(e.target.checked)}
                            />
                            <span>Show numeric labels on bars</span>
                          </label>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] text-muted-foreground">Bar color</Label>
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                type="color"
                                aria-label="Bar color"
                                className="h-9 w-14 min-w-0 cursor-pointer border p-1"
                                value={chartBarColorHex || "#6366f1"}
                                onChange={(e) => setChartBarColorHex(e.target.value)}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setChartBarColorHex("")}
                              >
                                Use theme color
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CustomizeAccordionSection>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              <div className="flex h-full min-h-0 min-w-0 flex-col border-t border-border bg-background lg:border-t-0">
                <div className="flex shrink-0 flex-wrap items-start justify-between gap-2 border-b border-border px-4 py-3">
                  <h3 className="font-display min-w-0 flex-1 text-base font-semibold leading-tight tracking-tight text-foreground md:text-lg">
                    {chartTitle}
                  </h3>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-full border-border px-3 text-xs font-medium"
                      disabled={!dataset || !chartOk || exportingJpeg}
                      onClick={() => void exportChartAsJpeg()}
                    >
                      {exportingJpeg ? (
                        <Loader2 className="mr-1.5 size-3.5 shrink-0 animate-spin" aria-hidden />
                      ) : (
                        <ImageDown className="mr-1.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      )}
                      Export JPEG
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-full border-border px-3 text-xs font-medium"
                      disabled={!dataset || saveSubmitting}
                      onClick={openSaveChartDialog}
                    >
                      <Bookmark className="mr-1.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      Save chart
                    </Button>
                    <Popover open={savedChartsOpen} onOpenChange={setSavedChartsOpen}>
                      <PopoverTrigger
                        render={
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-full border-border px-3 text-xs font-medium"
                            disabled={savedChartsLoading}
                          >
                            <Library className="mr-1.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                            Saved charts
                            {savedCharts.length > 0 ? (
                              <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 px-1 text-[10px]">
                                {savedCharts.length}
                              </Badge>
                            ) : null}
                          </Button>
                        }
                      />
                      <PopoverContent
                        align="end"
                        className="w-[min(100vw-2rem,20rem)] p-0"
                        sideOffset={6}
                      >
                        <div className="border-b border-border px-3 py-2">
                          <p className="text-xs font-semibold text-foreground">Your saved charts</p>
                          <p className="text-[10px] text-muted-foreground">Stored for your account only.</p>
                        </div>
                        <div className="max-h-64 overflow-y-auto p-1">
                          {savedChartsLoading ? (
                            <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                              <Loader2 className="size-4 animate-spin" aria-hidden />
                              Loading…
                            </div>
                          ) : savedCharts.length === 0 ? (
                            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                              No saved charts yet. Save the current setup to reopen it later.
                            </p>
                          ) : (
                            <ul className="space-y-0.5">
                              {savedCharts.map((row) => (
                                <li
                                  key={row.id}
                                  className="flex items-start gap-1 rounded-md px-1 py-0.5 hover:bg-muted/60"
                                >
                                  <button
                                    type="button"
                                    className="min-w-0 flex-1 truncate rounded px-2 py-1.5 text-left text-xs text-foreground"
                                    onClick={() => loadSavedChartRow(row)}
                                  >
                                    <span className="font-medium">{row.title}</span>
                                    <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                                      {format(new Date(row.created_at), "MMM d, yyyy · h:mm a")}
                                    </span>
                                  </button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    className="shrink-0 text-muted-foreground hover:text-destructive"
                                    aria-label={`Delete ${row.title}`}
                                    onClick={() => void deleteSavedChartRow(row.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div ref={chartExportRef} className="flex min-h-0 flex-1 flex-col p-4">
                  {!chartOk ? (
                    <p className="text-sm text-muted-foreground">
                      {!categoryField
                        ? "Drag A Date, Category, Or Number Field Onto The X Axis Above"
                        : !measureField
                          ? "Drag A Field Onto The Y Axis Above To Complete The Chart"
                          : "For Sum Or Average, Choose A Numerical Field On The Y Axis Above"}
                    </p>
                  ) : chartKind === "table" && useStackedChart ? (
                    <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
                      <table className="w-full min-w-[320px] text-sm">
                        <thead className="sticky top-0 bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2">
                              {categoryField ? toTitleCaseLabel(categoryField) : ""}
                            </th>
                            {stackedSegments.map((seg) => (
                              <th key={seg} className="px-3 py-2 text-right">
                                {formatColorByLegendSegment(seg)}
                              </th>
                            ))}
                            <th className="px-3 py-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stackedChartRows.map((row) => (
                            <tr
                              key={String(row.bucket)}
                              className="cursor-pointer border-t hover:bg-muted/50"
                              onClick={() => openInspect(String(row.bucket))}
                            >
                              <td className="px-3 py-2 font-medium">
                                {toTitleCaseLabel(String(row.bucket))}
                              </td>
                              {stackedSegments.map((seg) => (
                                <td key={seg} className="px-3 py-2 text-right tabular-nums">
                                  {aggregate === "avg"
                                    ? Number(row[seg]).toFixed(2)
                                    : formatAxisNumber(Number(row[seg]))}
                                </td>
                              ))}
                              <td className="px-3 py-2 text-right tabular-nums font-medium">
                                {aggregate === "avg"
                                  ? Number(row[STACK_TOTAL_KEY]).toFixed(2)
                                  : formatAxisNumber(Number(row[STACK_TOTAL_KEY]))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : chartKind === "table" ? (
                    <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
                      <table className="w-full min-w-[240px] text-sm">
                        <thead className="sticky top-0 bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2">
                              {categoryField ? toTitleCaseLabel(categoryField) : ""}
                            </th>
                            <th className="px-3 py-2 text-right">{yAxisTitle}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleSeries.map((row) => (
                            <tr
                              key={row.bucket}
                              className="cursor-pointer border-t hover:bg-muted/50"
                              onClick={() => openInspect(row.bucket)}
                            >
                              <td className="px-3 py-2 font-medium">
                                {toTitleCaseLabel(row.bucket)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {aggregate === "avg"
                                  ? row.value.toFixed(2)
                                  : formatAxisNumber(row.value)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : useStackedChart && colorByField ? (
                    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-row gap-0 overflow-hidden">
                      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={stackedChartRows}
                            margin={{ top: 12, right: 4, left: 4, bottom: 72 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis
                              dataKey="bucket"
                              tick={{
                                fontSize: chartFontSize,
                                fill: "hsl(var(--muted-foreground))",
                              }}
                              tickFormatter={formatXTick}
                              interval={0}
                              angle={-40}
                              textAnchor="end"
                              height={78}
                              label={{
                                value:
                                  xAxisLabelOverride.trim() ||
                                  (categoryField ? toTitleCaseLabel(categoryField) : ""),
                                position: "insideBottom",
                                offset: -4,
                                fill: "hsl(var(--muted-foreground))",
                                fontSize: chartFontSize,
                              }}
                            />
                            <YAxis
                              domain={yAxisDomain}
                              tick={{
                                fontSize: chartFontSize,
                                fill: "hsl(var(--muted-foreground))",
                              }}
                              tickFormatter={formatYTick}
                              width={52}
                              label={{
                                value: yAxisLabelOverride.trim() || yAxisTitle,
                                angle: -90,
                                position: "insideLeft",
                                fill: "hsl(var(--muted-foreground))",
                                fontSize: chartFontSize,
                              }}
                            />
                            {yAxisTargets
                              .filter((n) => Number.isFinite(n))
                              .map((t, i) => (
                                <ReferenceLine
                                  key={`y-target-${i}-${t}`}
                                  y={t}
                                  stroke="hsl(var(--muted-foreground) / 0.9)"
                                  strokeDasharray="4 4"
                                />
                              ))}
                            <Tooltip
                              shared={false}
                              filterNull={false}
                              cursor={{ fill: "hsl(var(--foreground) / 0.08)" }}
                              content={(props) => (
                                <AdminStackedBarTooltip
                                  active={props.active}
                                  label={props.label}
                                  payload={props.payload}
                                  categoryField={categoryField!}
                                  categoryKind={chartCategoryKind}
                                  yAxisTitle={yAxisTitle}
                                  aggregate={aggregate}
                                  measureField={measureField!}
                                  xAxisLabelOverride={xAxisLabelOverride}
                                  colorByColumnTitle={toTitleCaseLabel(colorByField)}
                                />
                              )}
                            />
                            {stackedSegments.map((seg, segIdx) => {
                              const isTop = segIdx === stackedSegments.length - 1;
                              return (
                                <Bar
                                  key={seg}
                                  dataKey={seg}
                                  name={seg}
                                  stackId="stack"
                                  fill={stackSeriesColor(segIdx)}
                                  radius={isTop ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                                  cursor="pointer"
                                  onClick={makeStackedBarInspectHandler(seg, openInspect)}
                                >
                                  {showBarValueLabels && isTop ? (
                                    <LabelList
                                      dataKey={seg}
                                      content={(props) => {
                                        const p = props as {
                                          x?: number | string;
                                          y?: number | string;
                                          width?: number | string;
                                          payload?: Record<string, unknown>;
                                        };
                                        const total = p.payload?.[STACK_TOTAL_KEY];
                                        const tx = Number(p.x) + Number(p.width) / 2;
                                        const ty = Number(p.y) - 6;
                                        const t =
                                          typeof total === "number" && Number.isFinite(total)
                                            ? formatAxisNumber(total)
                                            : "";
                                        if (!t) return null;
                                        return (
                                          <text
                                            x={tx}
                                            y={ty}
                                            fill="hsl(var(--foreground))"
                                            fontSize={chartFontSize}
                                            textAnchor="middle"
                                          >
                                            {t}
                                          </text>
                                        );
                                      }}
                                    />
                                  ) : null}
                                </Bar>
                              );
                            })}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <StackLegendBar
                        colorByColumn={colorByField}
                        measureTitle={yAxisTitle}
                        segments={stackedSegments}
                        activeSegments={legendSelectedSegments}
                        onSegmentClick={onLegendSegmentClick}
                        onClearSelection={onLegendClearSelection}
                      />
                    </div>
                  ) : (
                    <div className="min-h-0 w-full flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={visibleSeries}
                          margin={{ top: 28, right: 12, left: 4, bottom: 72 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis
                            dataKey="bucket"
                            tick={{
                              fontSize: chartFontSize,
                              fill: "hsl(var(--muted-foreground))",
                            }}
                            tickFormatter={formatXTick}
                            interval={0}
                            angle={-40}
                            textAnchor="end"
                            height={78}
                            label={{
                              value:
                                xAxisLabelOverride.trim() ||
                                (categoryField ? toTitleCaseLabel(categoryField) : ""),
                              position: "insideBottom",
                              offset: -4,
                              fill: "hsl(var(--muted-foreground))",
                              fontSize: chartFontSize,
                            }}
                          />
                          <YAxis
                            domain={yAxisDomain}
                            tick={{
                              fontSize: chartFontSize,
                              fill: "hsl(var(--muted-foreground))",
                            }}
                            tickFormatter={formatYTick}
                            width={52}
                            label={{
                              value: yAxisLabelOverride.trim() || yAxisTitle,
                              angle: -90,
                              position: "insideLeft",
                              fill: "hsl(var(--muted-foreground))",
                              fontSize: chartFontSize,
                            }}
                          />
                          {yAxisTargets
                            .filter((n) => Number.isFinite(n))
                            .map((t, i) => (
                              <ReferenceLine
                                key={`y-target-single-${i}-${t}`}
                                y={t}
                                stroke="hsl(var(--muted-foreground) / 0.9)"
                                strokeDasharray="4 4"
                              />
                            ))}
                          <Tooltip
                            shared={false}
                            filterNull={false}
                            cursor={{ fill: "hsl(var(--foreground) / 0.08)" }}
                            content={(props) => (
                              <AdminSingleBarTooltip
                                active={props.active}
                                label={props.label}
                                payload={props.payload}
                                categoryField={categoryField!}
                                categoryKind={chartCategoryKind}
                                yAxisTitle={yAxisTitle}
                                aggregate={aggregate}
                                measureField={measureField!}
                                barFill={chartBarFill}
                                xAxisLabelOverride={xAxisLabelOverride}
                              />
                            )}
                          />
                          <Bar
                            dataKey="value"
                            fill={chartBarFill}
                            radius={[4, 4, 0, 0]}
                            cursor="pointer"
                            onClick={(state, index) => {
                              const fromPayload = (state as { payload?: AggregatePoint })
                                ?.payload;
                              const fromIndex =
                                typeof index === "number" ? visibleSeries[index] : undefined;
                              const p = fromPayload ?? fromIndex;
                              if (p?.bucket == null) return;
                              openInspect(p.bucket);
                            }}
                          >
                            {showBarValueLabels ? (
                              <LabelList
                                dataKey="value"
                                position="top"
                                fill="hsl(var(--foreground))"
                                fontSize={chartFontSize}
                                formatter={(label: unknown) => {
                                  const v =
                                    typeof label === "number"
                                      ? label
                                      : typeof label === "string"
                                        ? Number.parseFloat(label)
                                        : NaN;
                                  return Number.isFinite(v) ? formatAxisNumber(v) : String(label ?? "");
                                }}
                              />
                            ) : null}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DragOverlay dropAnimation={null} className="z-[9999]">
            {activeFieldDrag ? (
              <FieldDragPreview field={activeFieldDrag.field} kind={activeFieldDrag.kind} />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <Dialog
        open={inspectBucket !== null}
        onOpenChange={(open) => {
          if (!open) {
            setInspectBucket(null);
            setInspectColorSegment(null);
          }
        }}
      >
        <DialogContent
          showCloseButton
          className="flex max-h-[90vh] w-[calc(100%-1.5rem)] max-w-[min(96vw,72rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,72rem)]"
        >
          <DialogHeader className="shrink-0 space-y-1 border-b border-border px-4 py-3 text-left">
            <DialogTitle className="font-display pr-8 text-lg leading-snug">
              Records
              {categoryField && inspectBucket !== null ? (
                <>
                  {" "}
                  <span className="text-muted-foreground">·</span>{" "}
                  <span className="font-medium text-foreground">
                    {toTitleCaseLabel(categoryField)}
                  </span>
                  <span className="text-muted-foreground"> = </span>
                  <span className="font-mono text-base">{inspectBucket}</span>
                  {colorByField && inspectColorSegment != null && inspectColorSegment !== "" ? (
                    <>
                      {" "}
                      <span className="text-muted-foreground">·</span>{" "}
                      <span className="font-medium text-foreground">
                        {toTitleCaseLabel(colorByField)}
                      </span>
                      <span className="text-muted-foreground"> = </span>
                      <span className="font-mono text-base">
                        {formatColorByLegendSegment(inspectColorSegment)}
                      </span>
                    </>
                  ) : null}
                </>
              ) : null}
            </DialogTitle>
            <DialogDescription className="text-left">
              <span className="block text-sm text-muted-foreground">
                {inspectRows.length.toLocaleString()} Rows · Same Filters As Chart
              </span>
            </DialogDescription>
            {filters.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {filters.map((f) => (
                  <Badge key={f.id} variant="secondary" className="max-w-full truncate font-mono text-[11px] font-normal">
                    {summarizeFilter(f)}
                  </Badge>
                ))}
              </div>
            ) : null}
          </DialogHeader>
          {dataset && inspectBucket !== null ? (
            <div className="min-h-0 flex-1 overflow-auto px-2 pb-4 pt-1">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead className="sticky top-0 z-[1] bg-background shadow-sm">
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    {dataset.headers.map((h) => (
                      <th key={h} className="whitespace-nowrap bg-background px-2 py-2 font-medium">
                        {toTitleCaseLabel(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inspectRows.map((r, idx) => (
                    <tr key={idx} className="border-b border-border/70 hover:bg-muted/40">
                      {dataset.headers.map((h) => (
                        <td key={h} className="max-w-[240px] truncate px-2 py-1.5">
                          {r[h] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Save chart</DialogTitle>
            <DialogDescription>
              Saves the uploaded dataset, axes, filters, and chart options for your account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="save-chart-title">Name</Label>
            <Input
              id="save-chart-title"
              value={saveTitleInput}
              onChange={(e) => setSaveTitleInput(e.target.value)}
              placeholder="e.g. Q1 enrollment overview"
              onKeyDown={(e) => {
                if (e.key === "Enter") void persistSavedChart();
              }}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={saveSubmitting} onClick={() => void persistSavedChart()}>
              {saveSubmitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
