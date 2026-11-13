import assert from "node:assert/strict";
import test from "node:test";
import { buildWeekPlan, capacityCeilingMinutes, carriedTasks, planItFor, weekHeadline, weekMetrics, weekRows, type WeekRow } from "../lib/week-capacity";
import { capacity } from "../lib/today";
import { addDays, toISODate } from "../lib/parse";
import { fmtWeekday } from "../lib/format";
import type { Task, TrackingSettings } from "../lib/types";

const SETTINGS: TrackingSettings = {
  dayStartHour: 4,
  wakingStartHour: 7,
  wakingEndHour: 23,
  minGapMinutes: 10,
  moduleOrder: [],
  hiddenModules: [],
  collapsedModules: [],
  hiddenNavItems: [],
  updatedAt: new Date().toISOString(),
};

function task(overrides: Partial<Task>): Task {
  return {
    id: overrides.id ?? Math.random().toString(36),
    title: "task",
    tags: [],
    scheduled: "2026-08-26",
    minutes: 30,
    priority: 0,
    status: "open",
    isComplex: false,
    boardOrder: 0,
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    subtasks: [],
    ...overrides,
  };
}

test("capacityCeilingMinutes derives from waking-hours settings, not a made-up number", () => {
  // 7 -> 23 is a 16h waking window, matching lib/tracking-day.ts's wakingWindow.
  assert.equal(capacityCeilingMinutes(SETTINGS, [999]), 16 * 60);
});

test("capacityCeilingMinutes falls back to the busiest day's own minutes when settings haven't loaded", () => {
  assert.equal(capacityCeilingMinutes(null, [30, 480, 120]), 480);
});

test("capacityCeilingMinutes never returns zero even with no settings and no planned minutes", () => {
  assert.equal(capacityCeilingMinutes(null, [0, 0, 0]), 1);
});

test("buildWeekPlan groups open tasks into today..today+6 and derives a capacity ratio per day", () => {
  const today = "2026-08-26";
  const tasks: Task[] = [
    task({ scheduled: today, minutes: 120, status: "open" }),
    task({ scheduled: today, minutes: 240, status: "open" }),
    task({ scheduled: "2026-08-27", minutes: 60, status: "open" }),
    // Outside the window — must not be counted.
    task({ scheduled: "2026-09-05", minutes: 999, status: "open" }),
    // Done tasks don't occupy capacity.
    task({ scheduled: today, minutes: 500, status: "done" }),
  ];

  const week = buildWeekPlan(tasks, today, SETTINGS);
  assert.equal(week.length, 7);
  assert.equal(week[0].date, today);
  assert.equal(week[0].plannedMinutes, 360);
  assert.equal(week[0].tasks.length, 2);
  // 360 minutes of a 16h (960min) ceiling.
  assert.equal(week[0].capacityRatio, 360 / 960);

  assert.equal(week[1].date, "2026-08-27");
  assert.equal(week[1].plannedMinutes, 60);

  for (let i = 2; i <= 6; i++) {
    assert.equal(week[i].plannedMinutes, 0);
    assert.equal(week[i].capacityRatio, 0);
  }
});

test("weekMetrics computes task count, planned time, overdue count and busiest day from real data", () => {
  const today = "2026-08-26";
  const tasks: Task[] = [
    task({ scheduled: today, minutes: 30, status: "open" }),
    task({ scheduled: "2026-08-27", minutes: 90, status: "open" }),
    task({ scheduled: "2026-08-27", minutes: 90, status: "open" }),
    // Overdue: scheduled before today, still open.
    task({ scheduled: "2026-08-20", minutes: 15, status: "open" }),
    task({ scheduled: "2026-08-21", minutes: 15, status: "open" }),
  ];

  const week = buildWeekPlan(tasks, today, SETTINGS);
  const metrics = weekMetrics(tasks, today, week);

  assert.equal(metrics.taskCount, 3);
  assert.equal(metrics.plannedMinutes, 210);
  assert.equal(metrics.overdueCount, 2);
  assert.equal(metrics.busiestDate, "2026-08-27");
});

test("weekMetrics uses the shared isOverdue predicate — a complex task isn't overdue until its finish date passes", () => {
  const today = "2026-08-26";
  const tasks: Task[] = [
    // Started yesterday, finishes Friday (well after today) — not overdue.
    task({
      scheduled: "2026-08-25",
      isComplex: true,
      finishDate: "2026-08-28",
      minutes: 60,
      status: "open",
    }),
    // Simple task scheduled before today — overdue.
    task({ scheduled: "2026-08-20", minutes: 15, status: "open" }),
  ];

  const week = buildWeekPlan(tasks, today, SETTINGS);
  const metrics = weekMetrics(tasks, today, week);

  assert.equal(metrics.overdueCount, 1);
});

