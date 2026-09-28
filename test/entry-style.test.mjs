import assert from "node:assert/strict";
import { test } from "node:test";
import { entryAccent, entryClassNames, isOverdue } from "../src/entry-style.ts";

test("the accent comes from the note type's entity token", () => {
  assert.equal(entryAccent("Company"), "var(--entity-company-color, var(--text-faint))");
  assert.equal(entryAccent(" Person "), "var(--entity-person-color, var(--text-faint))");
});

test("an explicit colour wins over the note type", () => {
  assert.equal(entryAccent("Company", "#D50000"), "#D50000");
});

test("a missing or unsafe type gives no accent", () => {
  assert.equal(entryAccent(""), null);
  assert.equal(entryAccent("Company); color: red"), null);
  assert.equal(entryAccent("[[Firma]]"), null);
});

const day = (y, m, d, h = 0) => new Date(y, m - 1, d, h);

test("a date becomes overdue the day after, not on the day", () => {
  const today = day(2026, 9, 28, 9);
  assert.equal(isOverdue(day(2026, 9, 27), undefined, today), true);
  assert.equal(isOverdue(day(2026, 9, 28), undefined, today), false);
  assert.equal(isOverdue(day(2026, 9, 28, 23), undefined, today), false);
  assert.equal(isOverdue(day(2026, 9, 29), undefined, today), false);
});

test("a range is overdue only after its last visible day", () => {
  const today = day(2026, 9, 28);
  assert.equal(isOverdue(day(2026, 9, 26), day(2026, 9, 28), today), false);
  assert.equal(isOverdue(day(2026, 9, 25), day(2026, 9, 27), today), true);
});

test("day order holds across month and year boundaries", () => {
  assert.equal(isOverdue(day(2026, 12, 31), undefined, day(2027, 1, 1)), true);
  assert.equal(isOverdue(day(2026, 1, 31), undefined, day(2026, 2, 1)), true);
  assert.equal(isOverdue(day(2027, 1, 1), undefined, day(2026, 12, 31)), false);
});

test("class names follow accent and state separately", () => {
  assert.deepEqual(entryClassNames(null, false), []);
  assert.deepEqual(entryClassNames("var(--x)", false), ["bases-calendar-accented"]);
  assert.deepEqual(entryClassNames(null, true), ["is-overdue"]);
  assert.deepEqual(entryClassNames("var(--x)", true), ["bases-calendar-accented", "is-overdue"]);
});
