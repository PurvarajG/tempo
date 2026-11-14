import assert from "node:assert/strict";
import test from "node:test";
import { dayPlan } from "../lib/day-plan";
import type { PlanBlock } from "../lib/day-plan";
import type { Task } from "../lib/types";

let seq = 0;
function mk(over: Partial<Task> = {}): Task {
  seq += 1;
  return {
    id: `t${seq}`,
    title: `Task ${seq}`,
    boardOrder: 0,
    tags: [],
    scheduled: "2026-11-12",
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
const at = (h: number, m = 0, s = 0) => new Date(2026, 10, 12, h, m, s);
const shape = (blocks: PlanBlock[]) =>
  blocks.map((b) => (b.kind === "task" ? `T${b.task.id}@${b.start}-${b.end}` : `free@${b.start}-${b.end}`));

test("labels by time of day", () => {
  assert.equal(dayPlan({ open: [], now: at(9), endHour: 18, runningTaskId: null }).label, "This morning");
  assert.equal(dayPlan({ open: [], now: at(11, 59), endHour: 18, runningTaskId: null }).label, "This morning");
  assert.equal(dayPlan({ open: [], now: at(12), endHour: 18, runningTaskId: null }).label, "This afternoon");
  assert.equal(dayPlan({ open: [], now: at(16, 59), endHour: 18, runningTaskId: null }).label, "This afternoon");
  assert.equal(dayPlan({ open: [], now: at(17), endHour: 21, runningTaskId: null }).label, "This evening");
});

test("from rounds up to the next 5 minutes, to is endHour", () => {
  const p = (n: Date) => dayPlan({ open: [], now: n, endHour: 17, runningTaskId: null });
  assert.equal(p(at(10, 1)).from, "10:05");
  assert.equal(p(at(10, 5)).from, "10:05");
  assert.equal(p(at(10, 5, 10)).from, "10:10");
  assert.equal(p(at(10, 56)).from, "11:00");
  assert.equal(p(at(10, 0)).to, "17:00");
});

test("empty day is one free block", () => {
  const plan = dayPlan({ open: [], now: at(15), endHour: 17, runningTaskId: null });
  assert.deepEqual(shape(plan.blocks), ["free@15:00-17:00"]);
});

test("running task is placed first with current", () => {
  const a = mk();
  const run = mk({ minutes: 45 });
  const plan = dayPlan({ open: [a, run], now: at(10, 2), endHour: 17, runningTaskId: run.id });
  const first = plan.blocks[0];
  assert.equal(first.kind, "task");
  if (first.kind === "task") {
    assert.equal(first.task, run);
    assert.equal(first.current, true);
    assert.equal(first.start, "10:05");
    assert.equal(first.end, "10:50");
  }
  assert.deepEqual(shape(plan.blocks).slice(0, 2), [`T${run.id}@10:05-10:50`, `T${a.id}@10:50-11:20`]);
});

test("fixed task sits at its dueTime and splits the gaps", () => {
  const f = mk({ dueTime: "14:00", minutes: 60 });
  const plan = dayPlan({ open: [f], now: at(13), endHour: 17, runningTaskId: null });
  assert.deepEqual(shape(plan.blocks), ["free@13:00-14:00", `T${f.id}@14:00-15:00`, "free@15:00-17:00"]);
  const b = plan.blocks[1];
  assert.equal(b.kind === "task" && b.fixed, true);
});

test("untimed tasks pack in list order; past dueTime counts as untimed; 0 minutes is 15", () => {
  const a = mk({ minutes: 30 });
  const past = mk({ dueTime: "08:00", minutes: 20 });
  const z = mk({ minutes: 0 });
  const plan = dayPlan({ open: [a, past, z], now: at(10), endHour: 17, runningTaskId: null });
  assert.deepEqual(shape(plan.blocks).slice(0, 3), [
    `T${a.id}@10:00-10:30`,
    `T${past.id}@10:30-10:50`,
    `T${z.id}@10:50-11:05`,
  ]);
  const last = plan.blocks[2];
  assert.equal(last.kind === "task" && last.minutes, 15);
  assert.equal(plan.blocks[3].kind, "free");
});

test("overlapping fixed blocks go one after the other", () => {
  const a = mk({ dueTime: "14:00", minutes: 60 });
  const b = mk({ dueTime: "14:30", minutes: 30 });
  const plan = dayPlan({ open: [a, b], now: at(13, 30), endHour: 17, runningTaskId: null });
  assert.deepEqual(shape(plan.blocks), [
    "free@13:30-14:00",
    `T${a.id}@14:00-15:00`,
    `T${b.id}@15:00-15:30`,
    "free@15:30-17:00",
  ]);
});

test("a task that does not fit before a fixed block goes after it, leaving the gap free", () => {
  const f = mk({ dueTime: "11:00", minutes: 60 });
  const big = mk({ minutes: 90 });
  const small = mk({ minutes: 15 });
  const plan = dayPlan({ open: [big, small, f], now: at(10), endHour: 17, runningTaskId: null });
  // big does not fit in 10:00-11:00, so it goes after f; small then follows big.
  assert.deepEqual(shape(plan.blocks), [
    "free@10:00-11:00",
    `T${f.id}@11:00-12:00`,
    `T${big.id}@12:00-13:30`,
    `T${small.id}@13:30-13:45`,
    "free@13:45-17:00",
  ]);
});

test("gaps under 15 minutes are not shown", () => {
  const f = mk({ dueTime: "10:10", minutes: 30 });
  const plan = dayPlan({ open: [f], now: at(10), endHour: 17, runningTaskId: null });
  assert.deepEqual(shape(plan.blocks), [`T${f.id}@10:10-10:40`, "free@10:40-17:00"]);
});

test("fits is set when exactly one later task fits the gap", () => {
  const f = mk({ dueTime: "11:00", minutes: 30 });
  const big = mk({ minutes: 90 });
  const tiny = mk({ minutes: 20 });
  // big is pushed past f; tiny follows big, so the 10:00-11:00 gap stays free.
  const plan = dayPlan({ open: [big, tiny, f], now: at(10), endHour: 17, runningTaskId: null });
  const gap = plan.blocks[0];
  assert.equal(gap.kind, "free");
  if (gap.kind === "free") assert.equal(gap.fits, tiny);
});

test("fits names the one task, null for two or none", () => {
  const f = mk({ dueTime: "10:30", minutes: 30 });
  const lead = mk({ minutes: 45 }); // pushed past f, leaving 10:00-10:30 free
  const one = dayPlan({ open: [lead, f], now: at(10), endHour: 17, runningTaskId: null });
  const g1 = one.blocks[0];
  assert.equal(g1.kind, "free");
  if (g1.kind === "free") assert.equal(g1.fits, null); // lead is 45 > 30: none fits

  const a = mk({ minutes: 45 });
  const b = mk({ minutes: 25 });
  const f2 = mk({ dueTime: "10:30", minutes: 30 });
  const some = dayPlan({ open: [a, b, f2], now: at(10), endHour: 17, runningTaskId: null });
  // a (45) skips the gap; b (25) is tried next but the cursor is past f2, so it follows a.
  const g2 = some.blocks[0];
  assert.equal(g2.kind, "free");
  if (g2.kind === "free") assert.equal(g2.fits, b); // only b fits 30 min

  const c = mk({ minutes: 20 });
  const two = dayPlan({ open: [a, b, c, f2], now: at(10), endHour: 17, runningTaskId: null });
  const g3 = two.blocks[0];
  assert.equal(g3.kind, "free");
  if (g3.kind === "free") assert.equal(g3.fits, null); // b and c both fit
});

test("tasks that do not fit before the end hour go to leftover", () => {
  const a = mk({ minutes: 60 });
  const b = mk({ minutes: 60 });
  const c = mk({ minutes: 30 });
  const plan = dayPlan({ open: [a, b, c], now: at(15), endHour: 17, runningTaskId: null });
  assert.deepEqual(shape(plan.blocks), [`T${a.id}@15:00-16:00`, `T${b.id}@16:00-17:00`]);
  assert.deepEqual(plan.leftover, [c]);
});

test("a free block can suggest a leftover task", () => {
  const f = mk({ dueTime: "16:00", minutes: 60 });
  const a = mk({ minutes: 90 }); // does not fit before f, nor after it
  const s = mk({ minutes: 45 }); // follows a? no: a is leftover, cursor jumped past f
  const plan = dayPlan({ open: [a, s, f], now: at(15), endHour: 17, runningTaskId: null });
  assert.deepEqual(plan.leftover, [a, s]);
  const gap = plan.blocks[0];
  assert.equal(gap.kind, "free");
  if (gap.kind === "free") assert.equal(gap.fits, s); // 60 min gap: a (90) no, s (45) yes
});

test("after the end hour: no blocks, everything is leftover", () => {
  const a = mk();
  const b = mk();
  const plan = dayPlan({ open: [a, b], now: at(18, 30), endHour: 18, runningTaskId: null });
  assert.deepEqual(plan.blocks, []);
  assert.deepEqual(plan.leftover, [a, b]);
  assert.equal(plan.to, "18:00");
});
