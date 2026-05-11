import {
  endOfDay,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfWeek,
  isValid,
} from "date-fns";

import type { FieldKind } from "@/lib/dataset-field-inference";

export type CatRowFilter = {
  id: string;
  kind: "categorical";
  column: string;
  values: string[];
  /** Default `in` — exclude rows whose value is in the list when `not_in`. */
  mode?: "in" | "not_in";
};

export type NumRowFilter = {
  id: string;
  kind: "numerical";
  column: string;
  op: "gt" | "lt" | "eq" | "between";
  a: string;
  b?: string;
};

export type DateRowFilter = {
  id: string;
  kind: "date";
  column: string;
  op: "before" | "after" | "between";
  a: string;
  b?: string;
};

export type RowFilter = CatRowFilter | NumRowFilter | DateRowFilter;

export type AggregateMode = "count" | "sum" | "avg";

/** Time bucketing for date fields on the category (X) axis. */
export type DateBin = "none" | "day" | "week" | "month" | "quarter" | "year";

export function bucketLabelForRow(
  row: Record<string, string>,
  categoryField: string
): string {
  const v = (row[categoryField] ?? "").trim();
  return v === "" ? "(empty)" : v;
}

function formatDateBinLabel(d: Date, bin: DateBin): string {
  switch (bin) {
    case "day":
    case "none":
      return format(d, "yyyy-MM-dd");
    case "week":
      return format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
    case "month":
      return format(d, "yyyy-MM");
    case "quarter":
      return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
    case "year":
      return format(d, "yyyy");
    default:
      return format(d, "yyyy-MM-dd");
  }
}

/** Bucket key for chart aggregation and drill-down (includes date binning). */
export function chartCategoryBucket(
  row: Record<string, string>,
  column: string,
  kind: FieldKind,
  dateBin: DateBin
): string {
  if (kind === "date") {
    const raw = (row[column] ?? "").trim();
    if (!raw) return "(empty)";
    const d = parseRowDay(raw);
    if (!d) return raw.length > 0 ? raw : "(empty)";
    if (dateBin === "none") return format(d, "yyyy-MM-dd");
    return formatDateBinLabel(d, dateBin);
  }
  return bucketLabelForRow(row, column);
}

export function normalizeCategoricalCell(cell: string): string {
  const v = cell.trim();
  return v === "" ? "(empty)" : v;
}

export function uniqueColumnValues(
  rows: Record<string, string>[],
  column: string
): string[] {
  const s = new Set<string>();
  for (const r of rows) {
    s.add(normalizeCategoricalCell(r[column] ?? ""));
  }
  return [...s].sort((a, b) => a.localeCompare(b));
}

