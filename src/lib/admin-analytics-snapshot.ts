import { inferFieldTypes } from "@/lib/dataset-field-inference";
import type {
  AggregateMode,
  DateBin,
  RowFilter,
} from "@/lib/admin-analytics-compute";
import type { TabularDataset } from "@/lib/tabular-dataset";

export const ADMIN_ANALYTICS_SNAPSHOT_VERSION = 1 as const;

export type AdminAnalyticsChartKind = "bar" | "table";

export type AdminAnalyticsBucketSort =
  | "alpha_asc"
  | "alpha_desc"
  | "value_desc"
  | "value_asc";

/** Serializable chart builder state (stored per user in `admin_saved_charts.snapshot`). */
export type AdminAnalyticsChartSnapshot = {
  v: typeof ADMIN_ANALYTICS_SNAPSHOT_VERSION;
  fileLabel: string;
  dataset: TabularDataset;
  categoryField: string | null;
  measureField: string | null;
  aggregate: AggregateMode;
  chartKind: AdminAnalyticsChartKind;
  bucketSort: AdminAnalyticsBucketSort;
  maxChartResults: number;
  maxColorBySegments: number;
  filters: RowFilter[];
  dateBinning: DateBin;
  colorByField: string | null;
  showBarValueLabels: boolean;
  chartBarColorHex: string;
  chartFontSize: number;
  xAxisLabelOverride: string;
  xAxisLabelMaxLen: number;
  yAxisLabelOverride: string;
  yAxisLabelMaxLen: number;
  yScaleMin: string;
  yScaleMax: string;
  includeStackedOther: boolean;
  limitRecentRows: boolean;
  recentRowCount: number;
  yAxisTargets: number[];
};

function isAggregateMode(x: unknown): x is AggregateMode {
  return x === "count" || x === "sum" || x === "avg";
}

function isDateBin(x: unknown): x is DateBin {
  return (
    x === "none" ||
    x === "day" ||
    x === "week" ||
    x === "month" ||
    x === "quarter" ||
    x === "year"
  );
}

function isChartKind(x: unknown): x is AdminAnalyticsChartKind {
  return x === "bar" || x === "table";
}

function isBucketSort(x: unknown): x is AdminAnalyticsBucketSort {
  return (
    x === "alpha_asc" ||
    x === "alpha_desc" ||
    x === "value_desc" ||
    x === "value_asc"
  );
}

function isTabularDataset(x: unknown): x is TabularDataset {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (!Array.isArray(o.headers) || !Array.isArray(o.rows)) return false;
  if (o.kinds != null && (typeof o.kinds !== "object" || Array.isArray(o.kinds))) return false;
  return o.headers.every((h) => typeof h === "string");
}

function normalizeDataset(ds: TabularDataset): TabularDataset {
  const baseKinds =
    ds.kinds && typeof ds.kinds === "object" && !Array.isArray(ds.kinds)
      ? (ds.kinds as TabularDataset["kinds"])
      : {};
  const kinds = ds.headers.every((h) => baseKinds[h] != null)
    ? baseKinds
    : inferFieldTypes(ds.headers, ds.rows);
  return { headers: ds.headers, rows: ds.rows, kinds };
}

export function parseAdminAnalyticsSnapshot(raw: unknown): AdminAnalyticsChartSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== ADMIN_ANALYTICS_SNAPSHOT_VERSION) return null;
  if (!isTabularDataset(o.dataset)) return null;
  if (!isAggregateMode(o.aggregate)) return null;
  if (!isChartKind(o.chartKind)) return null;
  if (!isBucketSort(o.bucketSort)) return null;
  if (!isDateBin(o.dateBinning)) return null;
  if (!Array.isArray(o.filters)) return null;
  if (!Array.isArray(o.yAxisTargets)) return null;

  const dataset = normalizeDataset(o.dataset as TabularDataset);

  return {
    v: ADMIN_ANALYTICS_SNAPSHOT_VERSION,
    fileLabel: typeof o.fileLabel === "string" ? o.fileLabel : "",
    dataset,
    categoryField: typeof o.categoryField === "string" ? o.categoryField : null,
    measureField: typeof o.measureField === "string" ? o.measureField : null,
    aggregate: o.aggregate,
    chartKind: o.chartKind,
    bucketSort: o.bucketSort,
    maxChartResults: typeof o.maxChartResults === "number" && Number.isFinite(o.maxChartResults) ? o.maxChartResults : 20,
    maxColorBySegments:
      typeof o.maxColorBySegments === "number" && Number.isFinite(o.maxColorBySegments)
        ? o.maxColorBySegments
        : 10,
    filters: o.filters as RowFilter[],
    dateBinning: o.dateBinning,
    colorByField: typeof o.colorByField === "string" ? o.colorByField : null,
    showBarValueLabels: Boolean(o.showBarValueLabels),
    chartBarColorHex: typeof o.chartBarColorHex === "string" ? o.chartBarColorHex : "",
    chartFontSize:
      typeof o.chartFontSize === "number" && Number.isFinite(o.chartFontSize) ? o.chartFontSize : 12,
    xAxisLabelOverride: typeof o.xAxisLabelOverride === "string" ? o.xAxisLabelOverride : "",
    xAxisLabelMaxLen:
      typeof o.xAxisLabelMaxLen === "number" && Number.isFinite(o.xAxisLabelMaxLen)
        ? o.xAxisLabelMaxLen
        : 17,
    yAxisLabelOverride: typeof o.yAxisLabelOverride === "string" ? o.yAxisLabelOverride : "",
    yAxisLabelMaxLen:
      typeof o.yAxisLabelMaxLen === "number" && Number.isFinite(o.yAxisLabelMaxLen)
        ? o.yAxisLabelMaxLen
        : 17,
    yScaleMin: typeof o.yScaleMin === "string" ? o.yScaleMin : "auto",
    yScaleMax: typeof o.yScaleMax === "string" ? o.yScaleMax : "auto",
    includeStackedOther: o.includeStackedOther !== false,
    limitRecentRows: Boolean(o.limitRecentRows),
    recentRowCount:
      typeof o.recentRowCount === "number" && Number.isFinite(o.recentRowCount)
        ? o.recentRowCount
        : 5000,
    yAxisTargets: o.yAxisTargets.filter((n): n is number => typeof n === "number" && Number.isFinite(n)),
  };
}
