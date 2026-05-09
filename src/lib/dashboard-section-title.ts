/** Fired when the main dashboard section tab changes (professor / student / admin). */
export const DASHBOARD_SECTION_TITLE_EVENT = "pal:dashboard-section-title";

export type DashboardSectionTitleDetail = { title: string };

export function dispatchDashboardSectionTitle(title: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<DashboardSectionTitleDetail>(DASHBOARD_SECTION_TITLE_EVENT, {
      detail: { title },
    })
  );
}

export function clearDashboardSectionTitle() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<DashboardSectionTitleDetail>(DASHBOARD_SECTION_TITLE_EVENT, {
      detail: { title: "" },
    })
  );
}
