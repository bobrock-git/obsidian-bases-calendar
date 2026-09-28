// Block look in the CRM build: the accent colour says whose date it is (the
// note type), the role icon says what the date is, and an overdue ring says
// the date has passed. Pure functions, so the rules are testable without
// FullCalendar or Obsidian.

const TYPE_NAME = /^[A-Za-z][A-Za-z-]*$/;

// Explicit colour (colorProperty or source.color) wins; otherwise the vault's
// entity token for the note type, e.g. Company -> var(--entity-company-color).
// A type without a token falls back to a neutral stripe instead of an invalid
// declaration, which would also drop the block background.
export function entryAccent(type: string, explicitColor?: string | null): string | null {
  if (explicitColor) return explicitColor;
  const name = type.trim();
  if (!TYPE_NAME.test(name)) return null;
  return `var(--entity-${name.toLowerCase()}-color, var(--text-faint))`;
}

function dayNumber(date: Date): number {
  return date.getFullYear() * 10_000 + date.getMonth() * 100 + date.getDate();
}

// A date is overdue from the day after its last visible day. The day itself
// is not overdue: FullCalendar already marks today's column.
export function isOverdue(start: Date, end: Date | undefined, today: Date): boolean {
  const last = end && end.getTime() > start.getTime() ? end : start;
  return dayNumber(last) < dayNumber(today);
}

export function entryClassNames(accent: string | null, overdue: boolean): string[] {
  const names: string[] = [];
  if (accent) names.push("bases-calendar-accented");
  if (overdue) names.push("is-overdue");
  return names;
}
