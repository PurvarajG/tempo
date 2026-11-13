import assert from "node:assert/strict";
import test from "node:test";
import { getAttentionItems, getFocusTask, isStale, taskAge } from "../lib/focus";
import type { ProjectStage, Task } from "../lib/types";

const PROJECT = "p1";
const TODAY = "2026-03-10";

const stages: ProjectStage[] = [
  { id: "s-backlog", projectId: PROJECT, name: "Backlog", kind: "backlog", sortOrder: 0, createdAt: "2026-03-01T00:00:00.000Z" },
  { id: "s-active", projectId: PROJECT, name: "In Progress", kind: "active", sortOrder: 1, createdAt: "2026-03-01T00:00:00.000Z" },
  { id: "s-waiting", projectId: PROJECT, name: "Waiting", kind: "blocked", sortOrder: 2, createdAt: "2026-03-01T00:00:00.000Z" },
  { id: "s-done", projectId: PROJECT, name: "Done", kind: "done", sortOrder: 3, createdAt: "2026-03-01T00:00:00.000Z" },
];

function task(overrides: Partial<Task>): Task {
  return {
    id: Math.random().toString(36).slice(2),
    title: "t",
    projectId: PROJECT,
    tags: [],
    scheduled: TODAY,
    minutes: 30,
    priority: 0,
    status: "open",
    isComplex: false,
    sortOrder: 0,
    boardOrder: 0,
    createdAt: "2026-03-01T00:00:00.000Z",
    subtasks: [],
    ...overrides,
  };
}

test("taskAge/isStale mirror the TaskRow banner threshold", () => {
  const fresh = task({ scheduled: "2026-03-09" });
  const stale = task({ scheduled: "2026-03-01" }); // 9 days old
  assert.equal(taskAge(fresh, TODAY), 1);
  assert.equal(isStale(fresh, TODAY), false);
  assert.equal(isStale(stale, TODAY), true);
  assert.equal(isStale({ ...stale, status: "done" }, TODAY), false);
});

test("getFocusTask prefers the running task when it belongs to the project", () => {
  const other = task({ id: "other", priority: 3, scheduled: TODAY });
  const running = task({ id: "running", priority: 0, scheduled: "2026-03-20" }); // not due, still wins
  const tasks = [other, running];
  const result = getFocusTask(tasks, PROJECT, { taskId: running.id }, TODAY);
  assert.equal(result?.id, running.id);
});

test("getFocusTask ignores a running task from a different project", () => {
  const inProject = task({ priority: 2, scheduled: TODAY });
  const elsewhere = task({ projectId: "other", scheduled: TODAY });
  const tasks = [inProject, elsewhere];
  const result = getFocusTask(tasks, PROJECT, { taskId: elsewhere.id }, TODAY);
  assert.equal(result?.id, inProject.id);
});

test("getFocusTask falls back to highest-priority due-today/overdue open task", () => {
  // Priority 1 (P1) outranks priority 3 (P3); priority 0 (none) ranks last.
  const p1 = task({ priority: 1, scheduled: TODAY });
  const p3 = task({ priority: 3, scheduled: TODAY });
  const overdueNoPriority = task({ priority: 0, scheduled: "2026-03-01" });
  const notDue = task({ priority: 1, scheduled: "2026-03-20" });
  const tasks = [p3, overdueNoPriority, notDue, p1];
  const result = getFocusTask(tasks, PROJECT, null, TODAY);
  assert.equal(result?.id, p1.id);
});

test("getFocusTask returns null when nothing is due, overdue, or running", () => {
  const notDue = task({ scheduled: "2026-03-20" });
  assert.equal(getFocusTask([notDue], PROJECT, null, TODAY), null);
});

