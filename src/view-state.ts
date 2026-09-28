/**
 * What a leaf remembers about the calendar between visits. Obsidian keeps
 * this ephemeral state in the tab history, so "back" returns to the same
 * range instead of today.
 */
export interface CalendarViewState {
  currentView?: string;
  slotDuration?: string;
  /** First visible day, local time, `YYYY-MM-DD`. */
  date?: string;
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Accepts only a real calendar day; anything else leaves today in place. */
export function isIsoDay(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = ISO_DAY.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** Local day of a Date as `YYYY-MM-DD` – not `toISOString`, which shifts to UTC. */
export function toIsoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function readViewState(state: unknown): CalendarViewState {
  if (!state || typeof state !== "object") return {};
  const s = state as Record<string, unknown>;
  const result: CalendarViewState = {};
  if (typeof s.currentView === "string") result.currentView = s.currentView;
  if (typeof s.slotDuration === "string") result.slotDuration = s.slotDuration;
  if (isIsoDay(s.date)) result.date = s.date;
  return result;
}
