import type {
  EventApi,
  EventClickArg,
  EventContentArg,
  EventDropArg,
  EventMountArg,
  ViewMountArg,
} from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { type EventResizeDoneArg } from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import plLocale from "@fullcalendar/core/locales/pl";
import timeGridPlugin from "@fullcalendar/timegrid";
import { BasesEntry, BasesPropertyId, DateValue, Menu, Platform, Value, setIcon } from "obsidian";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CalendarEntry } from "./calendar-view";
import { useApp } from "./hooks";
import { language, locale, t } from "./i18n";
import { inclusiveAllDayEnd } from "./all-day-end";
import { CALENDAR_VIEWS, onlySource, phoneTitleFormat, viewShortLabelKey, sourceBadge, toggleSource, toolbarLayout } from "./toolbar";

const ZOOM_LEVELS = ["01:00:00", "00:30:00", "00:15:00"] as const;

export interface CalendarHandle {
  updateSize(): void;
}

interface CalendarReactViewProps {
  entries: CalendarEntry[];
  weekStartDay: number;
  initialView: string;
  initialSlotDuration: string;
  scrollToTime: string;
  detailProperty: BasesPropertyId | null;
  properties: BasesPropertyId[];
  onViewChange: (view: string) => void;
  onZoomChange: (slotDuration: string) => void;
  onEntryClick: (entry: BasesEntry, isModEvent: boolean) => void;
  onEntryContextMenu: (evt: React.MouseEvent, entry: CalendarEntry) => void;
  onEventDrop?: (
    entry: CalendarEntry,
    newStart: Date,
    newEnd?: Date,
    allDay?: boolean,
  ) => Promise<void>;
  onEventResize?: (entry: CalendarEntry, newStart: Date, newEnd: Date, allDay: boolean) => Promise<void>;
  editable: boolean;
  resizeEditable: boolean;
  endDateEditable: boolean;
  canEditEntry: (entry: CalendarEntry) => boolean;
  canResizeEntry: (entry: CalendarEntry) => boolean;
  canResizeAllDayEntry: (entry: CalendarEntry) => boolean;
  calendarHandleRef?: React.RefObject<CalendarHandle | null>;
}

