import {
  BasesAllOptions,
  BasesEntry,
  BasesPropertyId,
  BasesView,
  DateValue,
  Menu,
  Modal,
  Notice,
  Platform,
  Setting,
  TFile,
  parsePropertyId,
  QueryController,
  setIcon,
} from "obsidian";
import React, { StrictMode } from "react";
import { createRoot, Root } from "react-dom/client";
import { CalendarHandle, CalendarReactView } from "./CalendarReactView";
import { AppContext } from "./context";
import { resolveColor } from "./colors";
import { locale, t } from "./i18n";
import { DateSource, matchesDateSource, parseDateSources, sourceEventId } from "./date-sources";

export const CalendarViewType = "calendar";

export interface CalendarEntry {
  id: string;
  entry: BasesEntry;
  source?: DateSource;
  startDate: Date;
  endDate?: Date;
  durationMinutes?: number;
  allDay: boolean;
  backgroundColor?: string;
  borderColor?: string;
}

export class CalendarView extends BasesView {
  type = CalendarViewType;
  scrollEl: HTMLElement;
  containerEl: HTMLElement;
  root: Root | null = null;
  calendarHandleRef = React.createRef<CalendarHandle | null>();

  private entries: CalendarEntry[] = [];
  private startDateProp: BasesPropertyId | null = null;
  private endDateProp: BasesPropertyId | null = null;
  private durationProp: BasesPropertyId | null = null;
  private colorProp: BasesPropertyId | null = null;
  private detailProp: BasesPropertyId | null = null;
  private dateSources: DateSource[] = [];
  private sourceConfigError = "";
  private weekStartDay: number = 1;
  private scrollToTime: string = "08:00:00";
  private currentView: string = "workWeek";
  private slotDuration: string = "00:30:00";

  constructor(controller: QueryController, scrollEl: HTMLElement) {
    super(controller);
    this.scrollEl = scrollEl;
    this.containerEl = scrollEl.createDiv({
      cls: "bases-calendar-container is-loading",
      attr: { tabIndex: 0 },
    });
  }

  onload(): void {}

