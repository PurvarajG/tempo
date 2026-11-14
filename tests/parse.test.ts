import { test } from "node:test";
import assert from "node:assert/strict";
import { nextOccurrence, parseDateToken, parseQuickAdd } from "../lib/parse";

// Thursday 12 November 2026.
const NOW = new Date(2026, 10, 12, 9, 0);
const TODAY = "2026-11-12";
const p = (s: string, opts?: Parameters<typeof parseQuickAdd>[2]) => parseQuickAdd(s, NOW, opts);

test("no day token leaves scheduled undefined", () => {
  const r = p("call dentist");
  assert.equal(r.scheduled, undefined);
  assert.equal(r.title, "call dentist");
  assert.equal(r.minutes, 30);
});

test("nodate and inbox give null", () => {
  assert.equal(p("idea nodate").scheduled, null);
  assert.equal(p("idea inbox").scheduled, null);
  assert.equal(p("idea INBOX").title, "idea");
});

test("inbox is consumed wherever it appears", () => {
  const r = p("inbox zero");
  assert.equal(r.scheduled, null);
  assert.equal(r.title, "zero");
});

test("simple day tokens", () => {
  assert.equal(p("a today").scheduled, TODAY);
  assert.equal(p("a TOD").scheduled, TODAY);
  assert.equal(p("a tomorrow").scheduled, "2026-11-13");
  assert.equal(p("a tmrw").scheduled, "2026-11-13");
  assert.equal(p("a tom").scheduled, "2026-11-13");
  assert.equal(p("a thu").scheduled, "2026-11-19"); // never today
  assert.equal(p("a mon").scheduled, "2026-11-16");
  assert.equal(p("a monkey").scheduled, undefined);
  assert.equal(p("a monkey").title, "a monkey");
});

test("relative tokens", () => {
  assert.equal(p("a +3d").scheduled, "2026-11-15");
  assert.equal(p("a +2w").scheduled, "2026-11-26");
  assert.equal(p("a +1m").scheduled, "2026-12-12");
  assert.equal(p("a in 3d").scheduled, "2026-11-15");
  assert.equal(p("a in 2w").scheduled, "2026-11-26");
  assert.equal(p("a in 1m").scheduled, "2026-12-12");
  assert.equal(p("a in 3d").title, "a");
});

test("month and day forms", () => {
  assert.equal(p("a nov12").scheduled, "2026-11-12");
  assert.equal(p("a 12nov").scheduled, "2026-11-12");
  assert.equal(p("a nov 20").scheduled, "2026-11-20");
  assert.equal(p("a 20 nov").scheduled, "2026-11-20");
  assert.equal(p("a dec 3").title, "a");
  assert.equal(p("a dec 3").scheduled, "2026-12-03");
});

test("next-year wrap", () => {
  assert.equal(p("a jan 3").scheduled, "2027-01-03");
  assert.equal(p("a jan3").scheduled, "2027-01-03");
  assert.equal(p("a nov11").scheduled, "2027-11-11");
});

test("slash dates follow dateOrder", () => {
  assert.equal(p("a 11/12").scheduled, "2026-12-11");
  assert.equal(p("a 11/12", { dateOrder: "dmy" }).scheduled, "2026-12-11");
  assert.equal(p("a 11/12", { dateOrder: "mdy" }).scheduled, "2026-11-12");
});

test("ISO date", () => {
  assert.equal(p("a 2026-11-20").scheduled, "2026-11-20");
  assert.equal(p("a 2026-02-30").scheduled, undefined);
});

test("invalid dates stay in the title", () => {
  for (const bad of ["31/02", "nov31", "nov 31", "31 nov", "30/13"]) {
    const r = p(`a ${bad}`);
    assert.equal(r.scheduled, undefined, bad);
    assert.equal(r.title, `a ${bad}`, bad);
  }
});

test("next week, eow, wknd", () => {
  assert.equal(p("a next week").scheduled, "2026-11-16");
  assert.equal(p("a next week").title, "a");
  assert.equal(p("a nextweek").scheduled, "2026-11-16");
  assert.equal(p("a eow").scheduled, "2026-11-13");
  assert.equal(p("a wknd").scheduled, "2026-11-14");
  // today on the target day
  assert.equal(parseDateToken("eow", "2026-11-13"), "2026-11-13");
  assert.equal(parseDateToken("wknd", "2026-11-14"), "2026-11-14");
  assert.equal(parseDateToken("nextweek", "2026-11-16"), "2026-11-23");
});

test("11:12 is a time, not a date", () => {
  const r = p("a 11:12");
  assert.equal(r.dueTime, "11:12");
  assert.equal(r.scheduled, undefined);
});

