import assert from "node:assert/strict";
import test from "node:test";
import { dayRange, isoWeekNumber, mondayOfWeek, monthGrid, monthLabel, shift, viewLabel, viewTitle, weekGrid, WEEKDAY_LABELS } from "../lib/calendar";

test("a month grid is whole Monday-first weeks, only as many as the month needs", () => {
  for (const [year, month, rows] of [
    [2026, 1, 5],
    [2026, 7, 6],
    [2024, 1, 5],
    [2027, 1, 4],
  ]) {
    const days = monthGrid(year, month);
    assert.equal(days.length, rows * 7);
    assert.equal(days.length % 7, 0);
    assert.equal(new Date(`${days[0].iso}T00:00:00`).getDay(), 1, "first cell is a Monday");
  }
});

test("the grid borrows the adjacent months", () => {
  // March 2026 starts on a Sunday, so the Monday-first grid opens on Mon 23 Feb.
  const march = monthGrid(2026, 2);
  assert.equal(march[0].iso, "2026-02-23");
  assert.equal(march[0].inMonth, false);
  assert.equal(march[6].iso, "2026-03-01");
  assert.equal(march[6].inMonth, true);
  assert.equal(march[march.length - 1].inMonth, false);

  // August 2026 starts on a Saturday: Mon 27 Jul first, 6 rows.
  const august = monthGrid(2026, 7);
  assert.equal(august.length, 42);
  assert.equal(august[0].iso, "2026-07-27");
  assert.equal(august[0].inMonth, false);
  assert.equal(august[5].iso, "2026-08-01");
  assert.equal(august[5].inMonth, true);
});

test("February 2027 starts on a Monday and is exactly four rows", () => {
  const feb = monthGrid(2027, 1);
  assert.equal(feb.length, 28);
  assert.equal(feb[0].iso, "2027-02-01");
  assert.equal(feb[27].iso, "2027-02-28");
  assert.ok(feb.every((d) => d.inMonth));
});

test("weekday labels run Monday to Sunday", () => {
  assert.deepEqual(WEEKDAY_LABELS, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
});

test("weekends are identified for every row", () => {
  const days = monthGrid(2026, 2);
  assert.deepEqual(
    days.slice(0, 7).map((d) => d.isWeekend),
    [false, false, false, false, false, true, true],
  );
});

test("February gets its leap day only in a leap year", () => {
  assert.ok(monthGrid(2024, 1).some((d) => d.iso === "2024-02-29" && d.inMonth));
  assert.ok(!monthGrid(2026, 1).some((d) => d.iso === "2026-02-29" && d.inMonth));
});

test("month arithmetic preserves the day-of-month, clamped when the target month is shorter", () => {
  assert.equal(shift("month", "2026-01-15", -1), "2025-12-15");
  assert.equal(shift("month", "2026-12-15", 1), "2027-01-15");
  // January 31st + 1 month must clamp into February, not spill into March.
  assert.equal(shift("month", "2026-01-31", 1), "2026-02-28", "2026 is not a leap year");
  assert.equal(shift("month", "2024-01-31", 1), "2024-02-29", "2024 is a leap year");
  // December 31st - 1 month must clamp into November, not spill into October.
  assert.equal(shift("month", "2026-12-31", -1), "2026-11-30");
});

test("day and week arithmetic step by the active view", () => {
  assert.equal(shift("day", "2026-03-01", 1), "2026-03-02");
  assert.equal(shift("day", "2026-03-01", -1), "2026-02-28");
  assert.equal(shift("week", "2026-03-01", 1), "2026-03-08");
  assert.equal(shift("week", "2026-03-01", -1), "2026-02-22");
});

test("the month label names both month and year", () => {
  assert.equal(monthLabel(2026, 2), "March 2026");
});

test("weekGrid returns the Monday-first week containing the anchor", () => {
  // 2026-03-11 is a Wednesday; the week runs Mon 2026-03-09 to Sun 2026-03-15.
  const week = weekGrid("2026-03-11");
  assert.equal(week.length, 7);
  assert.equal(week[0].iso, "2026-03-09");
  assert.equal(week[6].iso, "2026-03-15");
  assert.deepEqual(
    week.map((d) => d.isWeekend),
    [false, false, false, false, false, true, true],
  );
  assert.ok(week.every((d) => d.inMonth), "week rows are never dimmed as out-of-month");
});

test("weekGrid puts a Sunday in the week that began six days earlier, and a Monday first", () => {
  const sunday = weekGrid("2026-03-15");
  assert.equal(sunday[0].iso, "2026-03-09");
  assert.equal(sunday[6].iso, "2026-03-15");
  const monday = weekGrid("2026-03-09");
  assert.equal(monday[0].iso, "2026-03-09");
  assert.equal(monday[6].iso, "2026-03-15");
});

test("weekGrid crosses a month boundary without losing a day", () => {
  const week = weekGrid("2026-07-29");
  assert.equal(week[0].iso, "2026-07-27");
  assert.equal(week[6].iso, "2026-08-02");

  const week2 = weekGrid("2026-03-02");
  assert.equal(week2[0].iso, "2026-03-02");
  assert.equal(week2[6].iso, "2026-03-08");
});

test("isoWeekNumber follows ISO 8601", () => {
  assert.equal(isoWeekNumber("2026-11-12"), 46);
  assert.equal(isoWeekNumber("2027-01-01"), 53);
  assert.equal(isoWeekNumber("2026-12-28"), 53);
  assert.equal(isoWeekNumber("2027-01-04"), 1);
  assert.equal(isoWeekNumber("2024-12-30"), 1);
});

test("viewTitle splits the H1 into a title and a dim year", () => {
  assert.deepEqual(viewTitle("month", "2026-11-12"), { title: "November", dim: "2026" });
  assert.deepEqual(viewTitle("day", "2026-03-11"), { title: "March", dim: "2026" });
  assert.deepEqual(viewTitle("week", "2026-11-12"), { title: "November", dim: "2026" });
  // Week of Mon 26 Oct to Sun 1 Nov.
  assert.deepEqual(viewTitle("week", "2026-10-28"), { title: "October to November", dim: "2026" });
  // Week of Mon 28 Dec 2026 to Sun 3 Jan 2027.
  assert.deepEqual(viewTitle("week", "2026-12-30"), { title: "December to January", dim: "2026 to 2027" });
});

test("dayRange returns exactly the one requested day", () => {
  const [day] = dayRange("2026-03-11");
  assert.equal(day.iso, "2026-03-11");
  assert.equal(day.dayOfMonth, 11);
  assert.equal(day.isWeekend, false);
  assert.equal(day.inMonth, true);

  const [sunday] = dayRange("2026-03-08");
  assert.equal(sunday.isWeekend, true);
});

test("viewLabel names the day, the week's range, and the month, per view", () => {
  assert.equal(viewLabel("day", "2026-03-11"), "Wednesday 11 March 2026");
  assert.equal(viewLabel("week", "2026-03-11"), "9 to 15 Mar");
  // Mon 2026-07-27 to Sun 2026-08-02 spans July into August.
  assert.equal(viewLabel("week", "2026-07-29"), "27 Jul to 2 Aug");
  assert.equal(viewLabel("month", "2026-03-11"), "March 2026");
});


test("mondayOfWeek returns the Monday of the Monday-first week", () => {
  assert.equal(mondayOfWeek("2026-03-02"), "2026-03-02");
  assert.equal(mondayOfWeek("2026-03-04"), "2026-03-02");
  assert.equal(mondayOfWeek("2026-03-08"), "2026-03-02");
  assert.equal(mondayOfWeek("2026-01-01"), "2025-12-29");
});
