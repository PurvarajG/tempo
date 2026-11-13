import assert from "node:assert/strict";
import test from "node:test";
import { projectSummary, shiftDays, todaySummary } from "../lib/summary";
import type { ProjectStage, Task, TimeEntry } from "../lib/types";

const PROJECT = "p1";
const TODAY = "2026-03-10";

const stages: ProjectStage[] = (["backlog", "active", "blocked", "done"] as const).map(
  (kind, i) => ({
    id: `s${i}`,
    projectId: PROJECT,
    name: kind,
    kind,
    sortOrder: i,
    createdAt: "2026-03-01T00:00:00.000Z",
  }),
);

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

function entry(taskId: string, startedAt: string, minutes: number): TimeEntry {
  return {
    id: Math.random().toString(36).slice(2),
    taskId,
    categoryId: "00000000-0000-0000-0000-000000000002",
    startedAt,
    endedAt: startedAt,
    minutes,
    createdAt: startedAt,
    updatedAt: startedAt,
  };
}

test("an empty project reports zero rather than dividing by zero", () => {
  const s = projectSummary(PROJECT, [], stages, [], TODAY);
  assert.equal(s.percentComplete, 0);
  assert.equal(s.total, 0);
  assert.deepEqual(s.byStage.map((b) => b.count), [0, 0, 0, 0]);
});

test("percent complete counts completed over all non-trashed project tasks", () => {
  const tasks = [
    task({ status: "done", stageId: "s3" }),
    task({ status: "done", stageId: "s3" }),
    task({ status: "open", stageId: "s0" }),
    task({ status: "trashed", stageId: "s0" }),
  ];
  const s = projectSummary(PROJECT, tasks, stages, [], TODAY);

  assert.equal(s.total, 3, "trashed tasks are deleted, not work");
  assert.equal(s.completed, 2);
  assert.equal(s.open, 1);
  assert.equal(s.percentComplete, 67);
});

test("blocked comes from stage semantics, and survives a rename", () => {
  const renamed = stages.map((s) => (s.kind === "blocked" ? { ...s, name: "Waiting on legal" } : s));
  const tasks = [task({ stageId: "s2" }), task({ stageId: "s2" }), task({ stageId: "s1" })];

  const s = projectSummary(PROJECT, tasks, renamed, [], TODAY);
  assert.equal(s.blocked, 2);
});

test("a completed task is never overdue, however long it sat", () => {
  const tasks = [
    task({ scheduled: "2026-03-01", status: "open" }),
    task({ scheduled: "2026-03-01", status: "done", stageId: "s3" }),
    task({ scheduled: TODAY, status: "open" }),
  ];
  assert.equal(projectSummary(PROJECT, tasks, stages, [], TODAY).overdue, 1);
});

test("estimates cover open work; recorded time covers stopped entries", () => {
  const a = task({ minutes: 60 });
  const b = task({ minutes: 30, status: "done", stageId: "s3" });
  const entries = [
    entry(a.id, `${TODAY}T09:00:00.000Z`, 25),
    entry(a.id, "2026-03-08T09:00:00.000Z", 40),
    entry(b.id, "2026-02-01T09:00:00.000Z", 15),
    // A running entry has no end time and no minutes, so it can't be totalled.
    { ...entry(a.id, `${TODAY}T11:00:00.000Z`, 0), endedAt: undefined, minutes: undefined },
  ];

  const s = projectSummary(PROJECT, [a, b], stages, entries, TODAY);
  assert.equal(s.estimatedMinutes, 60, "only open tasks are still to be spent");
  assert.equal(s.recordedMinutes, 80);
  assert.equal(s.recordedTodayMinutes, 25);
  assert.equal(s.recordedWeekMinutes, 65, "the trailing week excludes February");
});

test("tasks from other projects never leak in", () => {
  const mine = task({});
  const theirs = task({ projectId: "other" });
  assert.equal(projectSummary(PROJECT, [mine, theirs], stages, [], TODAY).total, 1);
});

test("today's summary separates due, overdue, and blocked", () => {
  const tasks = [
    task({ scheduled: TODAY }),
    task({ scheduled: "2026-03-09" }),
    task({ scheduled: TODAY, stageId: "s2" }),
    task({ scheduled: TODAY, status: "done", stageId: "s3" }),
  ];
  const s = todaySummary(tasks, stages, [], TODAY);

  assert.equal(s.dueToday.length, 2);
  assert.equal(s.overdue.length, 1);
  assert.equal(s.blocked.length, 1);
  assert.equal(s.plannedMinutes, 60);
});

test("a complex task is due on every day of its range", () => {
  const tasks = [
    task({ isComplex: true, scheduled: "2026-03-08", finishDate: "2026-03-12" }),
  ];
  const s = todaySummary(tasks, stages, [], TODAY);
  assert.equal(s.dueToday.length, 1, "today falls inside the range");
  assert.equal(s.overdue.length, 0);
});

test("a complex task is overdue only once its finish date passes, not its start day", () => {
  const tasks = [
    task({ isComplex: true, scheduled: "2026-03-01", finishDate: "2026-03-09" }),
  ];
  const s = todaySummary(tasks, stages, [], TODAY);
  assert.equal(s.dueToday.length, 0, "finished yesterday, not due today");
  assert.equal(s.overdue.length, 1);
});

test("a complex task starting tomorrow is neither due nor overdue today", () => {
  const tasks = [
    task({ isComplex: true, scheduled: "2026-03-11", finishDate: "2026-03-15" }),
  ];
  const s = todaySummary(tasks, stages, [], TODAY);
  assert.equal(s.dueToday.length, 0);
  assert.equal(s.overdue.length, 0);
});

test("day shifting crosses month and year boundaries", () => {
  assert.equal(shiftDays("2026-03-01", -1), "2026-02-28");
  assert.equal(shiftDays("2026-01-01", -1), "2025-12-31");
  assert.equal(shiftDays("2026-02-28", 1), "2026-03-01");
  assert.equal(shiftDays("2024-02-28", 1), "2024-02-29", "leap year");
});

test("undated open task is excluded from overdue, today and project date figures", () => {
  const dated = task({ id: "d", scheduled: "2026-03-09", minutes: 20 });
  const todayTask = task({ id: "t", scheduled: TODAY, minutes: 40 });
  const inbox = task({ id: "u", scheduled: null, minutes: 50 });
  const inboxComplex = task({ id: "uc", scheduled: null, isComplex: true, finishDate: "2026-03-01" });

  const base = todaySummary([dated, todayTask], stages, [], TODAY);
  const withInbox = todaySummary([dated, todayTask, inbox, inboxComplex], stages, [], TODAY);
  assert.deepEqual(withInbox.overdue.map((t) => t.id), ["d"]);
  assert.deepEqual(withInbox.dueToday.map((t) => t.id), ["t"]);
  assert.equal(withInbox.plannedMinutes, base.plannedMinutes);
  assert.equal(withInbox.plannedMinutes, 40);

  const ps = projectSummary(PROJECT, [dated, todayTask, inbox, inboxComplex], stages, [], TODAY);
  assert.equal(ps.overdue, 1);
  // Still an open task where a plain open count is reported.
  assert.equal(ps.open, 4);
  assert.equal(ps.total, 4);
});