test("from: and until:", () => {
  const r = p("a from:nov20 until:2026-12-01");
  assert.equal(r.startOn, "2026-11-20");
  assert.equal(r.expiresOn, "2026-12-01");
  assert.equal(r.title, "a");
  assert.equal(r.scheduled, undefined);
  assert.equal(p("a from:mon").startOn, "2026-11-16");
  assert.equal(p("a from:bogus").title, "a from:bogus");
});

test("reminder lead time does not collide with estimate", () => {
  const r = p("a !10m 30m");
  assert.equal(r.reminderMinutes, 10);
  assert.equal(r.minutes, 30);
  assert.equal(p("a !1h").reminderMinutes, 60);
  assert.equal(p("a 30m").reminderMinutes, undefined);
});

test("lone * commits", () => {
  assert.equal(p("a *").commit, true);
  assert.equal(p("a *").title, "a");
  assert.equal(p("a b*").commit, undefined);
});

test("recurrence tokens, TK-063 and TK-065 still parse", () => {
  const r = p("call dentist thu 30m p1 3pm weekly #health @calls");
  assert.deepEqual(r.recurrence, { freq: "weekly", interval: 1 });
  assert.equal(r.projectName, "health");
  assert.deepEqual(r.tags, ["calls"]);
  assert.equal(r.priority, 1);
  assert.equal(r.dueTime, "15:00");
  assert.equal(r.scheduled, "2026-11-19");
  assert.deepEqual(p("a every2w").recurrence, { freq: "weekly", interval: 2 });
});

test("weekly! and when done mean from done", () => {
  assert.deepEqual(p("a weekly!").recurrence, { freq: "weekly", interval: 1, from: "done" });
  assert.deepEqual(p("a every2w!").recurrence, { freq: "weekly", interval: 2, from: "done" });
  const r = p("water plants weekly when done");
  assert.deepEqual(r.recurrence, { freq: "weekly", interval: 1, from: "done" });
  assert.equal(r.title, "water plants");
  assert.equal(p("a weekly when").title, "a when");
  assert.equal(p("a bogus!").title, "a bogus!");
});

test("nextOccurrence rolls forward past today", () => {
  // Weekly from 1 Oct, finished 9 Nov: lands on or after 10 Nov, on the weekly grid.
  const n = nextOccurrence("2026-10-01", { freq: "weekly", interval: 1 }, "2026-11-09");
  assert.equal(n, "2026-11-12");
  assert.ok(n >= "2026-11-10");
  // Always at least one step, even when scheduled is in the future.
  assert.equal(nextOccurrence("2026-11-20", { freq: "weekly", interval: 1 }, "2026-11-09"), "2026-11-27");
  // Strictly after today.
  assert.equal(nextOccurrence("2026-11-05", { freq: "weekly", interval: 1 }, "2026-11-12"), "2026-11-19");
});

test("nextOccurrence from done counts from today", () => {
  const r = { freq: "weekly", interval: 2, from: "done" } as const;
  assert.equal(nextOccurrence("2026-10-01", r, "2026-11-09"), "2026-11-23");
  assert.equal(nextOccurrence("2026-10-01", { ...r, freq: "daily", interval: 3 }, "2026-11-09"), "2026-11-12");
  assert.equal(nextOccurrence("2026-10-01", { ...r, freq: "monthly", interval: 1 }, "2026-01-31"), "2026-02-28");
});

test("nextOccurrence daily and monthly roll-forward", () => {
  assert.equal(nextOccurrence("2026-11-01", { freq: "daily", interval: 1 }, "2026-11-09"), "2026-11-10");
  assert.equal(nextOccurrence("2026-11-01", { freq: "daily", interval: 3 }, "2026-11-09"), "2026-11-10");
  assert.equal(nextOccurrence("2026-01-15", { freq: "monthly", interval: 1 }, "2026-01-15"), "2026-02-15");
  assert.equal(nextOccurrence("2026-01-15", { freq: "monthly", interval: 1 }, "2026-04-20"), "2026-05-15");
  // Clamped, and each step is computed from the original day-of-month.
  assert.equal(nextOccurrence("2026-01-31", { freq: "monthly", interval: 1 }, "2026-01-31"), "2026-02-28");
  assert.equal(nextOccurrence("2026-01-31", { freq: "monthly", interval: 1 }, "2026-03-01"), "2026-03-31");
  assert.equal(nextOccurrence("2028-01-31", { freq: "monthly", interval: 1 }, "2028-02-01"), "2028-02-29");
});
