import assert from "node:assert/strict";
import { test } from "node:test";
import { isIsoDay, readViewState, toIsoDay } from "../src/view-state.ts";

test("a saved range comes back with its first day", () => {
  assert.deepEqual(
    readViewState({ currentView: "dayGridMonth", slotDuration: "00:15:00", date: "2026-10-01" }),
    { currentView: "dayGridMonth", slotDuration: "00:15:00", date: "2026-10-01" },
  );
});

test("state written before the date existed still restores view and zoom", () => {
  assert.deepEqual(readViewState({ currentView: "workWeek", slotDuration: "00:30:00" }),
    { currentView: "workWeek", slotDuration: "00:30:00" });
});

test("a malformed or impossible date is dropped, not passed to the calendar", () => {
  assert.deepEqual(readViewState({ date: "2026-02-30" }), {});
  assert.deepEqual(readViewState({ date: "2026-10-01T00:00:00.000Z" }), {});
  assert.deepEqual(readViewState({ date: 20261001 }), {});
  assert.deepEqual(readViewState(null), {});
  assert.deepEqual(readViewState("workWeek"), {});
});

test("the day is taken in local time, so midnight does not slip to yesterday", () => {
  assert.equal(toIsoDay(new Date(2026, 9, 12, 0, 0)), "2026-10-12");
  assert.equal(toIsoDay(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
  assert.ok(isIsoDay(toIsoDay(new Date(2024, 1, 29))));
});
