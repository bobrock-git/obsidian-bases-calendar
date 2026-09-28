import type { BasesEntry, BasesPropertyId } from "obsidian";

export interface DateSource {
  id: string;
  label: string;
  types: string[];
  startDate: BasesPropertyId;
  endDate?: BasesPropertyId;
  durationProperty?: BasesPropertyId;
  statusProperty?: BasesPropertyId;
  statusEquals?: string;
  statusNot?: string;
  allowTime: boolean;
  color?: string;
}

const noteProperty = (value: unknown): value is BasesPropertyId =>
  typeof value === "string" && /^note\.[a-z][a-z0-9_]*$/i.test(value);

export function parseDateSources(raw: unknown): DateSource[] {
  if (raw == null || raw === "") return [];
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      throw new Error("dateSources must be a JSON array or YAML list");
    }
  }
  if (!Array.isArray(value)) throw new Error("dateSources must be a list");
  const seen = new Set<string>();
  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`dateSources[${index}] must be an object`);
    }
    const source = item as Record<string, unknown>;
    if (typeof source.id !== "string" || !/^[a-z][a-z0-9-]*$/.test(source.id) || seen.has(source.id)) {
      throw new Error(`dateSources[${index}] has an invalid or duplicate id`);
    }
    seen.add(source.id);
    if (typeof source.label !== "string" || !source.label.trim() ||
        !Array.isArray(source.types) || source.types.length === 0 ||
        !source.types.every((type) => typeof type === "string" && type.trim()) ||
        !noteProperty(source.startDate) ||
        (source.endDate != null && !noteProperty(source.endDate)) ||
        (source.durationProperty != null && !noteProperty(source.durationProperty)) ||
        (source.statusProperty != null && !noteProperty(source.statusProperty)) ||
        (source.statusEquals != null && typeof source.statusEquals !== "string") ||
        (source.statusNot != null && typeof source.statusNot !== "string") ||
        (source.color != null && typeof source.color !== "string") ||
        (source.allowTime != null && typeof source.allowTime !== "boolean") ||
        (source.endDate != null && source.durationProperty != null)) {
      throw new Error(`dateSources[${index}] has invalid properties`);
    }
    return {
      id: source.id,
      label: source.label.trim(),
      types: source.types,
      startDate: source.startDate,
      endDate: source.endDate,
      durationProperty: source.durationProperty,
      statusProperty: source.statusProperty,
      statusEquals: source.statusEquals,
      statusNot: source.statusNot,
      allowTime: source.allowTime === true,
      color: source.color,
    } as DateSource;
  });
}

function propertyText(entry: BasesEntry, property: BasesPropertyId): string {
  try {
    return entry.getValue(property)?.toString().trim() ?? "";
  } catch {
    return "";
  }
}

export function matchesDateSource(entry: BasesEntry, source: DateSource): boolean {
  if (!source.types.includes(propertyText(entry, "note.type"))) return false;
  if (!source.statusProperty) return true;
  const status = propertyText(entry, source.statusProperty);
  return (source.statusEquals == null || status === source.statusEquals) &&
    (source.statusNot == null || status !== source.statusNot);
}

export function sourceEventId(path: string, sourceId: string): string {
  return `${path}::${sourceId}`;
}
