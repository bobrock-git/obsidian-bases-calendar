import assert from "node:assert/strict";
import { test } from "node:test";
import { inclusiveAllDayEnd } from "../src/all-day-end.ts";

const day = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

test("a three-day resize stores the last visible day", () => {
  assert.equal(day(inclusiveAllDayEnd(new Date(2026, 8, 28), new Date(2026, 9, 1))), "2026-09-30");
});

test("shrinking a range to one day stores the start date", () => {
  assert.equal(day(inclusiveAllDayEnd(new Date(2026, 8, 28), new Date(2026, 8, 29))), "2026-09-28");
});

test("invalid or reversed ends are rejected", () => {
  assert.equal(inclusiveAllDayEnd(new Date(2026, 8, 28), new Date(2026, 8, 28)), null);
  assert.equal(inclusiveAllDayEnd(new Date(2026, 8, 28), new Date(NaN)), null);
});