test("buildWeekPlan exposes an uncapped trueCapacityRatio so over-capacity days can be detected", () => {
  const today = "2026-08-26";
  // 20h (1200min) of estimates against the 16h (960min) waking window.
  const tasks: Task[] = [task({ scheduled: today, minutes: 1200, status: "open" })];

  const week = buildWeekPlan(tasks, today, SETTINGS);

  assert.equal(week[0].plannedMinutes, 1200);
  // Capped ratio still saturates at 1 for bar width.
  assert.equal(week[0].capacityRatio, 1);
  // True ratio reveals the overcommitment.
  assert.equal(week[0].trueCapacityRatio, 1200 / 960);
  assert.ok(week[0].trueCapacityRatio > 1);
  assert.equal(week[0].ceilingIsProvisional, false);
});

test("buildWeekPlan marks the ceiling provisional when settings haven't loaded yet", () => {
  const today = "2026-08-26";
  const tasks: Task[] = [task({ scheduled: today, minutes: 60, status: "open" })];

  const week = buildWeekPlan(tasks, today, null);

  assert.equal(week[0].ceilingIsProvisional, true);
});

test("undated open task is excluded from week plan and metrics", () => {
  const today = "2026-08-26";
  const dated = task({ id: "a", scheduled: "2026-08-27", minutes: 60 });
  const late = task({ id: "l", scheduled: "2026-08-20", minutes: 10 });
  const inbox = task({ id: "u", scheduled: null, minutes: 90 });
  const tasks = [dated, late, inbox];

  const week = buildWeekPlan(tasks, today, SETTINGS);
  assert.equal(week.flatMap((d) => d.tasks).length, 1);
  assert.equal(week[1].plannedMinutes, 60);

  const m = weekMetrics(tasks, today, week);
  assert.equal(m.taskCount, 1);
  assert.equal(m.plannedMinutes, 60);
  assert.equal(m.overdueCount, 1);
  assert.equal(m.busiestDate, "2026-08-27");
});

// ---- weekRows, carriedTasks, weekHeadline, planItFor ----
const NOW = new Date(2026, 5, 10, 9, 0, 0); // 09:00 local; waking end 23:00 leaves 840m today
const T0 = toISODate(NOW);
const d = (n: number) => addDays(T0, n);

function row(over: Partial<WeekRow>): WeekRow {
  return {
    date: d(1), isToday: false, tasks: [], plannedMinutes: 0, ceilingMinutes: 960, freeMinutes: 960,
    overByMinutes: 0, over: false, ratio: 0, provisional: false, ...over,
  };
}

test("weekRows returns seven rows starting today", () => {
  const rows = weekRows([], T0, NOW, SETTINGS);
  assert.equal(rows.length, 7);
  assert.equal(rows[0].date, T0);
  assert.equal(rows[0].isToday, true);
  assert.equal(rows[6].date, d(6));
  assert.equal(rows[1].isToday, false);
});

test("weekRows today row agrees with capacity()", () => {
  const tasks = [
    task({ id: "a", scheduled: T0, minutes: 900 }),
    task({ id: "b", scheduled: d(2), minutes: 60, committedOn: T0 }),
  ];
  const cap = capacity(tasks, T0, NOW, SETTINGS);
  const r = weekRows(tasks, T0, NOW, SETTINGS)[0];
  assert.equal(r.plannedMinutes, cap.plannedMinutes);
  assert.equal(r.ceilingMinutes, cap.minutesLeft);
  assert.equal(r.over, cap.over);
  assert.equal(r.over, true);
  assert.equal(r.tasks.length, 2);
  assert.equal(r.freeMinutes, 0);
  assert.equal(r.overByMinutes, 960 - 840);
});

test("weekRows drops hidden-until tasks from their day and never shows undated tasks", () => {
  const tasks = [
    task({ id: "h", scheduled: d(2), startOn: d(4) }),
    task({ id: "u", scheduled: null }),
    task({ id: "ok", scheduled: d(2) }),
  ];
  const rows = weekRows(tasks, T0, NOW, SETTINGS);
  assert.deepEqual(rows[2].tasks.map((t) => t.id), ["ok"]);
  assert.equal(rows.flatMap((r) => r.tasks).some((t) => t.id === "u"), false);
});

test("weekRows sorts by rank then sortOrder", () => {
  const tasks = [
    task({ id: "low", scheduled: d(1), priority: 0, sortOrder: 0 }),
    task({ id: "p1b", scheduled: d(1), priority: 1, sortOrder: 2 }),
    task({ id: "p1a", scheduled: d(1), priority: 1, sortOrder: 1 }),
  ];
  assert.deepEqual(weekRows(tasks, T0, NOW, SETTINGS)[1].tasks.map((t) => t.id), ["p1a", "p1b", "low"]);
});