export const CalendarReactView: React.FC<CalendarReactViewProps> = ({
  entries,
  weekStartDay,
  initialView,
  initialSlotDuration,
  scrollToTime,
  detailProperty,
  properties,
  onViewChange,
  onZoomChange,
  onEntryClick,
  onEntryContextMenu,
  onEventDrop,
  onEventResize,
  editable,
  resizeEditable,
  endDateEditable,
  canEditEntry,
  canResizeEntry,
  canResizeAllDayEntry,
  calendarHandleRef,
}) => {
  const app = useApp();
  const calendarRef = useRef<FullCalendar>(null);
  const [activeView, setActiveView] = useState(initialView);
  const [moveMode, setMoveMode] = useState(false);
  const moveModeRef = useRef(moveMode);
  moveModeRef.current = moveMode;
  const lastLongPressRef = useRef<{ id: string; at: number } | null>(null);
  const [hiddenSources, setHiddenSources] = useState<string[]>([]);
  const eventListenersRef = useRef(new WeakMap<HTMLElement, () => void>());
  const [slotDuration, setSlotDuration] = useState(initialSlotDuration);
  const slotDurationRef = useRef(initialSlotDuration);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hoverParentRef = useRef<{ hoverPopover: any }>({ hoverPopover: null });

  const handleZoom = useCallback(
    (direction: "in" | "out") => {
      const currentIdx = ZOOM_LEVELS.indexOf(slotDurationRef.current as typeof ZOOM_LEVELS[number]);
      const nextIdx = direction === "in"
        ? Math.min(currentIdx + 1, ZOOM_LEVELS.length - 1)
        : Math.max(currentIdx - 1, 0);
      const next = ZOOM_LEVELS[nextIdx];
      slotDurationRef.current = next;
      setSlotDuration(next);
      onZoomChange(next);
    },
    [onZoomChange],
  );

  const shellRef = useRef<HTMLDivElement>(null);
  const sourceLabelsRef = useRef<[string, string][]>([]);
  const hiddenSourcesRef = useRef<string[]>([]);

  const showAtButton = (menu: Menu, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    menu.showAtPosition({ x: rect.left, y: rect.bottom });
  };

  const viewLabel = (view: string): string => ({
    dayGridMonth: t("monthView"), timeGridWeek: t("weekView"), workWeek: t("workWeek"),
    threeDay: t("threeDay"), timeGridDay: t("dayView"),
  } as Record<string, string>)[view] ?? view;

  const popoverRef = useRef<{ el: HTMLElement; close: () => void } | null>(null);

  const closeSourcePopover = useCallback(() => popoverRef.current?.close(), []);

  const toggleSourcePopover = (anchor: HTMLElement) => {
    if (popoverRef.current) {
      popoverRef.current.close();
      return;
    }
    const pop = document.body.createDiv({ cls: "bases-calendar-source-popover" });
    pop.setAttribute("role", "group");
    pop.setAttribute("aria-label", t("filterEvents"));

    const render = () => {
      pop.empty();
      const hidden = hiddenSourcesRef.current;
      const ids = sourceLabelsRef.current.map(([id]) => id);
      const showAll = pop.createEl("button", { cls: "bases-calendar-source-popover-all", text: t("showAll") });
      showAll.disabled = hidden.length === 0;
      showAll.onclick = () => apply([]);
      for (const [id, label] of sourceLabelsRef.current) {
        const row = pop.createDiv({ cls: "bases-calendar-source-popover-row" });
        // Native label + checkbox: the browser tells a tap from a scroll.
        const lab = row.createEl("label");
        const box = lab.createEl("input", { type: "checkbox" });
        box.checked = !hidden.includes(id);
        box.onchange = () => apply(toggleSource(hiddenSourcesRef.current, id));
        lab.createSpan({ text: label });
        const only = row.createEl("button", { cls: "clickable-icon", text: t("onlyThis") });
        only.onclick = () => apply(onlySource(ids, id));
      }
    };
    const apply = (next: string[]) => {
      hiddenSourcesRef.current = next;
      setHiddenSources(next);
      render();
    };

    const place = () => {
      const rect = anchor.getBoundingClientRect();
      pop.style.top = `${rect.bottom + 4}px`;
      pop.style.right = `${Math.max(8, window.innerWidth - rect.right)}px`;
    };
    const onOutside = (evt: PointerEvent) => {
      const target = evt.target as Node;
      if (!pop.contains(target) && !anchor.contains(target)) close();
    };
    const onKey = (evt: KeyboardEvent) => { if (evt.key === "Escape") close(); };
    const close = () => {
      document.removeEventListener("pointerdown", onOutside, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", place);
      pop.remove();
      anchor.setAttribute("aria-expanded", "false");
      popoverRef.current = null;
    };

    render();
    place();
    document.addEventListener("pointerdown", onOutside, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", place);
    anchor.setAttribute("aria-expanded", "true");
    popoverRef.current = { el: pop, close };
  };

  useEffect(() => closeSourcePopover, [closeSourcePopover]);

  const customButtons = useMemo(
    () => ({
      zoomIn:  { text: "+", hint: t("zoomIn"),  click: () => handleZoom("in") },
      zoomOut: { text: "−", hint: t("zoomOut"), click: () => handleZoom("out") },
      // Phone only: the view switcher and zoom collapse into one icon menu.
      viewMenu: {
        text: "", hint: t("viewMenu"),
        click: (_evt: MouseEvent, el: HTMLElement) => {
          const api = calendarRef.current?.getApi();
          if (!api) return;
          const menu = new Menu();
          for (const view of CALENDAR_VIEWS) {
            menu.addItem((item) => item.setTitle(viewLabel(view))
              .setChecked(api.view.type === view)
              .onClick(() => api.changeView(view)));
          }
          menu.addSeparator();
          menu.addItem((item) => item.setTitle(t("zoomIn")).setIcon("zoom-in").onClick(() => handleZoom("in")));
          menu.addItem((item) => item.setTitle(t("zoomOut")).setIcon("zoom-out").onClick(() => handleZoom("out")));
          showAtButton(menu, el);
        },
      },
      // Phone only: source filter chips collapse into a checklist popover that
      // stays open, so several roles can be toggled in one go.
      sourceMenu: {
        text: "", hint: t("filterEvents"),
        click: (_evt: MouseEvent, el: HTMLElement) => toggleSourcePopover(el),
      },
    }),
    [handleZoom],
  );

  useEffect(() => {
    if (calendarHandleRef) {
      (calendarHandleRef as React.RefObject<CalendarHandle | null>).current = {
        updateSize: () => calendarRef.current?.getApi().updateSize(),
      };
    }
    return () => {
      if (calendarHandleRef) {
        (calendarHandleRef as React.RefObject<CalendarHandle | null>).current = null;
      }
    };
  }, [calendarHandleRef]);

  const sourceLabels = Array.from(new Map(entries
    .filter((item) => item.source)
    .map((item) => [item.source!.id, item.source!.label])).entries());
  sourceLabelsRef.current = sourceLabels;
  hiddenSourcesRef.current = hiddenSources;
  const toolbar = toolbarLayout(Platform.isPhone, sourceLabels.length > 1);

  // FullCalendar renders custom buttons as plain text; give the phone menus
  // Obsidian icons and keep the filter badge in sync with the hidden roles.
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const viewButton = shell.querySelector<HTMLElement>(".fc-viewMenu-button");
    if (viewButton) {
      // Show the active view like a select shows its value: "3 dni ▾".
      const label = t(viewShortLabelKey(activeView));
      if (viewButton.dataset.view !== activeView || !viewButton.querySelector(".bases-calendar-view-label")) {
        viewButton.empty();
        viewButton.createSpan({ cls: "bases-calendar-view-label", text: label });
        const chevron = viewButton.createSpan({ cls: "bases-calendar-view-chevron" });
        setIcon(chevron, "chevron-down");
        viewButton.dataset.view = activeView;
        viewButton.setAttribute("aria-label", `${t("viewMenu")}: ${label}`);
      }
    }
    const sourceButton = shell.querySelector<HTMLElement>(".fc-sourceMenu-button");
    if (sourceButton) {
      if (!sourceButton.querySelector("svg")) setIcon(sourceButton, "filter");
      let badge = sourceButton.querySelector<HTMLElement>(".bases-calendar-source-badge");
      const text = sourceBadge(sourceLabels.length, hiddenSources.length);
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "bases-calendar-source-badge";
        sourceButton.appendChild(badge);
      }
      badge.textContent = text;
      sourceButton.toggleClass("is-filtered", text !== "");
    }
  });
  const events = entries.filter((item) => !item.source || !hiddenSources.includes(item.source.id)).map((calEntry) => {
    // FullCalendar treats allDay end dates as exclusive; add one day to make inclusive.
    let adjustedEndDate = calEntry.endDate;
    if (calEntry.allDay && calEntry.endDate) {
      const startOnly = new Date(
        calEntry.startDate.getFullYear(),
        calEntry.startDate.getMonth(),
        calEntry.startDate.getDate(),
      );
      const endOnly = new Date(
        calEntry.endDate.getFullYear(),
        calEntry.endDate.getMonth(),
        calEntry.endDate.getDate(),
      );
      if (startOnly.getTime() === endOnly.getTime()) {
        adjustedEndDate = undefined;
      } else {
        adjustedEndDate = new Date(calEntry.endDate);
        adjustedEndDate.setDate(adjustedEndDate.getDate() + 1);
      }
    }
    if (!calEntry.allDay && !adjustedEndDate && calEntry.durationMinutes) {
      adjustedEndDate = new Date(
        calEntry.startDate.getTime() + calEntry.durationMinutes * 60_000,
      );
    }

    return {
      id: calEntry.id,
      title: calEntry.source
        ? `${calEntry.source.label}: ${calEntry.entry.file.basename}`
        : calEntry.entry.file.basename,
      start: calEntry.startDate,
      end: adjustedEndDate,
      allDay: calEntry.allDay,
      editable: canEditEntry(calEntry),
      durationEditable: calEntry.allDay
        ? canResizeAllDayEntry(calEntry)
        : canResizeEntry(calEntry),
      backgroundColor: calEntry.backgroundColor,
      borderColor: calEntry.borderColor,
      extendedProps: {
        entry: calEntry.entry,
        calendarEntry: calEntry,
        originalEndDate: calEntry.endDate,
        allDay: calEntry.allDay,
      },
    };
  });

  const handleEventClick = useCallback(
    (clickInfo: EventClickArg) => {
      const target = clickInfo.jsEvent.target as HTMLElement;
      const entry = clickInfo.event.extendedProps.entry as BasesEntry;
      const isModEvent = clickInfo.jsEvent.ctrlKey || clickInfo.jsEvent.metaKey;

      const lastLongPress = lastLongPressRef.current;
      if (moveMode || (lastLongPress?.id === clickInfo.event.id && Date.now() - lastLongPress.at < 1000)) {
        clickInfo.jsEvent.preventDefault();
        return;
      }
      if (target.closest("a.tag")) return;
      if (target.closest(".internal-link")) return;
      const clickedExternal = target.closest("a.external-link") as HTMLAnchorElement | undefined;
      if (clickedExternal?.href) return;
      clickInfo.jsEvent.preventDefault();
      onEntryClick(entry, isModEvent);
    },
    [onEntryClick, moveMode],
  );

  const handleEventMouseEnter = useCallback(
    (mouseEnterInfo: { event: EventApi; el: HTMLElement; jsEvent: MouseEvent }) => {
      const entry = mouseEnterInfo.event.extendedProps.entry as BasesEntry;
      const el = mouseEnterInfo.el;

      if (app) {
        app.workspace.trigger("hover-link", {
          event: mouseEnterInfo.jsEvent,
          source: "bases",
          hoverParent: hoverParentRef.current,
          targetEl: el,
          linktext: entry.file.path,
        });
      }

    },
    [app],
  );

  const handleEventDrop = useCallback(
    async (dropInfo: EventDropArg) => {
      if (!onEventDrop) {
        dropInfo.revert();
        return;
      }

      const entry = dropInfo.event.extendedProps.calendarEntry as CalendarEntry;
      const originalEndDate = dropInfo.event.extendedProps.originalEndDate as Date | undefined;
      const allDay = dropInfo.event.allDay;
      const newStart = dropInfo.event.start;
      const newEnd = dropInfo.event.end;

      if (!newStart || !Number.isFinite(newStart.getTime())) {
        dropInfo.revert();
        return;
      }
      if (
        dropInfo.oldEvent.start?.getTime() === newStart.getTime() &&
        dropInfo.oldEvent.allDay === allDay &&
        dropInfo.oldEvent.end?.getTime() === newEnd?.getTime()
      ) return;

      let actualEndDate: Date | undefined;
      if (originalEndDate) {
        if (allDay && newEnd) {
          actualEndDate = new Date(newEnd);
          actualEndDate.setDate(actualEndDate.getDate() - 1);
        } else if (!allDay && newEnd) {
          actualEndDate = new Date(newEnd);
        } else {
          actualEndDate = new Date(newStart);
        }
      }

      try {
        await onEventDrop(entry, newStart, actualEndDate, allDay);
      } catch {
        dropInfo.revert();
      }
    },
    [onEventDrop],
  );

  const handleEventResize = useCallback(
    async (resizeInfo: EventResizeDoneArg) => {
      const { event } = resizeInfo;
      const { start, end } = event;
      if (
        !onEventResize || (event.allDay && !endDateEditable) || !start || !end ||
        !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) ||
        end.getTime() <= start.getTime()
      ) {
        resizeInfo.revert();
        return;
      }
      try {
        const storedEnd = event.allDay ? inclusiveAllDayEnd(start, end) : end;
        if (!storedEnd) {
          resizeInfo.revert();
          return;
        }
        await onEventResize(event.extendedProps.calendarEntry as CalendarEntry, start, storedEnd, event.allDay);
      } catch {
        resizeInfo.revert();
      }
    },
    [onEventResize, endDateEditable],
  );

  const hasNonEmptyValue = useCallback((value: Value): boolean => {
    if (!value || !value.isTruthy()) return false;
    const str = value.toString();
    return Boolean(str && str.trim().length > 0);
  }, []);

  // Renders a property value with list-aware truncation.
  // Uses Obsidian's renderTo for rich DOM output, then counts the actual child nodes
  // (individual chips/links) to decide truncation — more reliable than string splitting
  // since we don't know the exact separator Obsidian uses for multi-select values.
  const ListPropertyValue: React.FC<{ value: Value; maxItems?: number }> = ({
    value,
    maxItems = 2,
  }) => {
    const nodeRef = useCallback(
      (node: HTMLElement | null) => {
        if (!node || !app) return;
        while (node.firstChild) node.removeChild(node.firstChild);

        if (value instanceof DateValue) {
          if ("date" in value && value.date && value.date instanceof Date) {
            const opts: Intl.DateTimeFormatOptions =
              "time" in value && (value as { time?: unknown }).time
                ? { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
                : { year: "numeric", month: "short", day: "numeric" };
            node.appendChild(
              document.createTextNode(value.date.toLocaleDateString(locale(), opts)),
            );
          }
          return;
        }

        // Render into a detached temp element so we can inspect the output.
        const temp = document.createElement("span");
        value.renderTo(temp, app.renderContext);
        const children = Array.from(temp.childNodes);

        // If Obsidian emitted a single text node, try splitting it by commas to
        // get a meaningful item count (handles "Alice, Bob, Carol" flat strings).
        let effectiveCount = children.length;
        let splitItems: string[] | null = null;
        if (children.length === 1 && children[0].nodeType === Node.TEXT_NODE) {
          const parts = (children[0].textContent ?? "")
            .split(/,\s*/)
            .map((s: string) => s.trim())
            .filter(Boolean);
          if (parts.length > 1) {
            effectiveCount = parts.length;
            splitItems = parts;
          }
        }

        if (effectiveCount <= maxItems) {
          // Few items — move rendered children directly into the target node.
          while (temp.firstChild) node.appendChild(temp.firstChild);
        } else if (splitItems) {
          // Was a single text node that we split — render truncated plain text.
          node.appendChild(
            document.createTextNode(splitItems.slice(0, maxItems).join(", ")),
          );
          const badge = document.createElement("span");
          badge.className = "bases-calendar-prop-overflow";
          badge.textContent = `+${effectiveCount - maxItems}`;
          node.appendChild(badge);
        } else {
          // Multiple child nodes (chips/links) — move first maxItems, then badge.
          children.slice(0, maxItems).forEach((child) => node.appendChild(child));
          const badge = document.createElement("span");
          badge.className = "bases-calendar-prop-overflow";
          badge.textContent = `+${effectiveCount - maxItems}`;
          node.appendChild(badge);
        }
      },
      [value],
    );
    return <span className="bases-calendar-prop-list" ref={nodeRef} />;
  };

  const renderEventContent = useCallback(
    (eventInfo: EventContentArg) => {
      if (!app) return null;

      const entry = eventInfo.event.extendedProps.entry as BasesEntry;
      const calendarEntry = eventInfo.event.extendedProps.calendarEntry as CalendarEntry;

      // Skip detail row for short timed events (≤20 min) to avoid overflow.
      const { start, end, allDay } = eventInfo.event;
      const isShortTimed =
        !allDay &&
        start !== null &&
        end !== null &&
        end.getTime() - start.getTime() <= 20 * 60 * 1000;

      // Title: first valid property from order (or file basename fallback).
      const validProperties: { propertyId: BasesPropertyId; value: Value }[] = [];
      for (const prop of properties) {
        const value = tryGetValue(entry, prop);
        if (value && hasNonEmptyValue(value)) {
          validProperties.push({ propertyId: prop, value });
        }
      }
      const titleProp = validProperties[0];

      // Detail line: use detailProperty if configured, otherwise remaining order props.
      let detailNode: React.ReactNode = null;
      if (isShortTimed) {
        detailNode = null;
      } else if (detailProperty) {
        const detailValue = tryGetValue(entry, detailProperty);
        if (detailValue && hasNonEmptyValue(detailValue)) {
          detailNode = (
            <div className="bases-calendar-event-property">
              <span className="bases-calendar-event-property-value">
                <ListPropertyValue value={detailValue} />
              </span>
            </div>
          );
        }
      } else {
        const restProps = validProperties.slice(1);
        if (restProps.length > 0) {
          detailNode = (
            <>
              {restProps.map(({ propertyId: prop, value }) => (
                <div key={prop} className="bases-calendar-event-property">
                  <span className="bases-calendar-event-property-value">
                    <ListPropertyValue value={value} />
                  </span>
                </div>
              ))}
            </>
          );
        }
      }

      return (
        <div className="bases-calendar-event-content">
          <div className="bases-calendar-event-details">
            <div className="bases-calendar-event-title">
              {calendarEntry.source && <span className="bases-calendar-event-role">{calendarEntry.source.label}: </span>}
              {titleProp
                ? <ListPropertyValue value={titleProp.value} maxItems={1} />
                : entry.file.basename}
            </div>
            {detailNode && (
              <div className="bases-calendar-event-properties">{detailNode}</div>
            )}
          </div>
        </div>
      );
    },
    [properties, detailProperty, app, hasNonEmptyValue],
  );

  const handleViewDidMount = useCallback(
    (arg: ViewMountArg) => {
      setActiveView(arg.view.type);
      setMoveMode(false);
      onViewChange(arg.view.type);
    },
    [onViewChange],
  );

  const handleEventDidMount = useCallback((info: EventMountArg) => {
    const el = info.el;
    const entry = info.event.extendedProps.entry as BasesEntry;
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let startX = 0;
    let startY = 0;

    const clearTimer = () => {
      if (longPressTimer !== null) clearTimeout(longPressTimer);
      longPressTimer = null;
    };
    const showMenu = (evt: MouseEvent) => {
      if ((evt.target as HTMLElement).closest(".fc-event-resizer")) return;
      evt.preventDefault();
      if (Platform.isPhone) evt.stopImmediatePropagation();
      clearTimer();
      if (Platform.isPhone && moveModeRef.current) return;
      const previous = lastLongPressRef.current;
      if (previous?.id === info.event.id && Date.now() - previous.at < 1000 && evt.isTrusted) return;
      if (Platform.isPhone) {
        lastLongPressRef.current = { id: info.event.id, at: Date.now() };
      }
      const syntheticEvent = {
        nativeEvent: evt,
        currentTarget: el,
        target: evt.target as HTMLElement,
        preventDefault: () => evt.preventDefault(),
        stopPropagation: () => evt.stopPropagation(),
      } as unknown as React.MouseEvent;
      onEntryContextMenu(syntheticEvent, info.event.extendedProps.calendarEntry as CalendarEntry);
    };
    const onPointerDown = (evt: PointerEvent) => {
      if (!Platform.isPhone || moveModeRef.current || evt.pointerType !== "touch") return;
      if ((evt.target as HTMLElement).closest(".fc-event-resizer")) return;
      clearTimer();
      startX = evt.clientX;
      startY = evt.clientY;
      longPressTimer = setTimeout(() => {
        // Open the event's own menu without dispatching a bubbling contextmenu
        // to links inside the event or the Obsidian/Bases view.
        showMenu(evt);
      }, 600);
    };
    const onPointerMove = (evt: PointerEvent) => {
      if (Math.hypot(evt.clientX - startX, evt.clientY - startY) > 10) clearTimer();
    };
    const onClickCapture = (evt: MouseEvent) => {
      const previous = lastLongPressRef.current;
      if (previous?.id === info.event.id && Date.now() - previous.at < 1000) {
        evt.preventDefault();
        evt.stopImmediatePropagation();
      }
    };
    el.addEventListener("contextmenu", showMenu, true);
    el.addEventListener("click", onClickCapture, true);
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", clearTimer);
    el.addEventListener("pointercancel", clearTimer);
    eventListenersRef.current.set(el, () => {
      clearTimer();
      el.removeEventListener("contextmenu", showMenu, true);
      el.removeEventListener("click", onClickCapture, true);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", clearTimer);
      el.removeEventListener("pointercancel", clearTimer);
    });
  }, [onEntryContextMenu]);

  const handleEventWillUnmount = useCallback((info: EventMountArg) => {
    eventListenersRef.current.get(info.el)?.();
    eventListenersRef.current.delete(info.el);
  }, []);

  return (
    <div ref={shellRef} className={`bases-calendar-react-shell${Platform.isPhone && activeView === "threeDay" ? " bases-calendar-three-day" : ""}`}>
      {!Platform.isPhone && sourceLabels.length > 1 && (
        <div className="bases-calendar-source-filters" role="group" aria-label={t("filterEvents")}>
          {sourceLabels.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={!hiddenSources.includes(id)}
              className="bases-calendar-source-filter"
              onClick={() => setHiddenSources((current) => toggleSource(current, id))}>
              {label}
            </button>
          ))}
        </div>
      )}
      {Platform.isPhone && editable && activeView === "threeDay" && (
        <button
          type="button"
          className="bases-calendar-move-mode-button"
          aria-pressed={moveMode}
          onClick={() => setMoveMode((current) => !current)}
        >
          {moveMode ? t("stopMove") : t("move")}
        </button>
      )}
    <FullCalendar
      ref={calendarRef}
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
      locales={[plLocale]}
      locale={language()}
      initialView={initialView}
      views={{
        // Month auto-sizes to show all week rows (no inner scroll needed).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dayGridMonth: { contentHeight: "auto" } as any,
        timeGridWeek: {},
        workWeek: {
          type: "timeGridWeek",
          weekends: false,
          buttonText: t("workWeek"),
        },
        threeDay: {
          type: "timeGrid",
          duration: { days: 3 },
          buttonText: t("threeDay"),
        },
        timeGridDay: { buttonText: t("dayView") },
      }}
      firstDay={weekStartDay}
      headerToolbar={toolbar}
      titleFormat={Platform.isPhone ? phoneTitleFormat(activeView) : undefined}
      customButtons={customButtons}
      buttonText={{ today: t("today") }}
      nowIndicator={true}
      scrollTime={scrollToTime}
      slotDuration={slotDuration}
      slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
      eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
      slotEventOverlap={false}
      eventMinHeight={Platform.isPhone && activeView === "threeDay" ? 44 : 20}
      navLinks={false}
      events={events}
      eventContent={renderEventContent}
      eventClassNames={Platform.isPhone && moveMode ? ["bases-calendar-phone-moving"] : []}
      eventDidMount={handleEventDidMount}
      eventWillUnmount={handleEventWillUnmount}
      eventClick={handleEventClick}
      eventMouseEnter={handleEventMouseEnter}
      eventDrop={(info) => {
        void handleEventDrop(info).finally(() => setMoveMode(false));
      }}
      eventResize={(info) => void handleEventResize(info)}
      viewDidMount={handleViewDidMount}
      height="100%"
      fixedWeekCount={false}
      fixedMirrorParent={document.body ?? undefined}
      eventDurationEditable={
        (resizeEditable && (!Platform.isPhone || (activeView === "threeDay" && moveMode))) ||
        (endDateEditable && activeView === "dayGridMonth")
      }
      eventStartEditable={editable && (!Platform.isPhone || (activeView === "threeDay" && moveMode))}
      editable={editable && (!Platform.isPhone || (activeView === "threeDay" && moveMode))}
    />
    </div>
  );
};

function tryGetValue(entry: BasesEntry, propId: BasesPropertyId): Value | null {
  try {
    return entry.getValue(propId);
  } catch {
    return null;
  }
}
