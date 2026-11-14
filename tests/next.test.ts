import assert from "node:assert/strict";
import test from "node:test";
import { isBlocked, isHiddenUntil, rankSuggestions, suggest } from "../lib/next";
import type { Task } from "../lib/types";

const NOW = new Date(2026, 10, 12, 10, 0, 0); // 2026-11-12 10:00 local
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

test("running beats committed beats due today beats priority 1", () => {
  const running = mk({ projectId: "a" });
  const committed = mk({ projectId: "b", committedOn: TODAY });
  const due = mk({ projectId: "c", dueTime: "15:00" });
  const p1 = mk({ projectId: "d", priority: 1 });
  const order = rankSuggestions([p1, due, committed, running], NOW, running.id).map((s) => s.task.id);
  assert.deepEqual(order, [running.id, committed.id, due.id, p1.id]);
});

test("committed 30 + due 25 + priority 15 is a sum, not a max", () => {
  const a = mk({ projectId: "a", committedOn: TODAY });
  const b = mk({ projectId: "b", dueTime: "09:00", priority: 1, committedOn: undefined });
  const c = mk({ projectId: "c", dueTime: "09:00", priority: 1, committedOn: TODAY });
  const order = rankSuggestions([a, b, c], NOW, null).map((s) => s.task.id);
  // c = 70, b = 25 + 15 = 40, a = 30
  assert.deepEqual(order, [c.id, b.id, a.id]);
});

test("priority weights are 15, 8, 3", () => {
  const p1 = mk({ projectId: "a", priority: 1 });
  const p2 = mk({ projectId: "b", priority: 2 });
  const p3 = mk({ projectId: "c", priority: 3 });
  const p0 = mk({ projectId: "d", priority: 0 });
  const r = rankSuggestions([p0, p3, p2, p1], NOW, null);
  assert.deepEqual(r.map((s) => s.task.id), [p1.id, p2.id, p3.id, p0.id]);
  assert.deepEqual(r[0].reasons, ["High priority"]);
  assert.deepEqual(r[1].reasons, ["Medium priority"]);
  assert.deepEqual(r[2].reasons, ["Low priority"]);
  assert.deepEqual(r[3].reasons, []);
});

test("due today needs a due time and today's date", () => {
  const timed = mk({ projectId: "a", dueTime: "15:30" });
  const plain = mk({ projectId: "b", priority: 1 }); // 15
  const r = rankSuggestions([plain, timed], NOW, null);
  assert.equal(r[0].task.id, timed.id);
  assert.deepEqual(r[0].reasons, ["Due 15:30"]);
});

test("due time formats as 24-hour with two digits", () => {
  const noon = mk({ dueTime: "12:00" });
  assert.deepEqual(suggest([noon], NOW, null)?.reasons, ["Due 12:00"]);
  const morning = mk({ dueTime: "09:05" });
  assert.deepEqual(suggest([morning], NOW, null)?.reasons, ["Due 09:05"]);
  const mid = mk({ dueTime: "00:00" });
  assert.deepEqual(suggest([mid], NOW, null)?.reasons, ["Due 00:00"]);
});

test("carried over rises from 10 at one day to 20 at seven days, flat after", () => {
  const d1 = mk({ projectId: "a", scheduled: "2026-11-11" });
  const d3 = mk({ projectId: "b", scheduled: "2026-11-09" });
  const d7 = mk({ projectId: "c", scheduled: "2026-11-05" });
  const d30 = mk({ projectId: "d", scheduled: "2026-10-13" });
  const r = rankSuggestions([d1, d3, d7, d30], NOW, null);
  // d7 and d30 tie on score (20); tie-break by earlier scheduled puts d30 first.
  assert.deepEqual(r.map((s) => s.task.id), [d30.id, d7.id, d3.id, d1.id]);
  assert.deepEqual(r[0].reasons, ["Carried over"]);
});

test("overdue curve is flat after 7 days: a 30 day old task does not beat priority plus 7 days", () => {
  const old = mk({ projectId: "a", scheduled: "2026-10-01" }); // 20
  const fresh = mk({ projectId: "b", scheduled: "2026-11-05", priority: 3 }); // 20 + 3
  const r = rankSuggestions([old, fresh], NOW, null);
  assert.equal(r[0].task.id, fresh.id);
});

