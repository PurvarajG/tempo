import { addDays, toISODate } from "./parse";
import { fmtDayLong, fmtMonthYear, fmtRange, fmtWeekday, MONTHS_LONG } from "./format";

export type CalendarDay = {
  iso: string;
  dayOfMonth: number;
  /** False for the leading/trailing days borrowed from the adjacent months. */
  inMonth: boolean;
  isWeekend: boolean;
};

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m - 1, d];
}

function mondayOffset(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** The ISO date of the Monday of the Monday-to-Sunday week containing `iso`. */
export function mondayOfWeek(iso: string): string {
  const [y, m, d] = parts(iso);
  return addDays(iso, -mondayOffset(new Date(y, m, d)));
}

function toDay(iso: string, inMonth: boolean): CalendarDay {
  const [y, m, d] = parts(iso);
  const dow = new Date(y, m, d).getDay();
  return { iso, dayOfMonth: d, inMonth, isWeekend: dow === 0 || dow === 6 };
}

/**
 * A month as whole Monday-first weeks, including the adjacent-month days that
 * fill the first and last rows. Only the rows the month needs: 28, 35 or 42 days.
 */
export function monthGrid(year: number, month: number): CalendarDay[] {
  const first = new Date(year, month, 1);
  const lead = mondayOffset(first);
  const inMonthDays = new Date(year, month + 1, 0).getDate();
  const total = Math.ceil((lead + inMonthDays) / 7) * 7;
  const startIso = toISODate(new Date(year, month, 1 - lead));

  return Array.from({ length: total }, (_, i) => {
    const iso = addDays(startIso, i);
    const [y, m] = parts(iso);
    return toDay(iso, m === month && y === year);
  });
}

export function monthLabel(year: number, month: number): string {
  return fmtMonthYear(toISODate(new Date(year, month, 1)));
}

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type CalendarView = "day" | "week" | "month";
export const CALENDAR_VIEWS: CalendarView[] = ["day", "week", "month"];

/** The Monday-to-Sunday week containing `iso`, as seven whole days. */
export function weekGrid(iso: string): CalendarDay[] {
  const start = mondayOfWeek(iso);
  return Array.from({ length: 7 }, (_, i) => toDay(addDays(start, i), true));
}

/** A single day, shaped like the other grids so day/week/month share one row type. */
export function dayRange(iso: string): CalendarDay[] {
  const date = new Date(`${iso}T00:00:00`);
  const day = date.getDay();
  return [{ iso, dayOfMonth: date.getDate(), inMonth: true, isWeekend: day === 0 || day === 6 }];
}

/**
 * Steps the calendar's anchor date by one day/week/month, according to the
 * active view. Month arithmetic preserves the day-of-month (so paging months
 * then switching to day/week lands where you'd expect), clamped to the
 * target month's last day when it's shorter — Jan 31 + 1 month lands on Feb
 * 28/29, never spills into March.
 */
export function shift(view: CalendarView, iso: string, by: number): string {
  const date = new Date(`${iso}T00:00:00`);
  if (view === "day") {
    return toISODate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + by));
  }
  if (view === "week") {
    return toISODate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + by * 7));
  }
  const targetMonthIndex = date.getMonth() + by;
  const daysInTargetMonth = new Date(date.getFullYear(), targetMonthIndex + 1, 0).getDate();
  const clampedDay = Math.min(date.getDate(), daysInTargetMonth);
  return toISODate(new Date(date.getFullYear(), targetMonthIndex, clampedDay));
}

/** The header label for the active view, anchored at `iso`. */
export function viewLabel(view: CalendarView, iso: string): string {
  if (view === "day") {
    const [y] = iso.split("-");
    return `${fmtWeekday(iso)} ${fmtDayLong(iso)} ${y}`;
  }
  if (view === "week") {
    const days = weekGrid(iso);
    return fmtRange(days[0].iso, days[6].iso);
  }
  const [y, m] = parts(iso);
  return monthLabel(y, m);
}

/** ISO 8601 week number (weeks start Monday; week 1 holds the year's first Thursday). */
export function isoWeekNumber(iso: string): number {
  const [y, m, d] = parts(iso);
  const date = new Date(y, m, d);
  // Move to the Thursday of this ISO week; its year is the ISO year.
  const thursday = new Date(y, m, d - mondayOffset(date) + 3);
  const jan1 = new Date(thursday.getFullYear(), 0, 1);
  const dayOfYear = Math.round(
    (Date.UTC(thursday.getFullYear(), thursday.getMonth(), thursday.getDate()) -
      Date.UTC(jan1.getFullYear(), 0, 1)) /
      86_400_000,
  );
  return Math.floor(dayOfYear / 7) + 1;
}

/** The two-tone H1 for a view: `title` in full ink, `dim` (the year) in the second tone. */
export function viewTitle(view: CalendarView, iso: string): { title: string; dim: string } {
  if (view !== "week") {
    const [y, m] = parts(iso);
    return { title: MONTHS_LONG[m], dim: String(y) };
  }
  const days = weekGrid(iso);
  const [y1, m1] = parts(days[0].iso);
  const [y2, m2] = parts(days[6].iso);
  return {
    title: m1 === m2 ? MONTHS_LONG[m2] : `${MONTHS_LONG[m1]} to ${MONTHS_LONG[m2]}`,
    dim: y1 === y2 ? String(y2) : `${y1} to ${y2}`,
  };
}
