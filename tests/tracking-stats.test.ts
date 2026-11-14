import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { minutesByProject } from "../lib/tracking-stats";
import {
  accuracyByDay,
  minutesByDay,
  planAccuracy,
  plannedMinutesForProject,
  rangeDays,
  sessionStats,
  sessionsByDay,
  sparkSeries,
  weekTotals,
  weekdayAverage,
} from "../lib/tracking-stats";
import type { Project, Segment, Task } from "../lib/types";

const now = new Date("2026-01-01T12:00:00.000Z");

const projects: Project[] = [
  { id: "proj-1", name: "Atlas Launch", color: "#0052ff", archived: false, sortOrder: 0, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "proj-2", name: "Homebase", color: "#ff0000", archived: false, sortOrder: 1, createdAt: "2026-01-01T00:00:00.000Z" },
];

const tasks: Task[] = [
  {
    id: "task-1",
    title: "Atlas task",
    projectId: "proj-1",
    boardOrder: 0,
    tags: [],
    scheduled: "2026-01-01",
    minutes: 30,
    priority: 0,
    status: "open",
    isComplex: false,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    subtasks: [],
  },
  {
    id: "task-2",
    title: "Projectless task",
    boardOrder: 0,
    tags: [],
    scheduled: "2026-01-01",
    minutes: 30,
    priority: 0,
    status: "open",
    isComplex: false,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    subtasks: [],
  },
];

function segment(patch: Partial<Segment>): Segment {
  return {
    id: crypto.randomUUID(),
    startedAt: "2026-01-01T09:00:00.000Z",
    endedAt: "2026-01-01T10:00:00.000Z",
    categoryId: "cat-1",
    source: "manual",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...patch,
  };
}

test("minutesByProject groups task-linked segments through the task's project", () => {
  const rows = minutesByProject(
    [
      segment({ taskId: "task-1" }),
      segment({ taskId: "task-2" }),
      segment({ activityId: "act-1", taskId: undefined }),
    ],
    tasks,
    projects,
    now,
  );

  const atlas = rows.find((r) => r.project?.id === "proj-1");
  const noProject = rows.find((r) => r.project === null);
  assert.equal(atlas?.minutes, 60);
  assert.equal(noProject?.minutes, 60, "a task with no project lands in the No project bucket");
  assert.equal(rows.some((r) => r.project?.id === "proj-2"), false, "an untracked project contributes nothing");
  assert.equal(
    rows.reduce((sum, r) => sum + r.minutes, 0),
    120,
    "the activity-only segment is excluded entirely",
  );
});

test("minutesByProject counts a running task segment up to now", () => {
  const rows = minutesByProject(
    [segment({ taskId: "task-1", startedAt: "2026-01-01T11:30:00.000Z", endedAt: undefined })],
    tasks,
    projects,
    now,
  );
  assert.equal(rows[0].minutes, 30);
});

// ---- Phase 9 additions. Local-time dates so tests do not depend on the machine zone. ----
const L = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).toISOString();
// Wed 2026-11-11 noon local.
const nowP9 = new Date(2026, 10, 11, 12, 0);

function seg(startedAt: string, endedAt: string | undefined, taskId?: string): Segment {
  return {
    id: `s-${startedAt}`,
    startedAt,
    endedAt,
    categoryId: "c",
    taskId,
    source: "manual",
    createdAt: startedAt,
    updatedAt: startedAt,
  } as Segment;
}

function tk(id: string, minutes: number, over: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    boardOrder: 0,
    tags: [],
    scheduled: "2026-11-11",
    minutes,
    priority: 0,
    status: "open",
    isComplex: false,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    subtasks: [],
    ...over,
  } as Task;
}

test("rangeDays is oldest first and ends at endISO", () => {
  assert.deepEqual(rangeDays("2026-03-02", 3), ["2026-02-28", "2026-03-01", "2026-03-02"]);
});

test("minutesByDay splits a segment at local midnight", () => {
  const out = minutesByDay([seg(L(2026, 11, 10, 23, 30), L(2026, 11, 11, 0, 45))], "2026-11-11", 2, nowP9);
  assert.deepEqual(out, [30, 45]);
});

