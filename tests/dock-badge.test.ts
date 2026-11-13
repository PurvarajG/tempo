import assert from "node:assert/strict";
import test from "node:test";
import { dockBadgeCount } from "../lib/dock-badge";
import { addDays, toISODate } from "../lib/parse";
import type { Task } from "../lib/types";

const TODAY = toISODate(new Date());
const YESTERDAY = addDays(TODAY, -1);
const TOMORROW = addDays(TODAY, 1);

let seq = 0;
function mk(over: Partial<Task> = {}): Task {
  seq += 1;
  return {
    id: `t${seq}`,
    title: `Task ${seq}`,
    boardOrder: 0,
    tags: [],
    scheduled: TODAY,
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

test("counts today's open tasks", () => {
  assert.equal(dockBadgeCount([mk(), mk()], TODAY, "today"), 2);
});

test("done and trashed are not counted", () => {
  assert.equal(dockBadgeCount([mk({ status: "done" }), mk({ status: "trashed" })], TODAY, "today"), 0);
});

test("overdue without dueTime is not counted, with dueTime is", () => {
  assert.equal(dockBadgeCount([mk({ scheduled: YESTERDAY })], TODAY, "today"), 0);
  assert.equal(dockBadgeCount([mk({ scheduled: YESTERDAY, dueTime: "09:00" })], TODAY, "today"), 1);
});

test("undated and future tasks are not counted", () => {
  assert.equal(dockBadgeCount([mk({ scheduled: null, dueTime: "09:00" }), mk({ scheduled: TOMORROW })], TODAY, "today"), 0);
});

test("hidden-until tasks are not counted", () => {
  assert.equal(dockBadgeCount([mk({ startOn: TOMORROW })], TODAY, "today"), 0);
});

test("mode none returns 0; undefined uses the default", () => {
  const tasks = [mk()];
  assert.equal(dockBadgeCount(tasks, TODAY, "none"), 0);
  assert.equal(dockBadgeCount(tasks, TODAY, undefined), 1);
});