  onunload() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    this.entries = [];
  }

  onResize(): void {
    this.calendarHandleRef.current?.updateSize();
  }

  public focus(): void {
    this.containerEl.focus({ preventScroll: true });
  }

  public onDataUpdated(): void {
    this.containerEl.removeClass("is-loading");
    this.loadConfig();
    this.updateCalendar();
  }

  public setEphemeralState(state: unknown): void {
    if (state && typeof state === "object") {
      const s = state as Record<string, unknown>;
      if (typeof s.currentView === "string") this.currentView = s.currentView;
      if (typeof s.slotDuration === "string") this.slotDuration = s.slotDuration;
    }
  }

  public getEphemeralState(): unknown {
    return { currentView: this.currentView, slotDuration: this.slotDuration };
  }

  private loadConfig(): void {
    this.startDateProp = this.config.getAsPropertyId("startDate");
    this.endDateProp = this.config.getAsPropertyId("endDate");
    this.durationProp = this.config.getAsPropertyId("durationProperty");
    this.colorProp = this.config.getAsPropertyId("colorProperty");
    this.detailProp = this.config.getAsPropertyId("detailProperty");
    try {
      this.dateSources = parseDateSources(this.config.get("dateSources"));
      this.sourceConfigError = "";
    } catch (error) {
      this.dateSources = [];
      this.sourceConfigError = String(error);
      console.error("Invalid Bases Calendar dateSources:", error);
    }

    const weekStartDayValue = this.config.get("weekStartDay") as string;
    const dayNameToNumber: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6,
    };
    this.weekStartDay = weekStartDayValue
      ? (dayNameToNumber[weekStartDayValue] ?? 1)
      : 1;

    const scrollTimeValue = this.config.get("scrollToTime") as string;
    this.scrollToTime = scrollTimeValue || "08:00:00";
  }

  private updateCalendar(): void {
    if (this.sourceConfigError || !this.data || (!this.startDateProp && !this.dateSources.length)) {
      this.root?.unmount();
      this.root = null;
      this.containerEl.empty();
      this.containerEl.createDiv("bases-calendar-empty").textContent =
        this.sourceConfigError || t("empty");
      return;
    }

    this.entries = [];
    for (const entry of this.data.data) {
      if (this.dateSources.length) {
        for (const source of this.dateSources) {
          if (!matchesDateSource(entry, source)) continue;
          const item = this.buildCalendarEntry(entry, source.startDate, source.endDate,
            source.durationProperty, source);
          if (item) this.entries.push(item);
        }
      } else if (this.startDateProp) {
        const item = this.buildCalendarEntry(entry, this.startDateProp, this.endDateProp,
          this.durationProp);
        if (item) this.entries.push(item);
      }
    }

    this.renderReactCalendar();
  }

  private buildCalendarEntry(
    entry: BasesEntry,
    startProperty: BasesPropertyId,
    endProperty?: BasesPropertyId | null,
    durationProperty?: BasesPropertyId | null,
    source?: DateSource,
  ): CalendarEntry | null {
    const result = this.extractDate(entry, startProperty);
    if (!result) return null;
    const endDate = endProperty ? this.extractDate(entry, endProperty)?.date : undefined;
    const durationMinutes = durationProperty ? this.extractDuration(entry, durationProperty) : undefined;
    let colorProps: Pick<CalendarEntry, "backgroundColor" | "borderColor"> = {};
    try {
      const color = this.colorProp ? entry.getValue(this.colorProp)?.toString() : source?.color;
      const resolved = resolveColor(color || source?.color);
      if (resolved) colorProps = resolved;
    } catch {
      // An invalid color does not hide a dated entry.
    }
    return {
      id: source ? sourceEventId(entry.file.path, source.id) : entry.file.path,
      entry,
      source,
      startDate: result.date,
      endDate,
      durationMinutes,
      allDay: !result.hasTimed,
      ...colorProps,
    };
  }

  private renderReactCalendar(): void {
    if (!this.root) {
      this.root = createRoot(this.containerEl);
    }

    this.root.render(
      <StrictMode>
        <AppContext.Provider value={this.app}>
          <CalendarReactView
            entries={this.entries}
            weekStartDay={this.weekStartDay}
            initialView={this.currentView}
            initialSlotDuration={this.slotDuration}
            scrollToTime={this.scrollToTime}
            detailProperty={this.detailProp}
            properties={this.config.getOrder() || []}
            onViewChange={(view) => { this.currentView = view; }}
            onZoomChange={(dur) => { this.slotDuration = dur; }}
            onEntryClick={(entry, isModEvent) => {
              void this.app.workspace.openLinkText(
                entry.file.path,
                "",
                isModEvent,
              );
            }}
            onEntryContextMenu={(evt, calendarEntry) => {
              evt.preventDefault();
              this.showEntryContextMenu(evt.nativeEvent, calendarEntry);
            }}
            onEventDrop={(calendarEntry, newStart, newEnd, allDay) =>
              this.updateEntryDates(calendarEntry, newStart, newEnd, allDay)
            }
            onEventResize={(calendarEntry, newStart, newEnd, allDay) =>
              allDay
                ? this.updateEntryAllDayEnd(calendarEntry, newStart, newEnd)
                : this.updateEntryDuration(calendarEntry, newStart, newEnd)
            }
            editable={this.isEditable()}
            resizeEditable={this.isResizeEditable()}
            endDateEditable={this.isEndDateEditable()}
            canEditEntry={(item) => this.isEntryEditable(item)}
            canResizeEntry={(item) => this.isEntryResizeEditable(item)}
            canResizeAllDayEntry={(item) => this.isEntryEndDateEditable(item)}
            calendarHandleRef={this.calendarHandleRef}
          />
        </AppContext.Provider>
      </StrictMode>,
    );
  }

  private isEditable(): boolean {
    if (this.dateSources.length) return this.dateSources.some((source) =>
      this.isSourceEditable(source));
    if (!this.startDateProp) return false;
    const startDateProperty = parsePropertyId(this.startDateProp);
    if (startDateProperty.type !== "note") return false;

    if (!this.endDateProp) return true;
    const endDateProperty = parsePropertyId(this.endDateProp);
    if (endDateProperty.type !== "note") return false;

    return true;
  }

  private isResizeEditable(): boolean {
    if (this.dateSources.length) return this.dateSources.some((source) =>
      this.isSourceEditable(source) && Boolean(source.endDate || source.durationProperty));
    if (!this.isEditable()) return false;
    const property = this.endDateProp ?? this.durationProp;
    return Boolean(property && parsePropertyId(property).type === "note");
  }

  private isEndDateEditable(): boolean {
    if (this.dateSources.length) return this.dateSources.some((source) =>
      this.isSourceEditable(source) && Boolean(source.endDate));
    return this.isEditable() && Boolean(
      this.endDateProp && parsePropertyId(this.endDateProp).type === "note",
    );
  }

  private isSourceEditable(source: DateSource): boolean {
    return Boolean(source.startDate.startsWith("note.") &&
      (!source.endDate || source.endDate.startsWith("note.")) &&
      (!source.durationProperty || source.durationProperty.startsWith("note.")));
  }

  private isEntryEditable(item: CalendarEntry): boolean {
    return item.source ? this.isSourceEditable(item.source) : this.isEditable();
  }

  private isEntryResizeEditable(item: CalendarEntry): boolean {
    if (!this.isEntryEditable(item)) return false;
    return item.source
      ? Boolean(item.source.endDate || item.source.durationProperty)
      : this.isResizeEditable();
  }

  private isEntryEndDateEditable(item: CalendarEntry): boolean {
    if (!this.isEntryEditable(item)) return false;
    return item.source ? Boolean(item.source.endDate) : this.isEndDateEditable();
  }

  private extractDuration(entry: BasesEntry, propId: BasesPropertyId): number | undefined {
    try {
      const value = entry.getValue(propId);
      if (!value) return undefined;
      const minutes = Number(value.toString());
      return Number.isFinite(minutes) && minutes > 0 ? minutes : undefined;
    } catch {
      return undefined;
    }
  }

  private extractDate(
    entry: BasesEntry,
    propId: BasesPropertyId,
  ): { date: Date; hasTimed: boolean } | null {
    try {
      const value = entry.getValue(propId);
      if (!value) return null;
      if (!(value instanceof DateValue)) return null;
      // Private API — DateValue exposes .date and .time
      if ("date" in value && value.date && value.date instanceof Date) {
        const hasTimed = Boolean("time" in value && (value as { time?: unknown }).time);
        return { date: value.date, hasTimed };
      }
      return null;
    } catch (error) {
      console.error(`Error extracting date for ${entry.file.name}:`, error);
      return null;
    }
  }

  private showEntryContextMenu(evt: MouseEvent, calendarEntry: CalendarEntry): void {
    const file = calendarEntry.entry.file;
    if (Platform.isPhone) {
      // A shared context menu also receives actions for links rendered inside the
      // event. A private menu keeps this menu about the event's own note.
      const menu = new Menu();
      if (this.isEntryEditable(calendarEntry)) {
        menu.addItem((item) =>
          item
            .setSection("reschedule")
            .setTitle(t("reschedule"))
            .setIcon("calendar-clock")
            .onClick(() => {
              new RescheduleModal(this.app, calendarEntry, (start, end, allDay) =>
                this.updateEntryDates(calendarEntry, start, end, allDay),
              ).open();
            }),
        );
        menu.addSeparator();
      }
      menu.addItem((item) =>
        item
          .setSection("navigation")
          .setTitle(t("openNote"))
          .setIcon("file-text")
          .onClick(() => void this.app.workspace.openLinkText(file.path, "", false)),
      );
      menu.addItem((item) =>
        item
          .setSection("navigation")
          .setTitle(t("openTab"))
          .setIcon("file-plus")
          .onClick(() => void this.app.workspace.openLinkText(file.path, "", true)),
      );
      menu.showAtMouseEvent(evt);
      return;
    }

    const menu = Menu.forEvent(evt);
    this.app.workspace.handleLinkContextMenu(menu, file.path, "");
    if (this.isEntryEditable(calendarEntry)) {
      menu.addItem((item) =>
        item
          .setSection("action")
          .setTitle(t("reschedule"))
          .setIcon("calendar-clock")
          .onClick(() => {
            new RescheduleModal(this.app, calendarEntry, (start, end, allDay) =>
              this.updateEntryDates(calendarEntry, start, end, allDay),
            ).open();
          }),
      );
    }
    menu.addItem((item) =>
      item
        .setSection("danger")
        .setTitle(t("deleteFile"))
        .setIcon("lucide-trash-2")
        .setWarning(true)
        .onClick(() => this.app.fileManager.promptForDeletion(file)),
    );
  }

  private assertSourceUnchanged(item: CalendarEntry, frontmatter: Record<string, unknown>): void {
    const source = item.source;
    if (!source) return;
    if (!source.types.includes(String(frontmatter.type ?? "")) ||
        (source.statusProperty && source.statusEquals != null &&
          String(frontmatter[source.statusProperty.slice(5)] ?? "") !== source.statusEquals) ||
        (source.statusProperty && source.statusNot != null &&
          String(frontmatter[source.statusProperty.slice(5)] ?? "") === source.statusNot)) {
      throw new Error("The event no longer belongs to this calendar source");
    }
    const original = item.allDay ? formatDate(item.startDate) : formatDateTime(item.startDate);
    const currentStart = frontmatter[source.startDate.slice(5)];
    if (typeof currentStart === "string" && !currentStart.startsWith(original)) {
      throw new Error("The event date changed since the calendar was loaded");
    }
    if (source.endDate) {
      const rawEnd = frontmatter[source.endDate.slice(5)];
      const current = typeof rawEnd === "string" ? rawEnd : "";
      const previous = item.endDate
        ? (item.allDay ? formatDate(item.endDate) : formatDateTime(item.endDate))
        : "";
      if (typeof rawEnd === "string" &&
          (previous ? !current.startsWith(previous) : Boolean(current))) {
        throw new Error("The event end changed since the calendar was loaded");
      }
    }
  }

  private async updateEntryDates(
    item: CalendarEntry,
    newStart: Date,
    newEnd?: Date,
    allDay?: boolean,
  ): Promise<void> {
    const source = item.source;
    const startProperty = source?.startDate ?? this.startDateProp;
    const endProperty = source?.endDate ?? this.endDateProp;
    if (!startProperty || !this.isEntryEditable(item) || !Number.isFinite(newStart.getTime()) ||
        (source && !source.allowTime && !allDay)) {
      throw new Error("Invalid event start date");
    }
    if (newEnd && !Number.isFinite(newEnd.getTime())) {
      throw new Error("Invalid event end date");
    }

    const file = item.entry.file;
    const extractedStartProp = startProperty.startsWith("note.")
      ? startProperty.slice(5)
      : null;
    const extractedEndProp = endProperty?.startsWith("note.")
      ? endProperty.slice(5)
      : null;

    if (
      extractedStartProp === null ||
      (endProperty && extractedEndProp === null) ||
      (newEnd && allDay && formatDate(newEnd) < formatDate(newStart))
    ) {
      throw new Error("Date properties are not editable note properties");
    }

    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      this.assertSourceUnchanged(item, frontmatter);
      frontmatter[extractedStartProp] = allDay
        ? formatDate(newStart)
        : formatDateTime(newStart);

      if (endProperty && newEnd && extractedEndProp) {
        frontmatter[extractedEndProp] = allDay
          ? formatDate(newEnd)
          : formatDateTime(newEnd);
      }
    });
  }

  private async updateEntryDuration(
    item: CalendarEntry,
    newStart: Date,
    newEnd: Date,
  ): Promise<void> {
    if (!this.isEntryResizeEditable(item)) throw new Error("Event cannot be resized");
    const endProperty = item.source?.endDate ?? this.endDateProp;
    const property = endProperty ?? item.source?.durationProperty ?? this.durationProp;
    const field = property?.startsWith("note.") ? property.slice(5) : null;
    const milliseconds = newEnd.getTime() - newStart.getTime();
    if (!field || !Number.isFinite(milliseconds) || milliseconds < 60_000) {
      throw new Error("Invalid event duration");
    }

    await this.app.fileManager.processFrontMatter(item.entry.file, (frontmatter) => {
      this.assertSourceUnchanged(item, frontmatter);
      frontmatter[field] = endProperty
        ? formatDateTime(newEnd)
        : Math.round(milliseconds / 60_000);
    });
  }

  private async updateEntryAllDayEnd(
    item: CalendarEntry,
    newStart: Date,
    inclusiveEnd: Date,
  ): Promise<void> {
    const endProperty = item.source?.endDate ?? this.endDateProp;
    const field = endProperty?.startsWith("note.")
      ? endProperty.slice(5)
      : null;
    if (!this.isEntryEndDateEditable(item) || !field || !Number.isFinite(inclusiveEnd.getTime()) ||
        formatDate(inclusiveEnd) < formatDate(newStart)) {
      throw new Error("Invalid all-day event end date");
    }
    await this.app.fileManager.processFrontMatter(item.entry.file, (frontmatter) => {
      this.assertSourceUnchanged(item, frontmatter);
      frontmatter[field] = item.source && formatDate(inclusiveEnd) === formatDate(newStart)
        ? "" : formatDate(inclusiveEnd);
    });
  }

  static getViewOptions(): BasesAllOptions[] {
    return [
      {
        displayName: t("dateProperties"),
        type: "group",
        items: [
          {
            displayName: t("dateSources"),
            type: "text",
            key: "dateSources",
            placeholder: t("dateSourcesHint"),
          },
          {
            displayName: t("startDate"),
            type: "property",
            key: "startDate",
            placeholder: t("property"),
          },
          {
            displayName: t("endDate"),
            type: "property",
            key: "endDate",
            placeholder: t("property"),
          },
          {
            displayName: t("duration"),
            type: "property",
            key: "durationProperty",
            placeholder: t("property"),
          },
        ],
      },
      {
        displayName: t("eventDisplay"),
        type: "group",
        items: [
          {
            displayName: t("detailProperty"),
            type: "property",
            key: "detailProperty",
            placeholder: t("detailHint"),
          },
          {
            displayName: t("colorProperty"),
            type: "property",
            key: "colorProperty",
            placeholder: t("colorHint"),
          },
        ],
      },
      {
        displayName: t("calendarOptions"),
        type: "group",
        items: [
          {
            displayName: t("weekStarts"),
            type: "dropdown",
            key: "weekStartDay",
            default: "monday",
            options: {
              sunday: t("sunday"),
              monday: t("monday"),
              tuesday: t("tuesday"),
              wednesday: t("wednesday"),
              thursday: t("thursday"),
              friday: t("friday"),
              saturday: t("saturday"),
            },
          },
          {
            displayName: t("dayStarts"),
            type: "dropdown",
            key: "scrollToTime",
            default: "08:00:00",
            options: {
              "00:00:00": t("midnight"),
              "06:00:00": "06:00",
              "07:00:00": "07:00",
              "08:00:00": "08:00",
              "09:00:00": "09:00",
              "10:00:00": "10:00",
            },
          },
        ],
      },
    ];
  }
}

