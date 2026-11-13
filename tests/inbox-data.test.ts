import assert from "node:assert/strict";
import test from "node:test";
import {
  ageDays, ageLabel, freeThisWeek, groupInbox, inboxHeadline, inboxStats, inboxTasks,
} from "../components/inbox/inbox-data";
import { addDays, toISODate } from "../lib/parse";
import type { Task, TrackingSettings } from "../lib/types";

const today = toISODate(new Date());
const at = (daysAgo: number) => {
  const [y, m, d] = addDays(today, -daysAgo).split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
};

let n = 0;
function task(p: Partial<Task> & { ago?: number }): Task {
  const { ago = 0, ...rest } = p;
  n += 1;
  return {
    id: `t${n}`, title: `T${n}`, boardOrder: 0, tags: [], scheduled: null, minutes: 30,
    priority: 3, status: "open", isComplex: false, sortOrder: n, createdAt: at(ago), subtasks: [],
    ...rest,
  } as unknown as Task;
}

const settings = (start: number, end: number) =>
  ({ wakingStartHour: start, wakingEndHour: end }) as unknown as TrackingSettings;

test("sort both ways, ties keep store order", () => {
  const a = task({ ago: 2 }), b = task({ ago: 5 }), c = task({ ago: 2 }), sched = task({ scheduled: today });
  assert.deepEqual(inboxTasks([a, b, c, sched], today, "oldest").map((t) => t.id), [b.id, a.id, c.id]);
  assert.deepEqual(inboxTasks([a, b, c, sched], today, "newest").map((t) => t.id), [a.id, c.id, b.id]);
});

test("age and labels", () => {
  assert.equal(ageLabel(task({ ago: 0 }), today), "Added today");
  assert.equal(ageLabel(task({ ago: 1 }), today), "Added yesterday");
  assert.equal(ageLabel(task({ ago: 4 }), today), "Added 4 days ago");
  assert.equal(ageDays(task({ ago: -3 }), today), 0);
});

test("groupInbox splits at 7 days and keeps order", () => {
  const old = task({ ago: 7, minutes: 20 }), young = task({ ago: 6, minutes: 10 }), young2 = task({ ago: 1, minutes: 5 });
  const g = groupInbox([old, young, young2], today);
  assert.deepEqual(g.map((x) => x.key), ["older", "week"]);
  assert.equal(g[0].label, "Older than a week");
  assert.equal(g[1].minutes, 15);
  const r = groupInbox([young2, young, old], today);
  assert.deepEqual(r.map((x) => x.key), ["week", "older"]);
  assert.deepEqual(groupInbox([young], today).map((x) => x.key), ["week"]);
  assert.deepEqual(groupInbox([], today), []);
});

test("inboxStats", () => {
  const tasks = [
    task({ ago: 12, minutes: 0 }),
    task({ ago: 0, minutes: 30 }),
    task({ ago: 3, minutes: 45 }),
    task({ ago: 2, startOn: addDays(today, 3) }),
    task({ ago: 9, status: "done", completedAt: at(0) }),
    task({ ago: 9, status: "done", completedAt: at(3) }),
    task({ ago: 9, status: "done", completedAt: at(9) }),
    task({ ago: 1, scheduled: today }),
  ];
  const s = inboxStats(tasks, today);
  assert.equal(s.count, 3);
  assert.equal(s.addedThisWeek, 2);
  assert.equal(s.oldestDays, 12);
  assert.equal(s.oldestSince, addDays(today, -12));
  assert.equal(s.estimatedMinutes, 75);
  assert.equal(s.noEstimate, 1);
  assert.equal(s.clearedToday, 1);
  assert.equal(s.clearedThisWeek, 2);
  assert.equal(s.addedByDay.length, 12);
  assert.equal(s.addedByDay[11], 1);
  assert.equal(s.minutesByDay[11], 30);
  assert.equal(s.clearedByDay[11], 1);
  assert.equal(s.clearedByDay[8], 1);
});

test("inboxHeadline", () => {
  assert.equal(inboxHeadline(inboxStats([], today)), "Nothing waiting for a day.");
  assert.equal(inboxHeadline(inboxStats([task({ ago: 0 })], today)), "1 task with no day yet. The oldest came in today.");
  assert.equal(inboxHeadline(inboxStats([task({ ago: 1 })], today)), "1 task with no day yet. The oldest has waited 1 day.");
  assert.equal(
    inboxHeadline(inboxStats([task({ ago: 12 }), task({ ago: 0 })], today)),
    "2 tasks with no day yet. The oldest has waited 12 days.",
  );
});