test("carried over uses finishDate for multi-day tasks", () => {
  const inside = mk({ projectId: "a", scheduled: "2026-11-10", isComplex: true, finishDate: "2026-11-20" });
  const r = suggest([inside], NOW, null);
  assert.ok(r);
  assert.deepEqual(r.reasons, []);
  const past = mk({ projectId: "b", scheduled: "2026-11-01", isComplex: true, finishDate: "2026-11-10" });
  assert.deepEqual(suggest([past], NOW, null)?.reasons, ["Carried over"]);
});

test("blocking another open task adds 10 and says Unblocks N", () => {
  const blocker = mk({ projectId: "a" });
  const w1 = mk({ projectId: "b", blockedBy: [blocker.id] });
  const w2 = mk({ projectId: "c", blockedBy: [blocker.id] });
  const plain = mk({ projectId: "d", priority: 1 }); // 15 vs 10
  const r = rankSuggestions([plain, blocker, w1, w2], NOW, null);
  assert.equal(r[0].task.id, plain.id);
  const b = r.find((s) => s.task.id === blocker.id);
  assert.deepEqual(b?.reasons, ["Unblocks 2"]);
  const single = mk({ projectId: "e" });
  const w3 = mk({ projectId: "f", blockedBy: [single.id] });
  assert.deepEqual(suggest([single, w3], NOW, null)?.reasons, ["Unblocks 1"]);
});

test("a passed start date adds 5 and says Can start now", () => {
  const started = mk({ projectId: "a", startOn: "2026-11-10" });
  const plain = mk({ projectId: "b", priority: 3 }); // 3 vs 5
  const r = rankSuggestions([plain, started], NOW, null);
  assert.equal(r[0].task.id, started.id);
  assert.deepEqual(r[0].reasons, ["Can start now"]);
});

test("fits before the next event adds 5 when the task is short enough", () => {
  const next = new Date(2026, 10, 12, 15, 0, 0);
  const short = mk({ projectId: "a", minutes: 60 });
  const long = mk({ projectId: "b", minutes: 600, priority: 3 }); // 3 vs 5
  const r = rankSuggestions([long, short], NOW, null, { nextEventStart: next });
  assert.equal(r[0].task.id, short.id);
  assert.deepEqual(r[0].reasons, ["Fits before 15:00"]);
  const past = new Date(2026, 10, 12, 9, 0, 0);
  assert.deepEqual(suggest([short], NOW, null, { nextEventStart: past })?.reasons, []);
});

test("done, trashed, hidden, blocked, skipped and undated tasks are excluded", () => {
  const blocker = mk({ projectId: "z" });
  const tasks = [
    blocker,
    mk({ status: "done" }),
    mk({ status: "trashed" }),
    mk({ startOn: "2026-11-13" }),
    mk({ blockedBy: [blocker.id] }),
    mk({ scheduled: null }),
    mk({ scheduled: "2026-11-13" }),
  ];
  const skipped = mk({ projectId: "s" });
  const r = rankSuggestions([...tasks, skipped], NOW, null, { skipIds: new Set([skipped.id]) });
  // Only the open blocker itself is eligible.
  assert.deepEqual(r.map((s) => s.task.id), [blocker.id]);
});

test("an unblocked task (blocker done) is a candidate", () => {
  const blocker = mk({ status: "done", projectId: "a" });
  const t = mk({ projectId: "b", blockedBy: [blocker.id] });
  assert.equal(suggest([blocker, t], NOW, null)?.task.id, t.id);
});

test("undated tasks qualify only when running or committed", () => {
  const inbox = mk({ scheduled: null });
  assert.equal(suggest([inbox], NOW, null), null);
  assert.equal(suggest([inbox], NOW, inbox.id)?.task.id, inbox.id);
  const committed = mk({ scheduled: null, committedOn: TODAY });
  assert.deepEqual(suggest([committed], NOW, null)?.reasons, ["Committed today"]);
});

