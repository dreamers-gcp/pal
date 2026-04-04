/** Planova branding accent for this feature */
export const AE_TEAL = "#01696f";
export const AE_TEAL_FG = "#ffffff";
export const AE_TEAL_MUTED = "color-mix(in oklch, #01696f 12%, transparent)";

export const STRICTNESS_OPTIONS: {
  id: "exact" | "conceptual" | "partial";
  label: string;
  hint: string;
}[] = [
  {
    id: "exact",
    label: "Exact Keywords",
    hint: "Match key terms and phrasing closely.",
  },
  {
    id: "conceptual",
    label: "Conceptually Similar",
    hint: "Reward equivalent ideas, varied wording.",
  },
  {
    id: "partial",
    label: "Partial Credit",
    hint: "Generous steps; incomplete work still earns marks.",
  },
];
