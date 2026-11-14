import assert from "node:assert/strict";
import test from "node:test";
import { remindersDue } from "../lib/reminders";
import type { Task } from "../lib/types";

const TODAY = "2026-11-12";

let seq = 0;
function mk(over: Partial<Task> = {}): Task {
  seq += 1;
  return {
    id: `t${String(seq).padStart(3, "0")}`,
    title: `Task ${seq}`,
    boardOrder: 0,
    tags: [],
    scheduled: TODAY,
    dueTime: "09:00",
    minutes: 30,
    priority: 0,
    status: "open",
    isComplex: false,
    sortOrder: seq,
    createdAt: "2026-11-01T00:00:00.000Z",
    subtasks: [],
    ...over,
  } as Task;
}

test("keeps an open timed task scheduled today", () => {
  const t = mk();
  assert.deepEqual(remindersDue([t], TODAY), [t]);
});

test("drops done tasks", () => {
  assert.deepEqual(remindersDue([mk({ status: "done" })], TODAY), []);
});

test("drops tasks with no dueTime", () => {
  assert.deepEqual(remindersDue([mk({ dueTime: undefined }), mk({ dueTime: "" })], TODAY), []);
});

test("drops tasks scheduled another day or null", () => {
  assert.deepEqual(remindersDue([mk({ scheduled: "2026-11-13" }), mk({ scheduled: null })], TODAY), []);
});

test("drops hidden-until tasks, keeps ones whose start has arrived", () => {
  const hidden = mk({ startOn: "2026-11-13" });
  const ok = mk({ startOn: TODAY });
  assert.deepEqual(remindersDue([hidden, ok], TODAY), [ok]);
});

test("sorts by dueTime, then id", () => {
  const late = mk({ dueTime: "14:00" });
  const b = mk({ id: "b", dueTime: "09:00" });
  const a = mk({ id: "a", dueTime: "09:00" });
  const early = mk({ dueTime: "08:30" });
  assert.deepEqual(remindersDue([late, b, a, early], TODAY), [early, a, b, late]);
});

test("does not mutate the input", () => {
  const input = [mk({ dueTime: "10:00" }), mk({ dueTime: "08:00" })];
  const copy = [...input];
  remindersDue(input, TODAY);
  assert.deepEqual(input, copy);
});