test("commitment from another day does not count", () => {
  const stale = mk({ scheduled: "2026-11-20", committedOn: "2026-11-11" });
  assert.equal(suggest([stale], NOW, null), null);
});

test("a multi-day task qualifies inside its range", () => {
  const t = mk({ scheduled: "2026-11-10", isComplex: true, finishDate: "2026-11-15" });
  assert.equal(suggest([t], NOW, null)?.task.id, t.id);
  const future = mk({ scheduled: "2026-11-13", isComplex: true, finishDate: "2026-11-15" });
  assert.equal(suggest([future], NOW, null), null);
});

test("one task per project, and the alternative is from another project", () => {
  const a1 = mk({ projectId: "a", priority: 1 });
  const a2 = mk({ projectId: "a", priority: 2 });
  const b1 = mk({ projectId: "b", priority: 3 });
  const r = rankSuggestions([a2, b1, a1], NOW, null);
  assert.deepEqual(r.map((s) => s.task.id), [a1.id, b1.id]);
});

test("tasks without a project each count as their own group", () => {
  const x = mk({ priority: 1 });
  const y = mk({ priority: 2 });
  assert.equal(rankSuggestions([x, y], NOW, null).length, 2);
});

test("projectId filter keeps only that project", () => {
  const a = mk({ projectId: "a", priority: 3 });
  const b = mk({ projectId: "b", priority: 1 });
  assert.equal(suggest([a, b], NOW, null, { projectId: "a" })?.task.id, a.id);
  assert.equal(suggest([a, b], NOW, null, { projectId: "none" }), null);
});

test("ties break by priority, scheduled, sortOrder, then id", () => {
  const a = mk({ projectId: "a", sortOrder: 5, scheduled: "2026-11-12" });
  const b = mk({ projectId: "b", sortOrder: 2, scheduled: "2026-11-12" });
  assert.deepEqual(rankSuggestions([a, b], NOW, null).map((s) => s.task.id), [b.id, a.id]);
  const c = mk({ projectId: "c", id: "zzz", sortOrder: 1 });
  const d = mk({ projectId: "d", id: "aaa", sortOrder: 1 });
  assert.deepEqual(rankSuggestions([c, d], NOW, null).map((s) => s.task.id), ["aaa", "zzz"]);
});

test("reasons are capped at two, strongest first, and never say Overdue or show a score", () => {
  const t = mk({
    projectId: "a",
    scheduled: "2026-11-01",
    committedOn: TODAY,
    priority: 1,
    startOn: "2026-11-01",
  });
  const dep = mk({ projectId: "b", blockedBy: [t.id] });
  const r = suggest([t, dep], NOW, t.id, { nextEventStart: new Date(2026, 10, 12, 15) });
  assert.ok(r);
  assert.deepEqual(r.reasons, ["Timer running", "Committed today"]);
  for (const task of [t, dep]) {
    for (const s of rankSuggestions([t, dep], NOW, t.id)) {
      for (const reason of s.reasons) {
        assert.ok(!/overdue/i.test(reason));
        assert.ok(!/[–—·]/.test(reason));
        assert.ok(!/\d{2,}/.test(reason));
      }
    }
    void task;
  }
});

test("returns null when nothing qualifies", () => {
  assert.equal(suggest([], NOW, null), null);
  assert.equal(suggest([mk({ status: "done" })], NOW, null), null);
});

test("isHiddenUntil", () => {
  assert.equal(isHiddenUntil(mk(), TODAY), false);
  assert.equal(isHiddenUntil(mk({ startOn: TODAY }), TODAY), false);
  assert.equal(isHiddenUntil(mk({ startOn: "2026-11-13" }), TODAY), true);
});

test("isBlocked", () => {
  const open = mk();
  const done = mk({ status: "done" });
  const byId = new Map([open, done].map((t) => [t.id, t]));
  assert.equal(isBlocked(mk(), byId), false);
  assert.equal(isBlocked(mk({ blockedBy: [done.id] }), byId), false);
  assert.equal(isBlocked(mk({ blockedBy: [done.id, open.id] }), byId), true);
  assert.equal(isBlocked(mk({ blockedBy: ["missing"] }), byId), false);
});
