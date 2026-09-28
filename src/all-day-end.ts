// FullCalendar's all-day end is exclusive; note properties store the last visible day.
export function inclusiveAllDayEnd(start: Date, exclusiveEnd: Date): Date | null {
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(exclusiveEnd.getTime()) ||
      exclusiveEnd.getTime() <= start.getTime()) return null;
  const result = new Date(exclusiveEnd);
  result.setDate(result.getDate() - 1);
  return result.getTime() >= new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
    ? result
    : null;
}
