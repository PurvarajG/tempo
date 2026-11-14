import assert from "node:assert/strict";
import test from "node:test";
import {
  capacity,
  headline,
  inboxCount,
  isCarried,
  isInbox,
  isPastWrap,
  isPlanned,
  layoutToday,
  plannedByDay,
  trackedByDay,
  weekDays,
} from "../lib/today";
import { DAY_END_HOUR, type Task, type TimeEntry } from "../lib/types";

const NOW = new Date(2026, 10, 12, 10, 0, 0); // Thu 2026-11-12 10:00 local
const TODAY = "2026-11-12";
const LATER = "2026-11-20";

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

function entry(startedAt: Date, minutes?: number, ended = true): TimeEntry {
  seq += 1;
  return {
    id: `e${seq}`,
    taskId: "x",
    categoryId: "c",
    startedAt: startedAt.toISOString(),
    endedAt: ended ? startedAt.toISOString() : undefined,
    minutes,
    createdAt: "",
    updatedAt: "",
  };
}

test("planned vs carried split", () => {
  const today = mk();
  const old = mk({ scheduled: "2026-11-10" });
  const future = mk({ scheduled: "2026-11-13" });
  assert.equal(isPlanned(today, TODAY), true);
  assert.equal(isCarried(today, TODAY), false);
  assert.equal(isPlanned(old, TODAY), false);
  assert.equal(isCarried(old, TODAY), true);
  assert.equal(isPlanned(future, TODAY), false);
  assert.equal(isCarried(future, TODAY), false);
});

test("hidden-until, undated and trashed are excluded", () => {
  const hidden = mk({ startOn: "2026-11-20" });
  const hiddenOld = mk({ scheduled: "2026-11-01", startOn: "2026-11-20" });
  const undated = mk({ scheduled: null });
  const trashed = mk({ status: "trashed" });
  assert.equal(isPlanned(hidden, TODAY), false);
  assert.equal(isCarried(hiddenOld, TODAY), false);
  const l = layoutToday([hidden, hiddenOld, undated, trashed], TODAY, NOW, null);
  assert.deepEqual([l.committed, l.couldAlso, l.carried, l.done], [[], [], [], []]);
  assert.equal(inboxCount([hidden, undated, trashed, mk({ scheduled: null, startOn: "2026-12-01" })], TODAY), 1);
});

test("complex task spanning today is planned, not carried", () => {
  const span = mk({ scheduled: "2026-11-10", isComplex: true, finishDate: "2026-11-14" });
  const ended = mk({ scheduled: "2026-11-05", isComplex: true, finishDate: "2026-11-09" });
  assert.equal(isPlanned(span, TODAY), true);
  assert.equal(isCarried(span, TODAY), false);
  assert.equal(isPlanned(ended, TODAY), false);
  assert.equal(isCarried(ended, TODAY), true);
});

test("layout sorts and splits buckets", () => {
  const p3 = mk({ priority: 3, projectId: "a" });
  const p1 = mk({ priority: 1, projectId: "b" });
  const c = mk({ committedOn: TODAY, projectId: "c" });
  const older = mk({ scheduled: "2026-11-08", projectId: "d" });
  const old = mk({ scheduled: "2026-11-05", projectId: "e" });
  const done = mk({ status: "done", completedAt: new Date(2026, 10, 12, 8, 0).toISOString() });
  const doneLater = mk({ status: "done", completedAt: new Date(2026, 10, 12, 9, 0).toISOString() });
  const doneYesterday = mk({ status: "done", completedAt: new Date(2026, 10, 11, 9, 0).toISOString() });
  const l = layoutToday([p3, p1, c, older, old, done, doneLater, doneYesterday], TODAY, NOW, null);
  assert.equal(l.upNext?.task.id, c.id);
  assert.deepEqual(l.couldAlso.map((t) => t.id), [p1.id, p3.id]);
  assert.deepEqual(l.carried.map((t) => t.id), [old.id, older.id]);
  assert.deepEqual(l.done.map((t) => t.id), [doneLater.id, done.id]);
  assert.equal(l.alternatives.length, 4);
});

test("skipIds changes upNext", () => {
  const a = mk({ committedOn: TODAY, projectId: "a" });
  const b = mk({ projectId: "b", priority: 1 });
  assert.equal(layoutToday([a, b], TODAY, NOW, null).upNext?.task.id, a.id);
  const l = layoutToday([a, b], TODAY, NOW, null, new Set([a.id]));
  assert.equal(l.upNext?.task.id, b.id);
  assert.ok(l.committed.some((t) => t.id === a.id));
});

test("P-06: planned and committed and up next appears once", () => {
  const star = mk({ committedOn: TODAY, priority: 1 });
  const other = mk({ committedOn: TODAY });
  const plain = mk();
  const stale = mk({ scheduled: "2026-11-09", committedOn: TODAY });
  const tasks = [star, other, plain, stale];
  const l = layoutToday(tasks, TODAY, NOW, null);
  const ids = [
    ...(l.upNext ? [l.upNext.task.id] : []),
    ...l.committed.map((t) => t.id),
    ...l.couldAlso.map((t) => t.id),
    ...l.carried.map((t) => t.id),
  ];
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, tasks.length);
  assert.equal(l.upNext?.task.id, star.id);
  assert.equal(l.committed.some((t) => t.id === star.id), false);
});

