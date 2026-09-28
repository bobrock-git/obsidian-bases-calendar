import assert from "node:assert/strict";
import { test } from "node:test";
import { filterStorageKey, moveToggle, onlySource, parseHiddenSources, phoneTitleFormat, soloSource, sourceBadge, toggleSource, toolbarLayout } from "../src/toolbar.ts";

test("desktop keeps the full toolbar with every view button", () => {
  const layout = toolbarLayout();
  assert.equal(layout.left, "title");
  assert.match(layout.right, /dayGridMonth,timeGridWeek,workWeek,threeDay,timeGridDay/);
  assert.match(layout.right, /zoomOut,zoomIn/);
});

test("phone title format hints at the view", () => {
  assert.deepEqual(phoneTitleFormat("dayGridMonth"), { month: "long", year: "numeric" });
  assert.deepEqual(phoneTitleFormat("timeGridWeek"), { month: "short", day: "numeric" });
  assert.deepEqual(phoneTitleFormat("threeDay"), { month: "short", day: "numeric" });
  assert.deepEqual(phoneTitleFormat("timeGridDay"), { weekday: "short", month: "short", day: "numeric" });
});

test("move toggle switches to 3 days instead of hiding", () => {
  assert.deepEqual(moveToggle("threeDay", false), { moveMode: true });
  assert.deepEqual(moveToggle("timeGridWeek", false), { changeView: "threeDay", moveMode: true });
  assert.deepEqual(moveToggle("dayGridMonth", false), { changeView: "threeDay", moveMode: true });
  assert.deepEqual(moveToggle("threeDay", true), { moveMode: false });
});

test("filter badge only appears when something is hidden", () => {
  assert.equal(sourceBadge(7, 0), "");
  assert.equal(sourceBadge(7, 2), "5/7");
  assert.equal(sourceBadge(2, 5), "0/2");
});

test("toggleSource hides and restores a role without mutating input", () => {
  const hidden = ["event"];
  assert.deepEqual(toggleSource(hidden, "meeting"), ["event", "meeting"]);
  assert.deepEqual(toggleSource(hidden, "event"), []);
  assert.deepEqual(hidden, ["event"]);
});

test("onlySource hides every role except the chosen one", async () => {
  const { onlySource } = await import("../src/toolbar.ts");
  assert.deepEqual(onlySource(["meeting", "event", "followup"], "event"), ["meeting", "followup"]);
  assert.deepEqual(onlySource(["meeting"], "meeting"), []);
});

test("live label shows the span and the minutes written to duration_min", async () => {
  const { liveTimeLabel } = await import("../src/toolbar.ts");
  assert.equal(liveTimeLabel(new Date(2026, 8, 29, 9, 0), new Date(2026, 8, 29, 10, 30)), "09:00–10:30 · 90 min");
  assert.equal(liveTimeLabel(new Date(2026, 8, 29, 23, 30), new Date(2026, 8, 30, 0, 15)), "23:30–00:15 · 45 min");
  assert.equal(liveTimeLabel(new Date(2026, 8, 29, 7, 5), null), "07:05");
});

const ROLES = ["meeting", "followup", "deal-close"];

test("only this isolates a role and a second time brings every role back", () => {
  assert.deepEqual(soloSource(ROLES, [], "followup"), ["meeting", "deal-close"]);
  assert.deepEqual(soloSource(ROLES, ["meeting", "deal-close"], "followup"), []);
});

test("only this on another role moves the isolation instead of resetting", () => {
  assert.deepEqual(soloSource(ROLES, ["meeting", "deal-close"], "meeting"), ["followup", "deal-close"]);
  assert.deepEqual(soloSource(ROLES, ["meeting"], "followup"), ["meeting", "deal-close"]);
});

test("the storage key ignores role order and needs roles", () => {
  assert.equal(filterStorageKey(["meeting", "followup"]), filterStorageKey(["followup", "meeting"]));
  assert.notEqual(filterStorageKey(["meeting"]), filterStorageKey(["meeting", "followup"]));
  assert.equal(filterStorageKey([]), null);
});

test("a damaged stored filter falls back to showing everything", () => {
  assert.deepEqual(parseHiddenSources(JSON.stringify(["followup"])), ["followup"]);
  assert.deepEqual(parseHiddenSources(null), []);
  assert.deepEqual(parseHiddenSources("not json"), []);
  assert.deepEqual(parseHiddenSources(JSON.stringify({ followup: true })), []);
  assert.deepEqual(parseHiddenSources(JSON.stringify(["followup", 3, null])), ["followup"]);
});
