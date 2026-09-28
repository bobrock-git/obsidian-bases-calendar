// Pure toolbar layout: no Obsidian or DOM imports, so node:test can load it.

export const CALENDAR_VIEWS = ["dayGridMonth", "timeGridWeek", "workWeek", "threeDay", "timeGridDay"] as const;
export type CalendarViewName = typeof CALENDAR_VIEWS[number];

export interface ToolbarLayout {
  left: string;
  center: string;
  right: string;
}

/**
 * Desktop FullCalendar toolbar. The phone toolbar is rendered by React
 * (navigation, range selector, move toggle, filter) with headerToolbar off.
 */
export function toolbarLayout(): ToolbarLayout {
  return {
    left: "title",
    center: "",
    right: `${CALENDAR_VIEWS.join(",")} prev,today,next zoomOut,zoomIn`,
  };
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

// "Only this" a second time on the role that is already alone brings every
// role back, so the same gesture isolates and undoes the isolation.
export function soloSource(allIds: readonly string[], hidden: readonly string[], id: string): string[] {
  const alone = !hidden.includes(id) && allIds.every((item) => item === id || hidden.includes(item));
  return alone ? [] : onlySource(allIds, id);
}

// Hidden roles are remembered per device and per set of roles, so every
// embed of the same calendar shares one choice and reordering the roles in
// the Base does not lose it.
export function filterStorageKey(sourceIds: readonly string[]): string | null {
  return sourceIds.length ? `bases-calendar-hidden-sources:${[...sourceIds].sort().join(",")}` : null;
}

export function parseHiddenSources(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

/** Live label on a block while it is dragged or resized: "09:00–10:30 · 90 min". */
export function liveTimeLabel(start: Date, end: Date | null): string {
  const hm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (!end) return hm(start);
  const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
  return `${hm(start)}–${hm(end)} · ${minutes} min`;
}
