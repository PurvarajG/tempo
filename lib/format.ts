import type { Recurrence, Task } from "./types";

/**
 * Minutes as "45m", "2h 30m", "3d 4h". Estimates are unbounded — a task can be
 * a miniproject — so past a day it rolls over rather than printing "720h", and
 * only ever shows the two most significant units it has. A day is 24h here, to
 * match what `3d` means to the quick-add parser.
 */
export function fmt(mins: number): string {
  const parts: string[] = [];
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;

  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m || !parts.length) parts.push(`${m}m`);

  return parts.slice(0, 2).join(" ");
}

/** p1 is the most urgent; unset priority sorts last. */
export function rank(t: Task): number {
  return t.priority === 0 ? 4 : t.priority;
}

export const PRIORITY_LABEL = ["", "P1", "P2", "P3"] as const;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;

export const PRIORITY_NAME = ["None", "High", "Medium", "Low"] as const;

/**
 * "2026-11-12" -> "Thu 12 Nov". When `todayISO` is in a different year the year
 * matters, so it reads "12 Nov 2026" with no weekday. Built from local parts and
 * fixed English names, so it never shifts a day and never depends on the locale.
 */
export function fmtDate(iso: string, todayISO?: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const month = MONTHS[m - 1];
  if (todayISO && Number(todayISO.split("-")[0]) !== y) return `${d} ${month} ${y}`;
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${weekday} ${d} ${month}`;
}

/** "2026-11-14" -> "14 Nov". */
export function fmtDay(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** "2026-11-12" -> "12 November". Local parts, fixed English names. */
export function fmtDayLong(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS_LONG[m - 1]}`;
}

/** "2026-11-12" -> "November 2026". Local parts, fixed English names. */
export function fmtMonthYear(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

export const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/** "2026-11-18" -> "Wednesday", or "Wed" with form "short". Local parts, fixed English names. */
export function fmtWeekday(iso: string, form: "long" | "short" = "long"): string {
  const [y, m, d] = iso.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return form === "short" ? WEEKDAYS[day] : WEEKDAYS_LONG[day];
}

/** "13 to 19 Nov", "28 Nov to 4 Dec", "28 Dec 2026 to 3 Jan 2027". */
export function fmtRange(startISO: string, endISO: string): string {
  const [y1, m1, d1] = startISO.split("-").map(Number);
  const [y2, m2, d2] = endISO.split("-").map(Number);
  if (y1 !== y2) return `${d1} ${MONTHS[m1 - 1]} ${y1} to ${d2} ${MONTHS[m2 - 1]} ${y2}`;
  if (m1 !== m2) return `${d1} ${MONTHS[m1 - 1]} to ${d2} ${MONTHS[m2 - 1]}`;
  return `${d1} to ${d2} ${MONTHS[m2 - 1]}`;
}

const REPEAT_ADVERB = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" } as const;
const REPEAT_UNIT = { daily: "days", weekly: "weeks", monthly: "months" } as const;

/** "Weekly", "Every 2 weeks", "Weekly, when done". */
export function fmtRepeat(r: Recurrence): string {
  const base = r.interval > 1 ? `Every ${r.interval} ${REPEAT_UNIT[r.freq]}` : REPEAT_ADVERB[r.freq];
  return r.from === "done" ? `${base}, when done` : base;
}

/**
 * 24-hour clock, two-digit hour and minute: "15:30" -> "15:30", "9:5" -> "09:05".
 * Accepts one- or two-digit parts. No 12-hour suffix and no wrapping: "24:00" -> "24:00".
 */
export function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** A Date as local 24-hour "14:30". */
export function fmtClock(d: Date): string {
  return fmtTime(`${d.getHours()}:${d.getMinutes()}`);
}

/** Tracked duration as hours and minutes, never days: 2915 -> "48h 35m". */
export function fmtHours(mins: number): string {
  const total = Math.max(0, Math.round(Number.isFinite(mins) ? mins : 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0 && m === 0) return "0m";
  return [h > 0 ? `${h}h` : "", m > 0 ? `${m}m` : ""].filter(Boolean).join(" ");
}

/** Countdown for the timer card: "24:59", "00:05", "1:05:00". Rounds up to the second; negative is 0. */
export function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil((Number.isFinite(ms) ? ms : 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
