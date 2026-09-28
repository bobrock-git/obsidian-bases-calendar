import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesDateSource, parseDateSources, sourceEventId } from "../src/date-sources.ts";

const source = {
  id: "event", label: "Wydarzenie", types: ["Event"], startDate: "note.event_date",
};

const row = (fields) => ({
  getValue: (property) => fields[property] == null ? null : {
    toString: () => String(fields[property]),
  },
});

test("one note can produce distinct event identities for different dates", () => {
  assert.notEqual(sourceEventId("wydarzenia/gala.md", "event"),
    sourceEventId("wydarzenia/gala.md", "followup"));
});

test("source rules distinguish type and status", () => {
  const [event] = parseDateSources([source]);
  assert.equal(matchesDateSource(row({ "note.type": "Event" }), event), true);
  assert.equal(matchesDateSource(row({ "note.type": "Meeting" }), event), false);
  const [deal] = parseDateSources([{
    ...source, id: "deal", types: ["Deal"], statusProperty: "note.sales_status",
    statusEquals: "otwarty",
  }]);
  assert.equal(matchesDateSource(row({ "note.type": "Deal", "note.sales_status": "otwarty" }), deal), true);
  assert.equal(matchesDateSource(row({ "note.type": "Deal", "note.sales_status": "stracony" }), deal), false);
});

test("invalid and duplicate source roles fail loudly", () => {
  assert.throws(() => parseDateSources([source, source]), /duplicate id/);
  assert.throws(() => parseDateSources([{ ...source, startDate: "formula.date" }]), /invalid properties/);
  assert.throws(() => parseDateSources("not json"), /JSON array/);
});

test("a role carries its icon and overdue marking", () => {
  const [plain] = parseDateSources([source]);
  assert.equal(plain.icon, undefined);
  assert.equal(plain.markOverdue, false);
  const [followup] = parseDateSources([{ ...source, icon: "lucide-bell-ring", markOverdue: true }]);
  assert.equal(followup.icon, "bell-ring");
  assert.equal(followup.markOverdue, true);
});

test("a malformed icon or overdue flag fails loudly", () => {
  assert.throws(() => parseDateSources([{ ...source, icon: "Bell Ring" }]), /invalid properties/);
  assert.throws(() => parseDateSources([{ ...source, icon: "" }]), /invalid properties/);
  assert.throws(() => parseDateSources([{ ...source, markOverdue: "yes" }]), /invalid properties/);
});
