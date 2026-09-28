// Pure toolbar layout: no Obsidian or DOM imports, so node:test can load it.

export const CALENDAR_VIEWS = ["dayGridMonth", "timeGridWeek", "workWeek", "threeDay", "timeGridDay"] as const;
export type CalendarViewName = typeof CALENDAR_VIEWS[number];

export interface ToolbarLayout {
  left: string;
  center: string;
  right: string;
}

/**
 * Desktop keeps the full two-sided toolbar. A phone gets a single row:
 * navigation on the left, the title in the middle and two icon menus on the
 * right (view + zoom, source filter), so the time grid gets the height back.
 */
export function toolbarLayout(isPhone: boolean, hasSources: boolean): ToolbarLayout {
  if (!isPhone) {
    return {
      left: "title",
      center: "",
      right: `${CALENDAR_VIEWS.join(",")} prev,today,next zoomOut,zoomIn`,
    };
  }
  return {
    left: "prev,today,next",
    center: "title",
    right: hasSources ? "viewMenu,sourceMenu" : "viewMenu",
  };
}

/** Short title on a phone: "28 wrz – 2 paź" instead of the full range with year. */
export function phoneTitleFormat(view: string): Record<string, string> {
  return view === "dayGridMonth"
    ? { month: "short", year: "numeric" }
    : { month: "short", day: "numeric" };
}

/** Badge for the phone filter button, e.g. "5/7"; empty when everything is visible. */
export function sourceBadge(total: number, hidden: number): string {
  const visible = Math.max(0, total - hidden);
  return hidden > 0 ? `${visible}/${total}` : "";
}

export function toggleSource(hidden: readonly string[], id: string): string[] {
  return hidden.includes(id) ? hidden.filter((item) => item !== id) : [...hidden, id];
}