test("minutesByDay counts a running segment up to now", () => {
  const out = minutesByDay([seg(L(2026, 11, 11, 11, 0), undefined)], "2026-11-11", 1, nowP9);
  assert.deepEqual(out, [60]);
});

test("sessionsByDay counts segments by start day", () => {
  const out = sessionsByDay(
    [seg(L(2026, 11, 10, 23, 30), L(2026, 11, 11, 1, 0)), seg(L(2026, 11, 11, 9, 0), L(2026, 11, 11, 10, 0))],
    "2026-11-11",
    3,
  );
  assert.deepEqual(out, [0, 1, 1]);
});

test("weekTotals spans the Monday boundary", () => {
  const segs = [
    seg(L(2026, 11, 8, 10, 0), L(2026, 11, 8, 11, 0)), // Sun, last week: 60
    seg(L(2026, 11, 2, 10, 0), L(2026, 11, 2, 12, 0)), // Mon last week: 120
    seg(L(2026, 11, 9, 9, 0), L(2026, 11, 9, 9, 30)), // Mon this week: 30
    seg(L(2026, 11, 11, 11, 0), undefined), // running Wed: 60
  ];
  assert.deepEqual(weekTotals(segs, "2026-11-11", nowP9), { thisWeek: 90, lastWeek: 180 });
});

test("weekdayAverage skips weekends and zero days", () => {
  // Series ends Sun 2026-11-15, 7 days: Mon..Sun
  const r = weekdayAverage([60, 0, 120, 30, 0, 500, 500], "2026-11-15");
  assert.deepEqual(r, { average: 70, weekdays: 3 });
  assert.deepEqual(weekdayAverage([0, 0, 90], "2026-11-15"), { average: 0, weekdays: 0 });
});

test("planAccuracy handles over and under estimates", () => {
  const tasks = [tk("a", 60), tk("b", 30), tk("c", 45)];
  const segs = [
    seg(L(2026, 11, 11, 8, 0), L(2026, 11, 11, 8, 30), "a"), // 30 of 60 -> 0.5
    seg(L(2026, 11, 11, 9, 0), L(2026, 11, 11, 10, 0), "b"), // 60 of 30 -> 0.5, over 30
  ];
  assert.deepEqual(planAccuracy(tasks, segs, nowP9), { percent: 50, overByAvg: 30 });
});

test("planAccuracy is null with no qualifying task", () => {
  assert.deepEqual(planAccuracy([tk("a", 0)], [seg(L(2026, 11, 11, 8, 0), L(2026, 11, 11, 9, 0), "a")], nowP9), {
    percent: null,
    overByAvg: 0,
  });
  assert.equal(planAccuracy([tk("a", 30)], [], nowP9).percent, null);
});

test("accuracyByDay is 0 on a day without a qualifying task", () => {
  const out = accuracyByDay([tk("a", 60)], [seg(L(2026, 11, 11, 8, 0), L(2026, 11, 11, 9, 0), "a")], "2026-11-11", 2, nowP9);
  assert.deepEqual(out, [0, 100]);
});

test("sessionStats reports count and longest", () => {
  const out = sessionStats(
    [seg(L(2026, 11, 11, 8, 0), L(2026, 11, 11, 8, 20)), seg(L(2026, 11, 11, 9, 0), L(2026, 11, 11, 10, 0))],
    nowP9,
  );
  assert.deepEqual(out, { count: 2, longest: 60 });
});

test("plannedMinutesForProject filters by project, range and trash; null means no project", () => {
  const tasks = [
    tk("a", 30, { projectId: "p1" }),
    tk("b", 20),
    tk("c", 40, { projectId: "p1", scheduled: "2026-11-20" }),
    tk("d", 10, { status: "trashed" }),
    tk("e", 15, { scheduled: null }),
  ];
  assert.equal(plannedMinutesForProject(tasks, "p1", "2026-11-09", "2026-11-15"), 30);
  assert.equal(plannedMinutesForProject(tasks, null, "2026-11-09", "2026-11-15"), 20);
});

test("sparkSeries averages consecutive buckets", () => {
  assert.deepEqual(sparkSeries([1, 2, 3]), [1, 2, 3]);
  assert.deepEqual(sparkSeries([2, 4, 6, 8, 10], 2), [4, 9]);
  assert.ok(sparkSeries(Array.from({ length: 28 }, (_, i) => i)).length <= 12);
});
