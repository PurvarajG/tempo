import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { fmt, fmtClock, fmtCountdown, fmtDate, fmtDay, fmtDayLong, fmtHours, fmtMonthYear, MONTHS_LONG, fmtRange, fmtRepeat, fmtTime, fmtWeekday, PRIORITY_NAME } from "../lib/format";

test("durations under a day read the way they always did", () => {
  assert.equal(fmt(0), "0m");
  assert.equal(fmt(45), "45m");
  assert.equal(fmt(60), "1h");
  assert.equal(fmt(150), "2h 30m");
  assert.equal(fmt(1439), "23h 59m");
});

test("past a day it rolls over instead of printing raw hours", () => {
  assert.equal(fmt(1440), "1d");
  assert.equal(fmt(1500), "1d 1h");
  assert.equal(fmt(4320), "3d", "matches what `3d` means to quick-add");
  assert.equal(fmt(60 * 24 * 30), "30d", "a month-long miniproject");
});

test("only the two most significant units survive", () => {
  assert.equal(fmt(1501), "1d 1h", "the stray minute is dropped, not shown as 1d 1h 1m");
  assert.equal(fmt(1441), "1d 1m", "with no whole hour, minutes are still the second unit");
});

test("fmtDate reads weekday, day, month", () => {
  assert.equal(fmtDate("2026-11-12"), "Thu 12 Nov");
  assert.equal(fmtDate("2026-11-12", "2026-01-01"), "Thu 12 Nov");
});

test("fmtDate shows the year, no weekday, when it differs from today", () => {
  assert.equal(fmtDate("2026-11-12", "2027-01-02"), "12 Nov 2026");
});

test("fmtDate never shifts a day", () => {
  assert.equal(fmtDate("2026-03-01"), "Sun 1 Mar");
  assert.equal(fmtDate("2026-02-28"), "Sat 28 Feb");
});

test("fmtDay", () => {
  assert.equal(fmtDay("2026-11-14"), "14 Nov");
  assert.equal(fmtDay("2026-03-01"), "1 Mar");
});

test("fmtDayLong spells the month out", () => {
  assert.equal(fmtDayLong("2026-11-12"), "12 November");
  assert.equal(fmtDayLong("2026-01-01"), "1 January");
  assert.equal(fmtDayLong("2026-12-31"), "31 December");
});

test("fmtMonthYear", () => {
  assert.equal(fmtMonthYear("2026-11-12"), "November 2026");
  assert.equal(fmtMonthYear("2026-01-01"), "January 2026");
  assert.equal(fmtMonthYear("2026-12-31"), "December 2026");
  assert.equal(MONTHS_LONG.length, 12);
});

test("fmtRepeat", () => {
  assert.equal(fmtRepeat({ freq: "daily", interval: 1 }), "Daily");
  assert.equal(fmtRepeat({ freq: "weekly", interval: 1 }), "Weekly");
  assert.equal(fmtRepeat({ freq: "monthly", interval: 1 }), "Monthly");
  assert.equal(fmtRepeat({ freq: "daily", interval: 2 }), "Every 2 days");
  assert.equal(fmtRepeat({ freq: "weekly", interval: 2 }), "Every 2 weeks");
  assert.equal(fmtRepeat({ freq: "monthly", interval: 3 }), "Every 3 months");
  assert.equal(fmtRepeat({ freq: "weekly", interval: 1, from: "done" }), "Weekly, when done");
  assert.equal(fmtRepeat({ freq: "daily", interval: 2, from: "schedule" }), "Every 2 days");
});

test("PRIORITY_NAME is indexed by priority", () => {
  assert.deepEqual([...PRIORITY_NAME], ["None", "High", "Medium", "Low"]);
});

test("fmtWeekday gives long and short English names", () => {
  assert.equal(fmtWeekday("2026-11-18"), "Wednesday");
  assert.equal(fmtWeekday("2026-11-18", "short"), "Wed");
  assert.equal(fmtWeekday("2026-11-15"), "Sunday");
});

test("fmtRange collapses the shared month and year", () => {
  assert.equal(fmtRange("2026-11-13", "2026-11-19"), "13 to 19 Nov");
  assert.equal(fmtRange("2026-11-28", "2026-12-04"), "28 Nov to 4 Dec");
  assert.equal(fmtRange("2026-12-28", "2027-01-03"), "28 Dec 2026 to 3 Jan 2027");
});

test("fmtTime is 24-hour and zero-padded", () => {
  assert.equal(fmtTime("15:30"), "15:30");
  assert.equal(fmtTime("9:5"), "09:05");
  assert.equal(fmtTime("6:00"), "06:00");
  assert.equal(fmtTime("17:00"), "17:00");
});

test("fmtTime does not wrap 24:00", () => {
  assert.equal(fmtTime("24:00"), "24:00");
});

test("fmtClock formats a local Date", () => {
  assert.equal(fmtClock(new Date(2026, 10, 12, 14, 30)), "14:30");
  assert.equal(fmtClock(new Date(2026, 10, 12, 9, 5)), "09:05");
});

describe("fmtHours", () => {
  const cases: [number, string][] = [
    [0, "0m"],
    [45, "45m"],
    [60, "1h"],
    [105, "1h 45m"],
    [600, "10h"],
    [1500, "25h"],
    [2915, "48h 35m"],
    [3720, "62h"],
  ];
  for (const [mins, out] of cases) {
    test(`${mins} -> ${out}`, () => assert.equal(fmtHours(mins), out));
  }
  test("rounds non-integer input", () => assert.equal(fmtHours(44.6), "45m"));
  test("does not throw on negative input", () => assert.doesNotThrow(() => fmtHours(-5)));
});

describe("fmtCountdown", () => {
  const cases: [number, string][] = [
    [0, "00:00"],
    [-5000, "00:00"],
    [5000, "00:05"],
    [59_001, "01:00"],
    [(24 * 60 + 59) * 1000, "24:59"],
    [3_599_000, "59:59"],
    [3_600_000, "1:00:00"],
    [3_900_000, "1:05:00"],
  ];
  for (const [ms, out] of cases) {
    test(`${ms} -> ${out}`, () => assert.equal(fmtCountdown(ms), out));
  }
});