test("capacity with settings", () => {
  const planned = mk({ minutes: 60 });
  const committed = mk({ minutes: 30, committedOn: TODAY, scheduled: "2026-11-11" });
  const carried = mk({ minutes: 500, scheduled: "2026-11-01" });
  const c = capacity([planned, committed, carried], TODAY, NOW, { wakingEndHour: 18 });
  assert.equal(c.endHour, 18);
  assert.equal(c.endLabel, "18:00");
  assert.equal(c.minutesLeft, 480);
  assert.equal(c.plannedMinutes, 90);
  assert.equal(c.committedMinutes, 30);
  assert.equal(c.freeMinutes, 390);
  assert.equal(c.dayDone, false);
  assert.equal(c.over, false);
});

test("capacity falls back to DAY_END_HOUR", () => {
  const c = capacity([], TODAY, NOW, null);
  assert.equal(c.endHour, DAY_END_HOUR);
  assert.equal(c.minutesLeft, (DAY_END_HOUR - 10) * 60);
});

test("day done after end hour", () => {
  const late = new Date(2026, 10, 12, 18, 30);
  const c = capacity([mk()], TODAY, late, { wakingEndHour: 18 });
  assert.equal(c.dayDone, true);
  assert.equal(c.minutesLeft, 0);
  assert.equal(c.over, false);
  assert.equal(headline(1, c), "Day's done.");
});

test("over capacity states the fact", () => {
  const c = capacity([mk({ minutes: 300 })], TODAY, NOW, { wakingEndHour: 12 });
  assert.equal(c.over, true);
  assert.equal(c.freeMinutes, 0);
  assert.equal(headline(2, c), "Two tasks left, over by 3h before 12:00.");
});

test("headline wording", () => {
  const c = capacity([mk({ minutes: 60 })], TODAY, NOW, { wakingEndHour: 18 });
  assert.equal(headline(0, c), "Nothing left for today.");
  assert.equal(headline(1, c), "One task left, and 7h still free before 18:00.");
  assert.equal(headline(10, c), "Ten tasks left, and 7h still free before 18:00.");
  assert.equal(headline(11, c), "11 tasks left, and 7h still free before 18:00.");
});

test("plannedByDay and trackedByDay align, oldest first", () => {
  const tasks = [
    mk({ scheduled: "2026-11-12", minutes: 30 }),
    mk({ scheduled: "2026-11-12", minutes: 15, status: "done" }),
    mk({ scheduled: "2026-11-10", minutes: 60 }),
    mk({ scheduled: "2026-11-12", minutes: 99, status: "trashed" }),
    mk({ scheduled: null, minutes: 99 }),
  ];
  assert.deepEqual(plannedByDay(tasks, TODAY, 4), [0, 60, 0, 45]);
  const entries = [
    entry(new Date(2026, 10, 12, 9, 0), 20),
    entry(new Date(2026, 10, 12, 23, 30), 10),
    entry(new Date(2026, 10, 10, 9, 0), 5),
    entry(new Date(2026, 10, 11, 9, 0), undefined, false),
  ];
  assert.deepEqual(trackedByDay(entries, TODAY, 4), [0, 5, 0, 30]);
  assert.equal(plannedByDay(tasks, TODAY, 7).length, 7);
});

test("weekDays on a Sunday and a Monday", () => {
  const expected = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"];
  assert.deepEqual(weekDays("2026-11-15"), expected);
  assert.deepEqual(weekDays("2026-11-09"), expected);
  assert.deepEqual(weekDays("2026-11-12"), expected);
});

test("isPastWrap", () => {
  assert.equal(isPastWrap(new Date(2026, 10, 12, 16, 59), 17), false);
  assert.equal(isPastWrap(new Date(2026, 10, 12, 17, 0), 17), true);
});

test("isInbox is the one Inbox rule", () => {
  assert.equal(isInbox(mk({ scheduled: null }), TODAY), true);
  assert.equal(isInbox(mk({ scheduled: TODAY }), TODAY), false);
  assert.equal(isInbox(mk({ scheduled: null, status: "done" }), TODAY), false);
  assert.equal(isInbox(mk({ scheduled: null, startOn: LATER }), TODAY), false);
  assert.equal(isInbox(mk({ scheduled: null, startOn: TODAY }), TODAY), true);
});

test("inboxCount equals the number of isInbox tasks", () => {
  const tasks = [
    mk({ scheduled: null }),
    mk({ scheduled: null }),
    mk({ scheduled: TODAY }),
    mk({ scheduled: null, status: "done" }),
    mk({ scheduled: null, startOn: LATER }),
  ];
  assert.equal(inboxCount(tasks, TODAY), tasks.filter((t) => isInbox(t, TODAY)).length);
  assert.equal(inboxCount(tasks, TODAY), 2);
});
