import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addDays, toISODate } from "../lib/parse";
import type { Task, TimeEntry } from "../lib/types";
import {
  QUIET_AFTER_DAYS,
  calmLine,
  doneOn,
  estimateMisses,
  focusedMinutes,
  goneQuiet,
  isResetDay,
  lastTouched,
  tomorrowTasks,
  weekNumbers,
} from "../lib/wrap";

const TODAY = toISODate(new Date());
const TOMORROW = addDays(TODAY, 1);

/** Local noon on an ISO day, as an ISO timestamp. */
function at(dayISO: string, h = 12, m = 0): string {
  const [y, mo, d] = dayISO.split("-").map(Number);
  return new Date(y, mo - 1, d, h, m).toISOString();
}

let seq = 0;
function mk(over: Partial<Task> = {}): Task {
  seq += 1;
  return {
    id: `t${seq}`,
    title: `Task ${String(seq).padStart(3, "0")}`,
    boardOrder: 0,
    tags: [],
    scheduled: TODAY,
    minutes: 30,
    priority: 0,
    status: "open",
    isComplex: false,
    sortOrder: seq,
    createdAt: at(addDays(TODAY, -1)),
    subtasks: [],
    ...over,
  } as Task;
}

function ent(taskId: string, dayISO: string, minutes?: number, h = 9): TimeEntry {
  const startedAt = at(dayISO, h);
  return {
    id: `e${++seq}`,
    taskId,
    categoryId: "c1",
    startedAt,
    endedAt: minutes === undefined ? undefined : at(dayISO, h, minutes),
    minutes,
    createdAt: startedAt,
    updatedAt: startedAt,
  };
}

describe("doneOn", () => {
  it("returns tasks completed that day, oldest first", () => {
    const late = mk({ status: "done", completedAt: at(TODAY, 17) });
    const early = mk({ status: "done", completedAt: at(TODAY, 9) });
    const other = mk({ status: "done", completedAt: at(addDays(TODAY, -1)) });
    const open = mk({ completedAt: at(TODAY, 10) });
    assert.deepEqual(doneOn([late, other, open, early], TODAY).map((t) => t.id), [early.id, late.id]);
  });
});

describe("focusedMinutes", () => {
  it("sums stopped entries started that day", () => {
    const es = [ent("a", TODAY, 25), ent("a", TODAY, 15), ent("a", addDays(TODAY, -1), 60)];
    assert.equal(focusedMinutes(es, TODAY), 40);
  });
  it("counts the running entry only when it started that day", () => {
    const now = new Date(at(TODAY, 12, 30));
    const runToday = ent("a", TODAY, undefined, 12);
    assert.equal(focusedMinutes([], TODAY, runToday, now), 30);
    const runYesterday = ent("a", addDays(TODAY, -1), undefined, 12);
    assert.equal(focusedMinutes([], TODAY, runYesterday, now), 0);
    assert.equal(focusedMinutes([], TODAY, runToday), 0);
  });
});

describe("calmLine", () => {
  it("covers all five forms", () => {
    assert.equal(calmLine(6, 220), "6 done, 3h 40m focused.");
    assert.equal(calmLine(1, 45), "1 done, 45m focused.");
    assert.equal(calmLine(3, 0), "3 done.");
    assert.equal(calmLine(0, 45), "45m focused, nothing marked done.");
    assert.equal(calmLine(0, 0), "Nothing marked done today.");
  });
});

describe("estimateMisses", () => {
  it("sorts by absolute size, keeps under-estimates, drops zero, limits to 3", () => {
    const a = mk({ minutes: 30, status: "done", completedAt: at(TODAY) });
    const b = mk({ minutes: 120, status: "done", completedAt: at(TODAY) });
    const c = mk({ minutes: 30, status: "done", completedAt: at(TODAY) });
    const d = mk({ minutes: 60, status: "done", completedAt: at(TODAY) });
    const e = mk({ minutes: 30, status: "done", completedAt: at(TODAY) });
    const es = [
      ent(a.id, TODAY, 40), // +10
      ent(b.id, TODAY, 60), // -60
      ent(c.id, TODAY, 30), // 0, dropped
      ent(d.id, TODAY, 100), // +40
      ent(e.id, TODAY, 35), // +5
    ];
    const r = estimateMisses([a, b, c, d, e], es, TODAY);
    assert.deepEqual(r.map((m) => m.over), [-60, 40, 10]);
    assert.equal(r[0].planned, 120);
    assert.equal(r[0].actual, 60);
    assert.equal(estimateMisses([a, b, c, d, e], es, TODAY, 5).length, 4);
  });
  it("uses all of a task's stopped entries and includes undone tasks tracked today", () => {
    const t = mk({ minutes: 30 });
    const es = [ent(t.id, TODAY, 20), ent(t.id, addDays(TODAY, -2), 30)];
    const r = estimateMisses([t], es, TODAY);
    assert.equal(r[0].actual, 50);
    assert.equal(r[0].over, 20);
  });
  it("skips tasks with no estimate or no tracked time", () => {
    const noEst = mk({ minutes: 0, status: "done", completedAt: at(TODAY) });
    const noTime = mk({ status: "done", completedAt: at(TODAY) });
    assert.deepEqual(estimateMisses([noEst, noTime], [ent(noEst.id, TODAY, 20)], TODAY), []);
  });
});