const [ty, tm, td] = today.split("-").map(Number);
const noon = new Date(ty, tm - 1, td, 12, 0, 0, 0);
const early = new Date(ty, tm - 1, td, 8, 0, 0, 0);

test("freeThisWeek provisional with no settings or empty waking day", () => {
  const want = { slots: [], totalMinutes: 0, provisional: true };
  assert.deepEqual(freeThisWeek([], [task({})], today, early, null), want);
  assert.deepEqual(freeThisWeek([], [task({})], today, early, settings(9, 9)), want);
});

test("freeThisWeek keeps the longest window per day, today from now, later days from waking start", () => {
  // waking 8 to 18; today at 12:00 has 12:00-18:00 free
  const split = task({ scheduled: addDays(today, 1), dueTime: "10:00", minutes: 60 });
  const r = freeThisWeek([split], [], today, noon, settings(8, 18));
  assert.equal(r.slots[0].date, today);
  assert.deepEqual([r.slots[0].start, r.slots[0].end, r.slots[0].minutes], ["12:00", "18:00", 360]);
  // tomorrow: 08:00-10:00 (120) and 11:00-18:00 (420), longest kept
  assert.equal(r.slots[1].date, addDays(today, 1));
  assert.deepEqual([r.slots[1].start, r.slots[1].end, r.slots[1].minutes], ["11:00", "18:00", 420]);
  assert.equal(r.slots[2].date, addDays(today, 2));
  assert.equal(r.slots[2].start, "08:00");
  assert.equal(r.slots[2].minutes, 600);
});

test("freeThisWeek today rounds up like dayPlan and drops days without free time", () => {
  const late = new Date(ty, tm - 1, td, 17, 53, 0, 0);
  const r = freeThisWeek([], [], today, late, settings(8, 18));
  assert.equal(r.slots[0].date, addDays(today, 1), "17:55 to 18:00 is under 15 minutes");
  const full = task({ scheduled: addDays(today, 1), minutes: 600 });
  const r2 = freeThisWeek([full], [], today, late, settings(8, 18));
  assert.equal(r2.slots[0].date, addDays(today, 2));
  const r3 = freeThisWeek([], [], today, new Date(ty, tm - 1, td, 17, 50, 1, 0), settings(8, 18));
  assert.equal(r3.slots[0].date, addDays(today, 1), "17:50:01 rounds up to 17:55");
  const r4 = freeThisWeek([], [], today, new Date(ty, tm - 1, td, 17, 40, 0, 0), settings(8, 18));
  assert.deepEqual([r4.slots[0].start, r4.slots[0].end, r4.slots[0].minutes], ["17:40", "18:00", 20]);
});

test("freeThisWeek shows at most 3 slots in date order, total is their sum", () => {
  const r = freeThisWeek([], [], today, early, settings(8, 18));
  assert.deepEqual(r.slots.map((s) => s.date), [today, addDays(today, 1), addDays(today, 2)]);
  assert.equal(r.totalMinutes, 600 * 3);
  assert.equal(r.totalMinutes, r.slots.reduce((n, s) => n + s.minutes, 0));
});

test("freeThisWeek fits: first unused inbox task that fits, zero never, no reuse", () => {
  const a = task({ minutes: 50 }), b = task({ minutes: 90 }), zero = task({ minutes: 0 }), big = task({ minutes: 900 });
  const busy = [
    task({ scheduled: today, minutes: 360 }),
    task({ scheduled: addDays(today, 1), minutes: 540 }),
  ];
  // today from 08:00: 08:00-... packs 360 then free 14:00-18:00 (240); tomorrow free 60; day after 600
  const r = freeThisWeek(busy, [zero, big, a, b], today, early, settings(8, 18));
  assert.deepEqual(r.slots.map((s) => s.minutes), [240, 60, 600]);
  assert.equal(r.slots[0].fits?.id, a.id);
  assert.equal(r.slots[1].fits, null, "a is used, b is too long for 60");
  assert.equal(r.slots[2].fits?.id, b.id);
  assert.equal(r.totalMinutes, 900);
});
