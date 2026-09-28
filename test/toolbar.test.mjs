import assert from "node:assert/strict";
import { test } from "node:test";
import { moveToggle, phoneTitleFormat, sourceBadge, toggleSource, toolbarLayout } from "../src/toolbar.ts";

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
