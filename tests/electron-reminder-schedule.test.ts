import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const {
  createReminderSchedule,
  reminderKey,
  REPEAT_AFTER_MINUTES,
  SNOOZE_MINUTES,
  CATCH_UP_MINUTES,
} = require("../electron/reminder-schedule.js");

const base = { taskId: "t1", title: "Write report", scheduled: "2026-11-13", dueTime: "14:30", leadMinutes: 10 };
const at = (h: number, m: number) => new Date(2026, 10, 13, h, m);

function make(overrides = {}) {
  const s = createReminderSchedule();
  s.setReminders([{ ...base, ...overrides }]);
  return s;
}

test("constants", () => {
  assert.equal(REPEAT_AFTER_MINUTES, 10);
  assert.equal(SNOOZE_MINUTES, 15);
  assert.equal(CATCH_UP_MINUTES, 5);
});

test("key format", () => {
  assert.equal(reminderKey(base), "t1@2026-11-13 14:30");
});

test("lead and due fire once at the right minute", () => {
  const s = make();
  assert.deepEqual(s.due(at(14, 19)), []);
  const lead = s.due(at(14, 20));
  assert.deepEqual(lead, [{ taskId: "t1", title: "Write report", kind: "lead", body: "Due at 14:30, in 10m." }]);
  assert.deepEqual(s.due(at(14, 21)), []);
  const due = s.due(at(14, 30));
  assert.deepEqual(due.map((d: { kind: string }) => d.kind), ["due"]);
  assert.equal(due[0].body, "Due now.");
  assert.deepEqual(s.due(at(14, 31)), []);
});

test("leadMinutes 0 skips lead", () => {
  const s = make({ leadMinutes: 0 });
  assert.deepEqual(s.due(at(14, 20)), []);
  assert.deepEqual(s.due(at(14, 30)).map((d: { kind: string }) => d.kind), ["due"]);
});

test("repeat fires once 10m after due", () => {
  const s = make();
  s.due(at(14, 20));
  s.due(at(14, 30));
  assert.deepEqual(s.due(at(14, 39)), []);
  const rep = s.due(at(14, 40));
  assert.deepEqual(rep.map((d: { kind: string }) => d.kind), ["repeat"]);
  assert.equal(rep[0].body, "Due at 14:30.");
  assert.deepEqual(s.due(at(14, 41)), []);
  assert.deepEqual(s.due(at(14, 50)), []);
});

test("handled cancels repeat", () => {
  const s = make();
  s.due(at(14, 30));
  s.handled("t1");
  assert.deepEqual(s.due(at(14, 40)), []);
});

test("snooze fires once 15m later and cancels repeat", () => {
  const s = make();
  s.due(at(14, 30));
  s.snooze("t1", at(14, 31));
  assert.deepEqual(s.due(at(14, 40)), []);
  assert.deepEqual(s.due(at(14, 45)), []);
  const snz = s.due(at(14, 46));
  assert.deepEqual(snz.map((d: { kind: string }) => d.kind), ["snooze"]);
  assert.equal(snz[0].body, "Due at 14:30.");
  assert.deepEqual(s.due(at(14, 47)), []);
  assert.deepEqual(s.due(at(15, 5)), []);
});

test("moving dueTime fires again", () => {
  const s = make();
  s.due(at(14, 30));
  s.setReminders([{ ...base, dueTime: "16:00" }]);
  assert.deepEqual(s.due(at(16, 0)).map((d: { kind: string }) => d.kind), ["due"]);
});

test("same key survives setReminders", () => {
  const s = make();
  s.due(at(14, 30));
  s.setReminders([{ ...base }]);
  assert.deepEqual(s.due(at(14, 31)), []);
});

test("stale events are dropped, not replayed", () => {
  const s = make();
  const out = s.due(at(14, 40));
  assert.deepEqual(out.map((d: { kind: string }) => d.kind), ["repeat"]);
  const late = make();
  assert.deepEqual(late.due(at(15, 30)), []);
  assert.deepEqual(late.due(at(15, 31)), []);
});