function parseMeasureCell(raw: string): number | null {
  const n = Number.parseFloat(String(raw ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function parseBoundDay(isoOrRaw: string): Date | null {
  const s = isoOrRaw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = parseISO(s.slice(0, 10));
    return isValid(d) ? startOfDay(d) : null;
  }
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return startOfDay(new Date(t));
}

function parseRowDay(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = parseISO(s.slice(0, 10));
    return isValid(d) ? startOfDay(d) : null;
  }
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return startOfDay(new Date(t));
}

export function applyRowFilters(
  rows: Record<string, string>[],
  filters: RowFilter[]
): Record<string, string>[] {
  if (filters.length === 0) return rows;
  return rows.filter((r) =>
    filters.every((f) => {
      if (f.kind === "categorical") {
        if (f.values.length === 0) return true;
        const cell = normalizeCategoricalCell(r[f.column] ?? "");
        const inList = f.values.includes(cell);
        return f.mode === "not_in" ? !inList : inList;
      }
      if (f.kind === "numerical") {
        if (f.op === "between") {
          if (!f.a?.trim() || !f.b?.trim()) return true;
        } else if (!f.a?.trim()) {
          return true;
        }
        const n = parseMeasureCell(r[f.column] ?? "");
        if (n === null) return false;
        const boundA = Number.parseFloat(f.a.replace(/,/g, "").trim());
        const boundB =
          f.b !== undefined && f.b !== ""
            ? Number.parseFloat(f.b.replace(/,/g, "").trim())
            : NaN;
        if (f.op === "eq") return Number.isFinite(boundA) && n === boundA;
        if (f.op === "gt") return Number.isFinite(boundA) && n > boundA;
        if (f.op === "lt") return Number.isFinite(boundA) && n < boundA;
        if (f.op === "between") {
          if (!Number.isFinite(boundA) || !Number.isFinite(boundB)) return false;
          const lo = Math.min(boundA, boundB);
          const hi = Math.max(boundA, boundB);
          return n >= lo && n <= hi;
        }
        return true;
      }
      const cellRaw = (r[f.column] ?? "").trim();
      if (!f.a?.trim()) return true;
      if (f.op === "between" && !f.b?.trim()) return true;

      const rowD = parseRowDay(cellRaw);
      if (!rowD) return false;

      if (f.op === "before") {
        const bound = parseBoundDay(f.a);
        if (!bound) return false;
        return rowD.getTime() < startOfDay(bound).getTime();
      }
      if (f.op === "after") {
        const bound = parseBoundDay(f.a);
        if (!bound) return false;
        return rowD.getTime() > endOfDay(bound).getTime();
      }
      if (f.op === "between") {
        const d1 = parseBoundDay(f.a);
        const d2 = parseBoundDay(f.b ?? "");
        if (!d1 || !d2) return false;
        const start = startOfDay(d1 < d2 ? d1 : d2);
        const end = endOfDay(d1 < d2 ? d2 : d1);
        return isWithinInterval(rowD, { start, end });
      }
      return true;
    })
  );
}

export type AggregatePoint = { bucket: string; value: number };

export type AggregateByCategoryOptions = {
  categoryKind: FieldKind;
  dateBin: DateBin;
  measureField: string | null;
  aggregate: AggregateMode;
};

export function aggregateByCategory(
  rows: Record<string, string>[],
  categoryField: string,
  opts: AggregateByCategoryOptions
): AggregatePoint[] {
  type Acc = { sum: number; numericCount: number; rowCount: number };
  const map = new Map<string, Acc>();

  for (const r of rows) {
    const bucket = chartCategoryBucket(r, categoryField, opts.categoryKind, opts.dateBin);
    let acc = map.get(bucket);
    if (!acc) {
      acc = { sum: 0, numericCount: 0, rowCount: 0 };
      map.set(bucket, acc);
    }
    acc.rowCount += 1;
    if (opts.aggregate !== "count" && opts.measureField) {
      const n = parseMeasureCell(r[opts.measureField] ?? "");
      if (n !== null) {
        acc.sum += n;
        acc.numericCount += 1;
      }
    }
  }

  const out: AggregatePoint[] = [];
  for (const [bucket, acc] of map) {
    let value = acc.rowCount;
    if (opts.aggregate === "sum" && opts.measureField) value = acc.sum;
    if (opts.aggregate === "avg" && opts.measureField) {
      value = acc.numericCount > 0 ? acc.sum / acc.numericCount : 0;
    }
    out.push({ bucket, value });
  }
  out.sort((a, b) => b.value - a.value);
  return out;
}

export type StackedAggregateRow = {
  bucket: string;
  /** Sum of segment values (same as single-series total for that bucket). */
  total: number;
  valuesBySegment: Record<string, number>;
};

/** Merged tail label when color-by segments exceed `maxSegments`. */
export const STACK_COLOR_BY_OTHER = "(Other)";

export type AggregateStackedOptions = AggregateByCategoryOptions & {
  /** Max distinct stack segments (including `(Other)` when raw categories exceed this). Default: no cap. */
  maxColorSegments?: number;
  /** Override merged label; default {@link STACK_COLOR_BY_OTHER}. */
  otherSegmentLabel?: string;
};

/**
 * One row per X bucket; values split by `colorByField` (categorical) for stacked bars.
 * Segments are ordered by global contribution (descending). When `maxColorSegments` is set
 * and there are more raw categories, keeps the top `maxColorSegments - 1` and merges the rest
 * into {@link STACK_COLOR_BY_OTHER}.
 */
export function aggregateStackedByCategory(
  rows: Record<string, string>[],
  categoryField: string,
  colorByField: string,
  opts: AggregateStackedOptions
): { rows: StackedAggregateRow[]; segments: string[] } {
  type Acc = { sum: number; numericCount: number; rowCount: number };
  const pairMap = new Map<string, Map<string, Acc>>();

  const segmentOrder = new Set<string>();

  for (const r of rows) {
    const bucket = chartCategoryBucket(r, categoryField, opts.categoryKind, opts.dateBin);
    const segment = normalizeCategoricalCell(r[colorByField] ?? "");
    segmentOrder.add(segment);

    let inner = pairMap.get(bucket);
    if (!inner) {
      inner = new Map();
      pairMap.set(bucket, inner);
    }
    let acc = inner.get(segment);
    if (!acc) {
      acc = { sum: 0, numericCount: 0, rowCount: 0 };
      inner.set(segment, acc);
    }
    acc.rowCount += 1;
    if (opts.aggregate !== "count" && opts.measureField) {
      const n = parseMeasureCell(r[opts.measureField] ?? "");
      if (n !== null) {
        acc.sum += n;
        acc.numericCount += 1;
      }
    }
  }

  function cellValue(acc: Acc | undefined): number {
    if (!acc) return 0;
    if (opts.aggregate === "count") return acc.rowCount;
    if (opts.aggregate === "sum" && opts.measureField) return acc.sum;
    if (opts.aggregate === "avg" && opts.measureField) {
      return acc.numericCount > 0 ? acc.sum / acc.numericCount : 0;
    }
    return acc.rowCount;
  }

  /** Global score for ranking segments (mass / count in data). */
  const score = new Map<string, number>();
  for (const inner of pairMap.values()) {
    for (const seg of segmentOrder) {
      const acc = inner.get(seg);
      let add = acc?.rowCount ?? 0;
      if (opts.aggregate === "sum" && opts.measureField) add = acc?.sum ?? 0;
      if (opts.aggregate === "avg" && opts.measureField) add = acc?.sum ?? 0;
      score.set(seg, (score.get(seg) ?? 0) + add);
    }
  }

  const allSegsSorted = [...segmentOrder].sort(
    (a, b) => (score.get(b)! - score.get(a)!) || a.localeCompare(b)
  );

  const maxSeg = opts.maxColorSegments;
  const otherLabel = opts.otherSegmentLabel ?? STACK_COLOR_BY_OTHER;

  let segments: string[];
  const tailStart: number | null =
    maxSeg && allSegsSorted.length > maxSeg ? maxSeg - 1 : null;

  if (tailStart === null) {
    segments = [...allSegsSorted];
  } else {
    segments = [...allSegsSorted.slice(0, tailStart), otherLabel];
  }

  const outRows: StackedAggregateRow[] = [];
  for (const [bucket, inner] of pairMap) {
    const valuesBySegment: Record<string, number> = {};
    for (const seg of segments) {
      if (tailStart !== null && seg === otherLabel) {
        if (opts.aggregate === "avg" && opts.measureField) {
          let os = 0;
          let nc = 0;
          for (const rseg of allSegsSorted.slice(tailStart)) {
            const acc = inner.get(rseg);
            if (acc) {
              os += acc.sum;
              nc += acc.numericCount;
            }
          }
          valuesBySegment[otherLabel] = nc > 0 ? os / nc : 0;
        } else {
          let o = 0;
          for (const rseg of allSegsSorted.slice(tailStart)) {
            o += cellValue(inner.get(rseg));
          }
          valuesBySegment[otherLabel] = o;
        }
      } else {
        valuesBySegment[seg] = cellValue(inner.get(seg));
      }
    }
    let total = 0;
    for (const v of Object.values(valuesBySegment)) total += v;
    outRows.push({ bucket, total, valuesBySegment });
  }

  outRows.sort((a, b) => b.total - a.total);
  return { rows: outRows, segments };
}

export type RowsForInvestigateOptions = {
  /** When set with `colorBySegment`, narrows rows to that stacked color-by slice. */
  colorByField?: string | null;
  colorBySegment?: string | null;
  /**
   * Chart segment keys in stack order (includes {@link STACK_COLOR_BY_OTHER} when merged).
   * Used only to resolve rows that belong to the merged `(Other)` slice.
   */
  stackedSegmentKeys?: string[] | null;
};

export function rowsForInvestigate(
  allRows: Record<string, string>[],
  filters: RowFilter[],
  categoryField: string | null,
  categoryKind: FieldKind,
  dateBin: DateBin,
  bucket: string | null,
  opts?: RowsForInvestigateOptions
): Record<string, string>[] {
  let rows = applyRowFilters(allRows, filters);
  if (categoryField && bucket !== null) {
    rows = rows.filter(
      (r) => chartCategoryBucket(r, categoryField, categoryKind, dateBin) === bucket
    );
  }
  const cf = opts?.colorByField ?? null;
  const seg = opts?.colorBySegment;
  if (cf && seg != null && seg !== "") {
    const keys = opts?.stackedSegmentKeys ?? null;
    if (seg === STACK_COLOR_BY_OTHER && keys && keys.length > 0) {
      const nonOther = keys.filter((s) => s !== STACK_COLOR_BY_OTHER);
      rows = rows.filter((r) => {
        const v = normalizeCategoricalCell(r[cf] ?? "");
        return !nonOther.includes(v);
      });
    } else {
      rows = rows.filter((r) => normalizeCategoricalCell(r[cf] ?? "") === seg);
    }
  }
  return rows;
}