describe("tomorrowTasks", () => {
  it("splits planned and carried, excluding done, trashed, inbox and hidden", () => {
    const plan = mk({ scheduled: TOMORROW });
    const carryToday = mk({ scheduled: TODAY });
    const carryOld = mk({ scheduled: addDays(TODAY, -3) });
    const done = mk({ scheduled: TOMORROW, status: "done" });
    const trashed = mk({ scheduled: TODAY, status: "trashed" });
    const inbox = mk({ scheduled: null });
    const hidden = mk({ scheduled: TOMORROW, startOn: addDays(TODAY, 3) });
    const hiddenCarry = mk({ scheduled: TODAY, startOn: addDays(TODAY, 3) });
    const startsTomorrow = mk({ scheduled: TOMORROW, startOn: TOMORROW });
    const span = mk({
      scheduled: addDays(TODAY, -1),
      isComplex: true,
      finishDate: addDays(TODAY, 4),
    });
    const spanEnds = mk({ scheduled: addDays(TODAY, -2), isComplex: true, finishDate: TODAY });
    const future = mk({ scheduled: addDays(TODAY, 5) });
    const r = tomorrowTasks(
      [plan, carryToday, carryOld, done, trashed, inbox, hidden, hiddenCarry, startsTomorrow, span, spanEnds, future],
      TODAY,
    );
    assert.deepEqual(r.planned.map((t) => t.id).sort(), [plan.id, startsTomorrow.id].sort());
    assert.deepEqual(r.carried.map((t) => t.id).sort(), [carryToday.id, carryOld.id, spanEnds.id].sort());
    const all = [...r.planned, ...r.carried].map((t) => t.id);
    assert.equal(new Set(all).size, all.length);
  });
  it("sorts by rank then sortOrder", () => {
    const low = mk({ scheduled: TOMORROW, priority: 3, sortOrder: 1 });
    const none = mk({ scheduled: TOMORROW, priority: 0, sortOrder: 0 });
    const high = mk({ scheduled: TOMORROW, priority: 1, sortOrder: 9 });
    const r = tomorrowTasks([none, low, high], TODAY);
    assert.deepEqual(r.planned.map((t) => t.id), [high.id, low.id, none.id]);
  });
});

describe("isResetDay", () => {
  it("matches the weekday, 0 Sunday to 6 Saturday", () => {
    assert.equal(isResetDay("2026-11-15", 0), true); // Sunday
    assert.equal(isResetDay("2026-11-15", 6), false);
    assert.equal(isResetDay("2026-11-14", 6), true); // Saturday
    assert.equal(isResetDay("2026-11-14", 0), false);
  });
});

describe("lastTouched", () => {
  it("is the latest of created, stage, completed and entries", () => {
    const t = mk({
      createdAt: at(addDays(TODAY, -30)),
      stageEnteredAt: at(addDays(TODAY, -20)),
    });
    assert.equal(lastTouched(t, []), addDays(TODAY, -20));
    const e = ent(t.id, addDays(TODAY, -5), 10);
    assert.equal(lastTouched(t, [e, ent("other", TODAY, 5)]), addDays(TODAY, -5));
    const done = mk({ createdAt: at(addDays(TODAY, -30)), completedAt: at(addDays(TODAY, -2)) });
    assert.equal(lastTouched(done, []), addDays(TODAY, -2));
  });
});

describe("goneQuiet", () => {
  it("uses a 14 day threshold: 13 stays, 14 goes", () => {
    assert.equal(QUIET_AFTER_DAYS, 14);
    const thirteen = mk({ createdAt: at(addDays(TODAY, -13)) });
    const fourteen = mk({ createdAt: at(addDays(TODAY, -14)) });
    const older = mk({ createdAt: at(addDays(TODAY, -40)), scheduled: null });
    const r = goneQuiet([thirteen, fourteen, older], [], TODAY);
    assert.deepEqual(r.map((t) => t.id), [older.id, fourteen.id]);
  });
  it("is rescued by a recent time entry, and skips done and hidden tasks", () => {
    const old = mk({ createdAt: at(addDays(TODAY, -40)) });
    const done = mk({ createdAt: at(addDays(TODAY, -40)), status: "done" });
    const hidden = mk({ createdAt: at(addDays(TODAY, -40)), startOn: addDays(TODAY, 2) });
    assert.deepEqual(goneQuiet([old, done, hidden], [ent(old.id, addDays(TODAY, -3), 10)], TODAY), []);
    assert.equal(goneQuiet([old], [], TODAY, 60).length, 0);
  });
});

describe("weekNumbers", () => {
  it("counts the 7 day window and averages accuracy", () => {
    const a = mk({ minutes: 60, status: "done", completedAt: at(addDays(TODAY, -6)) });
    const b = mk({ minutes: 30, status: "done", completedAt: at(TODAY) });
    const outside = mk({ status: "done", completedAt: at(addDays(TODAY, -7)) });
    const es = [
      ent(a.id, addDays(TODAY, -6), 30), // 50%
      ent(b.id, TODAY, 30), // 100%
      ent(outside.id, addDays(TODAY, -7), 99),
    ];
    const r = weekNumbers([a, b, outside], es, TODAY);
    assert.deepEqual(r, { done: 2, focusedMinutes: 60, accuracy: 75 });
  });
  it("has null accuracy with no data", () => {
    assert.deepEqual(weekNumbers([], [], TODAY), { done: 0, focusedMinutes: 0, accuracy: null });
  });
});