test("getAttentionItems lists overdue tasks", () => {
  const overdue = task({ scheduled: "2026-03-04" }); // 6 days overdue
  const notOverdue = task({ scheduled: TODAY });
  const items = getAttentionItems([overdue, notOverdue], stages, PROJECT, TODAY);
  assert.equal(items.length, 1);
  assert.equal(items[0].task.id, overdue.id);
  assert.equal(items[0].reason, "overdue");
  assert.match(items[0].detail, /Overdue by 6 days/);
});

test("getAttentionItems labels a stale waiting-kind task as stalled-waiting, not overdue", () => {
  // A task in a waiting-kind stage is also technically "overdue" by the
  // scheduled-date rule once it's this stale, but the waiting-stage framing
  // ("no follow-up date") is the more useful label, and each task appears once.
  const stalledWaiting = task({ stageId: "s-waiting", scheduled: "2026-03-01" }); // 9 days
  const items = getAttentionItems([stalledWaiting], stages, PROJECT, TODAY);
  assert.equal(items.length, 1);
  assert.equal(items[0].task.id, stalledWaiting.id);
  assert.equal(items[0].reason, "stalled-waiting");
});

test("getAttentionItems does not flag a fresh task sitting in a waiting-kind stage", () => {
  const freshWaiting = task({ stageId: "s-waiting", scheduled: TODAY });
  const items = getAttentionItems([freshWaiting], stages, PROJECT, TODAY);
  assert.equal(items.length, 0);
});

test("getAttentionItems judges a waiting-kind task by staleness, not the date-overdue rule", () => {
  // Scheduled long enough ago that it would also be "overdue" by date, but a
  // waiting-kind stage's tasks are judged on staleness alone, so this
  // appears once, labelled stalled-waiting.
  const both = task({ stageId: "s-waiting", scheduled: "2026-03-01" });
  const items = getAttentionItems([both], stages, PROJECT, TODAY);
  assert.equal(items.length, 1);
  assert.equal(items[0].reason, "stalled-waiting");
});

test("getAttentionItems ignores trashed and done tasks", () => {
  const trashed = task({ scheduled: "2026-03-01", status: "trashed" });
  const done = task({ scheduled: "2026-03-01", status: "done" });
  const items = getAttentionItems([trashed, done], stages, PROJECT, TODAY);
  assert.equal(items.length, 0);
});

test("getFocusTask never picks an undated task unless it is committed today", () => {
  const undated = task({ id: "undated", scheduled: null, priority: 1 });
  assert.equal(getFocusTask([undated], PROJECT, null, TODAY), null);
  const committed = { ...undated, committedOn: TODAY };
  assert.equal(getFocusTask([committed], PROJECT, null, TODAY)?.id, "undated");
});

test("taskAge is 0 and isStale false for undated tasks", () => {
  const undated = task({ scheduled: null });
  assert.equal(taskAge(undated, TODAY), 0);
  assert.equal(isStale(undated, TODAY), false);
  assert.equal(getAttentionItems([undated], stages, PROJECT, TODAY).length, 0);
});

test("getFocusTask skips a blocked task", () => {
  const blocker = task({ id: "blocker", scheduled: "2026-03-20" });
  const blocked = task({ id: "blocked", priority: 1, blockedBy: ["blocker"] });
  const free = task({ id: "free", priority: 3 });
  assert.equal(getFocusTask([blocker, blocked, free], PROJECT, null, TODAY)?.id, "free");
});

test("getFocusTask skips a hidden-until task", () => {
  const hidden = task({ id: "hidden", priority: 1, startOn: "2026-03-15" });
  const visible = task({ id: "visible", priority: 3 });
  assert.equal(getFocusTask([hidden, visible], PROJECT, null, TODAY)?.id, "visible");
});

test("getFocusTask lets a committed task outrank an older carried-over one", () => {
  const carried = task({ id: "carried", priority: 0, scheduled: "2026-03-01" });
  const committed = task({ id: "committed", priority: 3, scheduled: TODAY, committedOn: TODAY });
  assert.equal(getFocusTask([carried, committed], PROJECT, null, TODAY)?.id, "committed");
});
