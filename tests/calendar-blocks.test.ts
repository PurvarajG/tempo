import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_BLOCK_MINUTES,
  layoutLanes,
  minutesToHHMM,
  plannedBlocks,
  trackedBlocks,
  type CalendarBlock,
} from "../lib/calendar-blocks";
import type { Task, TimeEntry } from "../lib/types";

const DAY = "2026-03-10";
const NEXT = "2026-03-11";
const PREV = "2026-03-09";

function task(over: Partial<Task>): Task {
  return {
    id: "t1",
    title: "Task",
    boardOrder: 0,
    tags: [],
    scheduled: DAY,
    minutes: 0,
    priority: 0,
    status: "open",
    isComplex: false,
    sortOrder: 0,
    createdAt: "2026-03-01T00:00:00.000Z",
    subtasks: [],
    ...over,
  };
}

function local(day: string, hhmm: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  return new Date(y, m - 1, d, h, mi).toISOString();
}

function entry(over: Partial<TimeEntry>): TimeEntry {
  return {
    id: "e1",
    taskId: "t1",
    categoryId: "c1",
    startedAt: local(DAY, "09:00"),
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    ...over,
  };
}

function block(key: string, startMin: number, endMin: number): CalendarBlock {
  return { key, kind: "planned", taskId: key, title: key, projectId: null, startMin, endMin, running: false, done: false };
}

test("planned: uses minutes, defaults when 0, skips untimed", () => {
  const blocks = plannedBlocks(DAY, [
    task({ id: "a", dueTime: "09:00", minutes: 45, projectId: "p1", status: "done" }),
    task({ id: "b", dueTime: "13:30", minutes: 0 }),
    task({ id: "c" }),
  ]);
  assert.equal(blocks.length, 2);
  assert.deepEqual(
    { k: blocks[0].key, s: blocks[0].startMin, e: blocks[0].endMin, p: blocks[0].projectId, d: blocks[0].done },
    { k: "p:a", s: 540, e: 585, p: "p1", d: true },
  );
  assert.equal(blocks[1].endMin - blocks[1].startMin, DEFAULT_BLOCK_MINUTES);
  assert.equal(blocks[1].kind, "planned");
});

test("planned: end clamps at midnight", () => {
  const [b] = plannedBlocks(DAY, [task({ dueTime: "23:30", minutes: 120 })]);
  assert.equal(b.startMin, 1410);
  assert.equal(b.endMin, 1440);
});

test("tracked: finished entry", () => {
  const [b] = trackedBlocks(
    DAY,
    [entry({ endedAt: local(DAY, "10:15") })],
    null,
    [task({ id: "t1", title: "Write", projectId: "p9" })],
    new Date(local(DAY, "12:00")),
  );
  assert.equal(b.key, `t:e1:${DAY}`);
  assert.equal(b.kind, "tracked");
  assert.equal(b.title, "Write");
  assert.equal(b.projectId, "p9");
  assert.equal(b.startMin, 540);
  assert.equal(b.endMin, 615);
  assert.equal(b.running, false);
});

test("tracked: unknown task is Untitled", () => {
  const [b] = trackedBlocks(DAY, [entry({ endedAt: local(DAY, "10:00") })], null, [], new Date(local(DAY, "12:00")));
  assert.equal(b.title, "Untitled");
  assert.equal(b.projectId, null);
});

test("tracked: running entry ends at now", () => {
  const run = entry({ id: "r1" });
  const [b] = trackedBlocks(DAY, [], run, [], new Date(local(DAY, "09:40")));
  assert.equal(b.running, true);
  assert.equal(b.startMin, 540);
  assert.equal(b.endMin, 580);
});

test("tracked: running is deduped against entries", () => {
  const run = entry({ id: "r1" });
  const blocks = trackedBlocks(DAY, [run], run, [], new Date(local(DAY, "09:40")));
  assert.equal(blocks.length, 1);
});

test("tracked: minimum length is one minute", () => {
  const [b] = trackedBlocks(DAY, [entry({ endedAt: local(DAY, "09:00") })], null, [], new Date(local(DAY, "12:00")));
  assert.equal(b.endMin - b.startMin, 1);
});

test("tracked: entry crossing midnight appears on both days, clipped", () => {
  const e = entry({ startedAt: local(DAY, "23:00"), endedAt: local(NEXT, "01:30") });
  const now = new Date(local(NEXT, "12:00"));
  const [a] = trackedBlocks(DAY, [e], null, [], now);
  const [b] = trackedBlocks(NEXT, [e], null, [], now);
  assert.deepEqual([a.startMin, a.endMin, a.key], [1380, 1440, `t:e1:${DAY}`]);
  assert.deepEqual([b.startMin, b.endMin, b.key], [0, 90, `t:e1:${NEXT}`]);
});

test("tracked: entry on another day is excluded", () => {
  const e = entry({ startedAt: local(PREV, "09:00"), endedAt: local(PREV, "10:00") });
  assert.equal(trackedBlocks(DAY, [e], null, [], new Date(local(DAY, "12:00"))).length, 0);
  const later = entry({ id: "e2", startedAt: local(NEXT, "09:00"), endedAt: local(NEXT, "10:00") });
  assert.equal(trackedBlocks(DAY, [later], null, [], new Date(local(DAY, "12:00"))).length, 0);
});

test("lanes: a lone block has one lane", () => {
  const [p] = layoutLanes([block("a", 600, 660)]);
  assert.deepEqual([p.lane, p.lanes], [0, 1]);
});

test("lanes: overlapping blocks split into two lanes", () => {
  const out = layoutLanes([block("b", 630, 690), block("a", 600, 660)]);
  assert.deepEqual(out.map((p) => [p.key, p.lane, p.lanes]), [
    ["a", 0, 2],
    ["b", 1, 2],
  ]);
});

test("lanes: touching blocks do not overlap", () => {
  const out = layoutLanes([block("a", 600, 660), block("b", 660, 720)]);
  assert.deepEqual(out.map((p) => [p.lane, p.lanes]), [
    [0, 1],
    [0, 1],
  ]);
});

test("lanes: a freed lane is reused within a cluster", () => {
  const out = layoutLanes([block("a", 600, 660), block("b", 600, 720), block("c", 660, 700)]);
  const c = out.find((p) => p.key === "c")!;
  assert.equal(c.lane, 1, "the longer block takes lane 0; c reuses the lane a freed");
  assert.ok(out.every((p) => p.lanes === 2));
});

test("minutesToHHMM", () => {
  assert.equal(minutesToHHMM(540), "09:00");
  assert.equal(minutesToHHMM(1440), "24:00");
  assert.equal(minutesToHHMM(75), "01:15");
});
