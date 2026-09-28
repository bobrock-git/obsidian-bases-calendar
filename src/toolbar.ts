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
export function toolbarLayout(isPhone: boolean, hasSources: boolean, canMove = false): ToolbarLayout {
  if (!isPhone) {
    return {
      left: "title",
      center: "",
      right: `${CALENDAR_VIEWS.join(",")} prev,today,next zoomOut,zoomIn`,
    };
  }
  // The date range itself is the view selector ("28 wrz – 2 paź ▾").
  const right = [canMove ? "moveMode" : "", hasSources ? "sourceMenu" : ""].filter(Boolean).join(",");
  return { left: "prev,today,next", center: "rangeMenu", right };
}

/**
 * Phone "move events" toggle. Moving is only offered in the 3-day view (week
 * blocks are too narrow for a finger), so switching it on elsewhere first
 * switches to 3 days instead of hiding or disabling the button.
 */
export function moveToggle(activeView: string, moveMode: boolean): { changeView?: "threeDay"; moveMode: boolean } {
  if (moveMode) return { moveMode: false };
  return activeView === "threeDay" ? { moveMode: true } : { changeView: "threeDay", moveMode: true };
}

/** Short title on a phone: "wrzesień 2026", "28 wrz – 2 paź", "pon., 28 wrz". The format hints at the view. */
export function phoneTitleFormat(view: string): Record<string, string> {
  if (view === "dayGridMonth") return { month: "long", year: "numeric" };
  if (view === "timeGridDay") return { weekday: "short", month: "short", day: "numeric" };
  return { month: "short", day: "numeric" };
}

/** Badge for the phone filter button, e.g. "5/7"; empty when everything is visible. */
export function sourceBadge(total: number, hidden: number): string {
  const visible = Math.max(0, total - hidden);
  return hidden > 0 ? `${visible}/${total}` : "";
}

export function toggleSource(hidden: readonly string[], id: string): string[] {
  return hidden.includes(id) ? hidden.filter((item) => item !== id) : [...hidden, id];
}

/** "Only this" in the filter popover: hide every other role. */
export function onlySource(allIds: readonly string[], id: string): string[] {
  return allIds.filter((item) => item !== id);
}
