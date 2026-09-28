import assert from "node:assert/strict";
import { test } from "node:test";
import { phoneTitleFormat, sourceBadge, toggleSource, toolbarLayout } from "../src/toolbar.ts";

test("desktop keeps the full toolbar with every view button", () => {
  const layout = toolbarLayout(false, true);
  assert.equal(layout.left, "title");
  assert.match(layout.right, /dayGridMonth,timeGridWeek,workWeek,threeDay,timeGridDay/);
  assert.match(layout.right, /zoomOut,zoomIn/);
  assert.doesNotMatch(layout.right, /Menu/);
});

test("phone fits one row: navigation, title, icon menus", () => {
  assert.deepEqual(toolbarLayout(true, true),
    { left: "prev,today,next", center: "title", right: "viewMenu,sourceMenu" });
});

test("phone without date roles has no filter menu", () => {
  assert.equal(toolbarLayout(true, false).right, "viewMenu");
});

test("phone title drops the year except in month view", () => {
  assert.deepEqual(phoneTitleFormat("timeGridWeek"), { month: "short", day: "numeric" });
  assert.deepEqual(phoneTitleFormat("dayGridMonth"), { month: "short", year: "numeric" });
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

test("phone view button label follows the active view", async () => {
  const { viewShortLabelKey } = await import("../src/toolbar.ts");
  assert.equal(viewShortLabelKey("dayGridMonth"), "shortMonth");
  assert.equal(viewShortLabelKey("timeGridWeek"), "shortWeek");
  assert.equal(viewShortLabelKey("workWeek"), "shortWorkWeek");
  assert.equal(viewShortLabelKey("threeDay"), "threeDay");
  assert.equal(viewShortLabelKey("timeGridDay"), "dayView");
});
