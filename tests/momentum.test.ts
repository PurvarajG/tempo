import assert from "node:assert/strict";
import test from "node:test";
import { momentum, type MomentumInput } from "../lib/momentum";
import type { Project, Task, TimeEntry } from "../lib/types";

const TODAY = "2026-11-12";

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

function proj(id: string, name: string): Project {
  return { id, name, color: "#0052ff", archived: false, sortOrder: 0, createdAt: "2026-11-01T00:00:00.000Z" };
}

function entry(taskId: string, minutes: number, day = TODAY, running = false): TimeEntry {
  const startedAt = new Date(`${day}T10:00:00`).toISOString();
  return {
    id: `e${++seq}`,
    taskId,
    categoryId: "c",
    startedAt,
    ...(running ? {} : { endedAt: startedAt, minutes }),
    createdAt: startedAt,
    updatedAt: startedAt,
  };
}

function input(over: Partial<MomentumInput> = {}): MomentumInput {
  return {
    done: [],
    open: [],
    upNext: null,
    tasks: [],
    projects: [],
    entries: [],
    todayISO: TODAY,
    dayDone: false,
    ...over,
  };
}

test("nothing planned, percent is 0 with total 0", () => {
  const m = momentum(input());
  assert.equal(m.sentence, "Nothing planned for today.");
  assert.equal(m.total, 0);
  assert.equal(m.percent, 0);
});

test("nothing done yet with an up next names the title", () => {
  const a = mk({ title: "Call printer" });
  const m = momentum(input({ open: [a, mk()], upNext: a }));
  assert.equal(m.sentence, "Start with Call printer.");
  assert.deepEqual([m.done, m.total, m.percent], [0, 2, 0]);
});

test("some done with an up next", () => {
  const a = mk({ title: "Write brief" });
  const m = momentum(input({ done: [mk()], open: [a, mk()], upNext: a }));
  assert.equal(m.sentence, "1 done. Write brief is next.");
  assert.deepEqual([m.done, m.total, m.percent], [1, 3, 33]);
});

test("all done", () => {
  const m = momentum(input({ done: [mk(), mk()] }));
  assert.equal(m.sentence, "All done for today.");
  assert.equal(m.percent, 100);
});

test("day done with open tasks is neutral", () => {
  const one = momentum(input({ done: [mk()], open: [mk()], dayDone: true }));
  assert.equal(one.sentence, "Day wrapped with 1 still open. Carry it to tomorrow.");
  const two = momentum(input({ open: [mk(), mk()], dayDone: true }));
  assert.equal(two.sentence, "Day wrapped with 2 still open. Carry them to tomorrow.");
});

test("open tasks without an up next fall back to a count", () => {
  const m = momentum(input({ done: [mk()], open: [mk(), mk()] }));
  assert.equal(m.sentence, "1 done. 2 still open.");
});

test("sentences use no dashes or middle dots", () => {
  const a = mk({ title: "X" });
  for (const m of [
    momentum(input()),
    momentum(input({ open: [a], upNext: a })),
    momentum(input({ open: [mk()], dayDone: true })),
  ]) {
    assert.doesNotMatch(m.sentence, /[—–·]/);
  }
});

test("foot names the project with the most minutes", () => {
  const a = mk({ projectId: "p1" });
  const b = mk({ projectId: "p2" });
  const m = momentum(
    input({
      tasks: [a, b],
      projects: [proj("p1", "MSM26"), proj("p2", "Home")],
      entries: [entry(a.id, 20), entry(b.id, 50), entry(a.id, 10)],
    }),
  );
  assert.equal(m.foot, "Most of today went to Home.");
});

test("foot is null under 15 tracked minutes", () => {
  const a = mk({ projectId: "p1" });
  const m = momentum(input({ tasks: [a], projects: [proj("p1", "MSM26")], entries: [entry(a.id, 14)] }));
  assert.equal(m.foot, null);
});

test("foot ignores other days and running entries", () => {
  const a = mk({ projectId: "p1" });
  const m = momentum(
    input({
      tasks: [a],
      projects: [proj("p1", "MSM26")],
      entries: [entry(a.id, 60, "2026-11-11"), entry(a.id, 60, TODAY, true)],
    }),
  );
  assert.equal(m.foot, null);
});

test("foot is null when the top project has no name or tasks have no project", () => {
  const a = mk({ projectId: "p1" });
  const none = mk();
  assert.equal(
    momentum(input({ tasks: [a], projects: [proj("p1", "  ")], entries: [entry(a.id, 30)] })).foot,
    null,
  );
  assert.equal(momentum(input({ tasks: [none], entries: [entry(none.id, 30)] })).foot, null);
});