class RescheduleModal extends Modal {
  constructor(
    app: CalendarView["app"],
    private readonly calendarEntry: CalendarEntry,
    private readonly onSave: (start: Date, end: Date | undefined, allDay: boolean) => Promise<void>,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    const { startDate, endDate, allDay } = this.calendarEntry;
    this.modalEl.addClass("bases-calendar-reschedule-modal");
    contentEl.empty();
    const file = this.calendarEntry.entry.file;
    let title = file.basename;
    const cachedTitle = this.app.metadataCache.getFileCache(file)?.frontmatter?.title;
    if (typeof cachedTitle === "string" && cachedTitle.trim()) title = cachedTitle.trim();
    try {
      const value = this.calendarEntry.entry.getValue("note.title");
      if (value?.isTruthy()) title = value.toString().trim() || title;
    } catch {
      // Keep the file name when this Base does not expose note.title.
    }
    const heading = contentEl.createEl("h2", { cls: "bases-calendar-reschedule-title" });
    const iconName = typeof this.app.metadataCache.getFileCache(file)?.frontmatter?.icon === "string"
      ? String(this.app.metadataCache.getFileCache(file)?.frontmatter?.icon).replace(/^lucide[-/:]+/, "").trim()
      : "";
    if (iconName) {
      const icon = heading.createSpan({ cls: "bases-calendar-reschedule-entity-icon", attr: { "aria-hidden": "true" } });
      setIcon(icon, iconName);
      if (!icon.querySelector("svg")) icon.remove();
    }
    heading.createSpan({ text: title });
    const entityType = this.app.metadataCache.getFileCache(file)?.frontmatter?.type;
    if (typeof entityType === "string") void this.applyVaultEntityIcon(heading, entityType);
    contentEl.createEl("p", {
      text: this.calendarEntry.source
        ? `${t("reschedule")} — ${this.calendarEntry.source.label}`
        : t("reschedule"),
      cls: "bases-calendar-reschedule-subtitle",
    });

    let dateInput!: HTMLInputElement;
    let timeInput: HTMLInputElement | undefined;
    const canSetTime = !this.calendarEntry.source || this.calendarEntry.source.allowTime;
    let selectedAllDay = allDay;
    new Setting(contentEl).setName(t("date")).addText((text) => {
      dateInput = text.inputEl;
      dateInput.type = "date";
      dateInput.value = formatDate(startDate);
      dateInput.setAttribute("aria-label", t("newDate"));
    });
    const weekendNotice = contentEl.createDiv({
      cls: "bases-calendar-weekend-notice",
      attr: { role: "status", "aria-live": "polite" },
    });
    const shortcuts = contentEl.createDiv({
      cls: "bases-calendar-date-shortcuts",
      attr: { role: "group", "aria-label": t("quickDates") },
    });
    const shortcutButtons: { day: string; button: HTMLButtonElement }[] = [];
    const syncDateState = () => {
      for (const { day, button } of shortcutButtons) {
        const selected = dateInput.value === day;
        button.setAttribute("aria-pressed", String(selected));
        button.toggleClass("is-selected", selected);
      }
      const selectedDate = parseLocalDate(dateInput.value, undefined, true);
      const weekday = selectedDate?.getDay();
      const isWeekend = weekday === 0 || weekday === 6;
      dateInput.toggleClass("is-weekend", isWeekend);
      weekendNotice.hidden = !isWeekend;
      weekendNotice.setText(isWeekend
        ? `${weekday === 6 ? t("saturday") : t("sunday")} — ${t("weekend")}`
        : "");
    };
    for (const [label, days] of [
      [t("tomorrow"), 1],
      [t("dayAfterTomorrow"), 2],
      [t("nextWeek"), 7],
    ] as const) {
      const target = new Date();
      target.setDate(target.getDate() + days);
      const day = formatDate(target);
      const weekday = target.getDay();
      const isWeekend = weekday === 0 || weekday === 6;
      const dateLabel = target.toLocaleDateString(locale(), { day: "2-digit", month: "2-digit" });
      const weekdayLabel = weekday === 6 ? t("saturdayShort") : t("sundayShort");
      const button = shortcuts.createEl("button", {
        cls: "bases-calendar-date-shortcut",
        attr: {
          type: "button",
          "aria-label": `${label}, ${target.toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`,
          "aria-pressed": "false",
        },
      });
      const labelRow = button.createSpan({ cls: "bases-calendar-date-shortcut-label" });
      labelRow.createSpan({ text: label });
      const check = labelRow.createSpan({ cls: "bases-calendar-date-shortcut-check", attr: { "aria-hidden": "true" } });
      setIcon(check, "check");
      button.createSpan({
        text: isWeekend ? `${weekdayLabel} ${dateLabel}` : dateLabel,
        cls: `bases-calendar-date-shortcut-value${isWeekend ? " is-weekend" : ""}`,
      });
      button.addEventListener("click", () => {
        dateInput.value = day;
        dateInput.dispatchEvent(new Event("change", { bubbles: true }));
      });
      shortcutButtons.push({ day, button });
    }
    dateInput.addEventListener("input", syncDateState);
    dateInput.addEventListener("change", syncDateState);
    syncDateState();
    if (canSetTime) {
      new Setting(contentEl).setName(t("allDay")).addToggle((toggle) => {
        toggle.setValue(allDay).onChange((value) => {
          selectedAllDay = value;
          if (timeInput) timeInput.disabled = value;
        });
      });
      new Setting(contentEl).setName(t("time")).addText((text) => {
        timeInput = text.inputEl;
        timeInput.type = "time";
        timeInput.value = allDay ? "09:00" : formatTime(startDate);
        timeInput.disabled = allDay;
        timeInput.setAttribute("aria-label", t("newTime"));
      });
    }

    new Setting(contentEl).setClass("bases-calendar-reschedule-actions")
      .addButton((button) =>
        button.setButtonText(t("cancel")).onClick(() => this.close()),
      )
      .addButton((button) =>
        button
          .setButtonText(t("save"))
          .setCta()
          .onClick(async () => {
            const nextStart = parseLocalDate(dateInput.value, timeInput?.value, selectedAllDay);
            if (!nextStart) {
              new Notice(t("invalidDate"));
              return;
            }
            const nextEnd = shiftEndDate(startDate, endDate, nextStart, allDay);
            button.setDisabled(true);
            try {
              await this.onSave(nextStart, nextEnd, selectedAllDay);
              this.close();
              new Notice(t("saved"));
            } catch (error) {
              console.error("Could not reschedule calendar entry:", error);
              new Notice(t("saveFailed"));
              button.setDisabled(false);
            }
          }),
      );
  }