test("weekRows future over-capacity day reports free, over and ratio", () => {
  const tasks = [task({ scheduled: d(2), minutes: 1040 })];
  const r = weekRows(tasks, T0, NOW, SETTINGS)[2];
  assert.equal(r.ceilingMinutes, 960);
  assert.equal(r.over, true);
  assert.equal(r.overByMinutes, 80);
  assert.equal(r.freeMinutes, 0);
  assert.equal(r.ratio, 1);
  const quiet = weekRows([task({ scheduled: d(3), minutes: 480 })], T0, NOW, SETTINGS)[3];
  assert.equal(quiet.over, false);
  assert.equal(quiet.freeMinutes, 480);
  assert.equal(quiet.ratio, 0.5);
});

test("weekRows is provisional and never over when settings are null", () => {
  const rows = weekRows([task({ scheduled: d(2), minutes: 100 })], T0, NOW, null);
  assert.equal(rows[2].provisional, true);
  assert.equal(rows[2].over, false);
  assert.equal(rows[2].ratio, 1);
  assert.equal(weekRows([], T0, NOW, SETTINGS)[2].provisional, false);
});

test("carriedTasks are open past-dated tasks, oldest first then sortOrder", () => {
  const tasks = [
    task({ id: "b", scheduled: d(-1), sortOrder: 1 }),
    task({ id: "a2", scheduled: d(-3), sortOrder: 2 }),
    task({ id: "a1", scheduled: d(-3), sortOrder: 1 }),
    task({ id: "done", scheduled: d(-2), status: "done" }),
    task({ id: "today", scheduled: T0 }),
    task({ id: "none", scheduled: null }),
  ];
  assert.deepEqual(carriedTasks(tasks, T0).map((t) => t.id), ["a1", "a2", "b"]);
});

test("weekHeadline branches", () => {
  const t = (n: number) => Array.from({ length: n }, () => task({}));
  const wed = d(2);
  assert.equal(weekHeadline([row({})], 0), "Nothing planned in the next 7 days.");
  assert.equal(weekHeadline([row({ tasks: t(1), plannedMinutes: 30 })], 0), "1 task, 30m planned.");
  assert.equal(
    weekHeadline([row({ tasks: t(14), plannedMinutes: 1115 })], 2),
    "14 tasks, 18h 35m planned. 2 carried over.",
  );
  assert.equal(weekHeadline([row({ tasks: t(5), plannedMinutes: 2050 })], 0), "5 tasks, 34h 10m planned.");
  assert.equal(weekHeadline([row({})], 3), "3 carried over.");
  const over = (date: string, isToday = false) => row({ date, isToday, tasks: t(1), plannedMinutes: 10, over: true });
  assert.equal(
    weekHeadline([over(wed)], 0),
    `1 task, 10m planned. ${fmtWeekday(wed)} is over capacity.`,
  );
  assert.equal(weekHeadline([over(T0, true)], 0), "1 task, 10m planned. Today is over capacity.");
  assert.equal(
    weekHeadline([over(wed), over(d(4))], 0),
    `2 tasks, 20m planned. ${fmtWeekday(wed)} and ${fmtWeekday(d(4))} are over capacity.`,
  );
  assert.equal(
    weekHeadline([over(d(1)), over(d(2)), over(d(3))], 1),
    "3 tasks, 30m planned. 3 days are over capacity. 1 carried over.",
  );
});

test("planItFor prefers carried over undated, checks fit, respects exclude", () => {
  const free = row({ freeMinutes: 60 });
  const carried = task({ id: "c", scheduled: d(-1), minutes: 45 });
  const undated = task({ id: "u", scheduled: null, minutes: 30, priority: 1 });
  assert.equal(planItFor([undated, carried], free, T0, NOW, null)?.id, "c");
  assert.equal(planItFor([undated, carried], free, T0, NOW, null, new Set(["c"]))?.id, "u");
  const big = task({ id: "big", scheduled: d(-1), minutes: 90 });
  assert.equal(planItFor([big, undated], free, T0, NOW, null)?.id, "u");
  assert.equal(planItFor([big], free, T0, NOW, null), null);
  assert.equal(planItFor([undated], free, T0, NOW, null, new Set(["u"])), null);
});

test("planItFor returns null when the day has tasks or no free time", () => {
  const undated = task({ id: "u", scheduled: null, minutes: 30 });
  assert.equal(planItFor([undated], row({ tasks: [task({})], freeMinutes: 60 }), T0, NOW, null), null);
  assert.equal(planItFor([undated], row({ freeMinutes: 0 }), T0, NOW, null), null);
});

test("planItFor skips hidden-until and blocked undated tasks", () => {
  const blocker = task({ id: "blk", scheduled: d(3) });
  const hidden = task({ id: "h", scheduled: null, minutes: 20, startOn: d(5) });
  const blocked = task({ id: "bl", scheduled: null, minutes: 20, blockedBy: ["blk"] });
  assert.equal(planItFor([blocker, hidden, blocked], row({ freeMinutes: 60 }), T0, NOW, null), null);
});
