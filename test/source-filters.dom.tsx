// Run the actual React view in Obsidian with synthetic entries and no writes.
// Bundle with esbuild (external: obsidian), then call runFilterTests(app, css).
import React from "react";
import { createRoot } from "react-dom/client";
import { CalendarReactView } from "../src/CalendarReactView";
import { AppContext } from "../src/context";
import type { App } from "obsidian";

export async function runFilterTests(app: App, css: string, phone = false) {
  const host = document.body.createDiv({ cls: "bases-calendar-container" });
  Object.assign(host.style, { position: "fixed", left: "16px", top: "16px", height: "600px", zIndex: "9999", background: "var(--background-primary)" });
  const style = document.head.createEl("style", { text: css });
  const root = createRoot(host);
  const results: unknown[] = [];
  const wait = () => new Promise(resolve => setTimeout(resolve, 90));
  const check = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
  const labels = ["Spotkanie", "Follow-up", "Kampania", "Zamknięcie deala", "Wydarzenie", "Materiały wydarzenia", "Materiały kampanii"];
  const entries = labels.map((label, index) => ({
    id: `test-${index}`, source: { id: `test-${index}`, label, icon: "calendar" },
    entry: { file: { basename: "Synthetic", path: "synthetic.md" } },
    startDate: new Date(2000, 0, 1), allDay: true,
  }));
  const noop = () => {};
  try {
    root.render(<AppContext.Provider value={app}><CalendarReactView
      entries={entries as any} initialView="workWeek" initialDate="2026-10-12"
      weekStartDay={1} filterStorageKey={null} initialSlotDuration="00:30:00" scrollToTime="08:00:00"
      detailProperty={null} properties={[]} onViewChange={noop} onDateChange={noop} onZoomChange={noop}
      onEntryClick={noop} onEntryContextMenu={noop} editable={false} resizeEditable={false} endDateEditable={false}
      canEditEntry={() => false} canResizeEntry={() => false} canResizeAllDayEntry={() => false}
    /></AppContext.Provider>);
    if (phone) {
      host.style.width = "390px";
      await wait();
      check(!host.querySelector(".bases-calendar-source-controls"), "Phone must retain its single toolbar");
      const trigger = host.querySelector<HTMLButtonElement>(".bases-calendar-filter-button")!;
      trigger.click();
      await wait();
      const pop = document.querySelector<HTMLElement>(".bases-calendar-source-popover")!;
      check(pop.querySelectorAll("input").length === 7, "Phone picker lost roles");
      pop.querySelector<HTMLInputElement>("input")!.click();
      await wait();
      check(trigger.textContent?.includes("6/7"), "Phone badge missing");
      pop.querySelector<HTMLButtonElement>(".bases-calendar-source-popover-all")!.click();
      await wait();
      check(!trigger.textContent?.includes("/"), "Phone reset failed");
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      check(!document.querySelector(".bases-calendar-source-popover"), "Phone picker cleanup failed");
      return [{ phone: "390px: existing toolbar, 7 roles, toggle, badge, reset, Escape: PASS" }];
    }
    for (const width of [1200, 1000, 700, 480, 479, 390, 240]) {
      host.style.width = `${width}px`;
      await wait();
      const filters = host.querySelector<HTMLElement>(".bases-calendar-source-filters")!;
      const trigger = host.querySelector<HTMLButtonElement>(".bases-calendar-source-menu")!;
      const chips = Array.from(filters.querySelectorAll<HTMLElement>("button"));
      const compact = getComputedStyle(trigger).display !== "none";
      check(compact === (width < 480), `Wrong layout at ${width}`);
      if (!compact) {
        check(filters.scrollWidth <= filters.clientWidth + 1, `Filter overflow at ${width}`);
        check(chips.every(chip => chip.getBoundingClientRect().right <= filters.getBoundingClientRect().right + 1), `Clipped chip at ${width}`);
      }
      results.push({ width, compact, rows: compact ? 0 : new Set(chips.map(chip => Math.round(chip.getBoundingClientRect().top))).size });
    }
    const trigger = host.querySelector<HTMLButtonElement>(".bases-calendar-source-menu")!;
    trigger.click();
    await wait();
    let pop = document.querySelector<HTMLElement>(".bases-calendar-source-popover")!;
    check(pop && pop.querySelectorAll("input").length === 7, "Picker must expose every role");
    check(pop.contains(document.activeElement), "Opening must move focus into the picker");
    const bounds = pop.getBoundingClientRect();
    check(bounds.left >= 0 && bounds.right <= innerWidth && bounds.bottom <= innerHeight, "Picker outside viewport");
    pop.querySelector<HTMLInputElement>("input")!.click();
    await wait();
    check(trigger.textContent?.includes("6/7"), "Missing active filter count");
    check(pop.querySelector<HTMLInputElement>("input")!.checked === false, "Checkbox state lost");
    check(pop.contains(document.activeElement), "Toggling loses keyboard focus");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    check(!document.querySelector(".bases-calendar-source-popover") && document.activeElement === trigger, "Escape must close and restore focus");
    host.style.width = "700px";
    await wait();
    const chip = host.querySelector<HTMLButtonElement>(".bases-calendar-source-filter")!;
    check(chip.getAttribute("aria-pressed") === "false", "Resizing loses filter selection");
    host.querySelector<HTMLButtonElement>(".bases-calendar-source-reset")!.click();
    await wait();
    check(chip.getAttribute("aria-pressed") === "true", "Reset failed");
    host.style.width = "390px";
    await wait();
    trigger.click();
    await wait();
    pop = document.querySelector<HTMLElement>(".bases-calendar-source-popover")!;
    pop.querySelector<HTMLButtonElement>(".bases-calendar-source-popover-row button")!.click();
    await wait();
    check(trigger.textContent?.includes("1/7"), "Only this failed");
    pop.querySelector<HTMLButtonElement>(".bases-calendar-source-popover-row button")!.click();
    await wait();
    check(!trigger.textContent?.includes("/"), "Second only this must restore all");
    host.style.width = "700px";
    await wait();
    for (let i = 0; i < 30 && document.querySelector(".bases-calendar-source-popover"); i++) await wait();
    check(!document.querySelector(".bases-calendar-source-popover"), "Hidden anchor leaves stale picker");
    check(document.activeElement === chip, "Resize must return focus to a visible chip");
    results.push({ interactions: "7 roles, focus, toggle, count, Escape, resize persistence, reset, solo twice, hidden-anchor cleanup: PASS" });
    return results;
  } finally {
    root.unmount();
    host.remove();
    style.remove();
  }
}