  private async applyVaultEntityIcon(heading: HTMLElement, entityType: string): Promise<void> {
    const registryFile = this.app.vault.getAbstractFileByPath("system/registry/registry-ikony.json");
    if (!(registryFile instanceof TFile)) return;
    try {
      const registry = JSON.parse(await this.app.vault.cachedRead(registryFile)) as {
        categories?: { id?: string; items?: { id?: string; lucide_name?: string; color?: string }[] }[];
      };
      const entityIcons = registry.categories?.find((category) => category.id === "encje_h1_i_taby")?.items;
      const item = entityIcons?.find((candidate) => candidate.id === `entity-${entityType.toLowerCase()}`);
      if (!item?.lucide_name || !item.id || !/^entity-[a-z-]+$/.test(item.id) || !heading.isConnected) return;
      let icon = heading.querySelector<HTMLElement>(".bases-calendar-reschedule-entity-icon");
      if (!icon) {
        icon = document.createElement("span");
        icon.className = "bases-calendar-reschedule-entity-icon";
        icon.setAttribute("aria-hidden", "true");
        setIcon(icon, item.lucide_name);
        if (!icon.querySelector("svg")) return;
        heading.prepend(icon);
      }
      icon.style.color = `var(--${item.id}-color, ${item.color || "var(--text-muted)"})`;
    } catch (error) {
      console.warn("Could not load vault entity icon:", error);
    }
  }
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function parseLocalDate(day: string, time: string | undefined, allDay: boolean): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText) - 1;
  const date = Number(dayText);
  let hour = 0;
  let minute = 0;
  if (!allDay) {
    const timeMatch = /^(\d{2}):(\d{2})$/.exec(time ?? "");
    if (!timeMatch) return null;
    hour = Number(timeMatch[1]);
    minute = Number(timeMatch[2]);
  }
  const result = new Date(year, month, date, hour, minute);
  if (
    result.getFullYear() !== year ||
    result.getMonth() !== month ||
    result.getDate() !== date ||
    result.getHours() !== hour ||
    result.getMinutes() !== minute
  ) return null;
  return result;
}

function shiftEndDate(
  oldStart: Date,
  oldEnd: Date | undefined,
  newStart: Date,
  allDay: boolean,
): Date | undefined {
  if (!oldEnd) return undefined;
  if (!allDay) return new Date(newStart.getTime() + oldEnd.getTime() - oldStart.getTime());
  const oldStartDay = Date.UTC(oldStart.getFullYear(), oldStart.getMonth(), oldStart.getDate());
  const oldEndDay = Date.UTC(oldEnd.getFullYear(), oldEnd.getMonth(), oldEnd.getDate());
  const dayOffset = Math.round((oldEndDay - oldStartDay) / 86_400_000);
  const newEnd = new Date(newStart);
  newEnd.setDate(newEnd.getDate() + dayOffset);
  return newEnd;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateTime(date: Date): string {
  const base = formatDate(date);
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${base}T${h}:${min}`;
}
