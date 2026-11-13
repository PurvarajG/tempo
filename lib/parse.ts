import {
  type Duration,
  type Priority,
  type Recurrence,
  type RecurrenceFreq,
  type TaskInput,
  type DateOrder,
} from "./types";

/** Local calendar date as YYYY-MM-DD. Never use toISOString here — it shifts by timezone. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return toISODate(new Date(y, m - 1, d + n));
}

export function daysBetween(fromISO: string, toISO: string): number {
  const [y1, m1, d1] = fromISO.split("-").map(Number);
  const [y2, m2, d2] = toISO.split("-").map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86_400_000);
}

/** Estimates are free-form; only round to a whole minute, never to a preset. */
function toMinutes(mins: number): Duration {
  return Math.max(1, Math.round(mins));
}

/** "3pm", "3:30pm", "9am", "15:00" -> "HH:MM" (24h), or null if not a time. */
function parseTimeToken(token: string): string | null {
  const ampm = /^(\d{1,2})(?::(\d{2}))?(am|pm)$/.exec(token);
  if (ampm) {
    let h = Number(ampm[1]) % 12;
    if (ampm[3] === "pm") h += 12;
    const m = ampm[2] ?? "00";
    return `${String(h).padStart(2, "0")}:${m}`;
  }
  const clock = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(token);
  if (clock) return `${clock[1].padStart(2, "0")}:${clock[2]}`;
  return null;
}

/** "daily", "weekly", "monthly", "every2w", "every3d" -> a recurrence rule. */
function parseRecurrenceToken(token: string): Recurrence | null {
  // A trailing "!" means "repeat from the day I finish it" (weekly!, every2w!).
  if (token.length > 1 && token.endsWith("!")) {
    const base = parseRecurrenceToken(token.slice(0, -1));
    return base ? { ...base, from: "done" } : null;
  }

  const named: Record<string, RecurrenceFreq> = {
    daily: "daily",
    weekly: "weekly",
    monthly: "monthly",
  };
  if (token in named) return { freq: named[token], interval: 1 };

  const every = /^every(\d*)([dwm])$/.exec(token);
  if (every) {
    const interval = Number(every[1] || 1);
    const freq: RecurrenceFreq =
      every[2] === "d" ? "daily" : every[2] === "w" ? "weekly" : "monthly";
    return { freq, interval };
  }

  return null;
}

function daysInMonth(y: number, m0: number): number {
  return new Date(y, m0 + 1, 0).getDate();
}

/**
 * Add whole months, clamping the day to the target month's length (31 Jan + 1
 * month = 28/29 Feb). Callers that step repeatedly compute each step from the
 * ORIGINAL date, so 31 Jan monthly goes 28/29 Feb, 31 Mar, 30 Apr, 31 May.
 */
function addMonthsClamped(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const total = m - 1 + months;
  const ty = y + Math.floor(total / 12);
  const tm = ((total % 12) + 12) % 12;
  return toISODate(new Date(ty, tm, Math.min(d, daysInMonth(ty, tm))));
}

/**
 * The next date for a repeating task.
 *  - from "schedule" (or absent): the k-th step from `fromISO` (computed from the
 *    original date, never chained), with k the smallest value >= 1 that lands
 *    strictly after `todayISO`. A task finished late rolls forward instead of
 *    landing in the past. Monthly clamps to the month's last day (31 Jan -> 28/29 Feb -> 31 Mar).
 *  - from "done": exactly one step counted from `todayISO`.
 */
export function nextOccurrence(fromISO: string, r: Recurrence, todayISO: string): string {
  const step = Math.max(1, Math.floor(r.interval) || 1);
  if (r.from === "done") {
    if (r.freq === "daily") return addDays(todayISO, step);
    if (r.freq === "weekly") return addDays(todayISO, step * 7);
    return addMonthsClamped(todayISO, step);
  }
  if (r.freq !== "monthly") {
    const len = r.freq === "daily" ? step : step * 7;
    const k = Math.max(1, Math.floor(daysBetween(fromISO, todayISO) / len) + 1);
    return addDays(fromISO, k * len);
  }
  const [y1, m1] = fromISO.split("-").map(Number);
  const [y2, m2] = todayISO.split("-").map(Number);
  const monthsApart = (y2 - y1) * 12 + (m2 - m1);
  let k = Math.max(1, Math.floor(monthsApart / step) - 1);
  for (;;) {
    const candidate = addMonthsClamped(fromISO, k * step);
    if (candidate > todayISO) return candidate;
    k++;
  }
}

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
};

const WEEKDAY_NAMES: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5, sat: 6, saturday: 6,
};

function dayOfWeek(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

/** A real calendar date (rejects 31 Feb, month 13). */
function validYMD(y: number, m0: number, d: number): boolean {
  if (m0 < 0 || m0 > 11 || d < 1) return false;
  return d <= daysInMonth(y, m0);
}

function ymdToISO(y: number, m0: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Month + day with no year: this year if it is today or later, else the next
 * year it exists in (so "jan 3" typed on 12 Nov 2026 is 2027-01-03). Null when
 * the date never exists (nov31).
 */
function monthDayToISO(m0: number, d: number, todayISO: string): string | null {
  const thisYear = Number(todayISO.slice(0, 4));
  for (let y = thisYear; y <= thisYear + 4; y++) {
    if (!validYMD(y, m0, d)) {
      if (d > daysInMonth(2024, m0)) return null; // never valid in any year
      continue; // 29 Feb in a non-leap year
    }
    const iso = ymdToISO(y, m0, d);
    if (iso >= todayISO) return iso;
  }
  return null;
}

/** Day numbers 1-31 only. */
function dayNumber(s: string): number | null {
  if (!/^\d{1,2}$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 && n <= 31 ? n : null;
}

/** "nov"/"12" or "12"/"nov" given as two separate words. */
export function monthDayPair(a: string, b: string, todayISO: string): string | null {
  if (a in MONTHS) {
    const d = dayNumber(b);
    return d === null ? null : monthDayToISO(MONTHS[a], d, todayISO);
  }
  if (b in MONTHS) {
    const d = dayNumber(a);
    return d === null ? null : monthDayToISO(MONTHS[b], d, todayISO);
  }
  return null;
}

/**
 * One-word date tokens, lowercased by the caller or not (we lowercase here).
 * Used by the quick-add day slot and by `from:` / `until:`.
 *
 *   today tod tomorrow tmrw tom
 *   mon..sun (full or abbreviated)   the next one, never today
 *   +3d +2w +1m                      days / weeks / months out (month clamps)
 *   nov12 12nov                      month and day; past this year = next year
 *   11/12                            day/month for "dmy" (default), month/day for "mdy"
 *   2026-11-12                       ISO
 *   nextweek                         the next Monday
 *   eow                              Friday of this week: today if today is Friday, else the coming Friday
 *   wknd                             the coming Saturday (today if Saturday)
 *
 * Invalid dates (31/02, nov31) return null so they stay in the title.
 */
export function parseDateToken(
  token: string,
  todayISO: string,
  dateOrder: DateOrder = "dmy",
): string | null {
  const t = token.toLowerCase();
  if (t === "today" || t === "tod") return todayISO;
  if (t === "tomorrow" || t === "tmrw" || t === "tom") return addDays(todayISO, 1);

  const rel = /^\+(\d+)([dwm])$/.exec(t);
  if (rel) {
    const n = Number(rel[1]);
    if (rel[2] === "d") return addDays(todayISO, n);
    if (rel[2] === "w") return addDays(todayISO, n * 7);
    return addMonthsClamped(todayISO, n);
  }

  if (t in WEEKDAY_NAMES) {
    const delta = (WEEKDAY_NAMES[t] - dayOfWeek(todayISO) + 7) % 7 || 7;
    return addDays(todayISO, delta);
  }

  if (t === "nextweek") return addDays(todayISO, (8 - dayOfWeek(todayISO)) % 7 || 7);
  if (t === "eow") return addDays(todayISO, (5 - dayOfWeek(todayISO) + 7) % 7);
  if (t === "wknd") return addDays(todayISO, (6 - dayOfWeek(todayISO) + 7) % 7);

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (iso) {
    const [y, m, d] = [Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])];
    return validYMD(y, m, d) ? ymdToISO(y, m, d) : null;
  }

  const slash = /^(\d{1,2})\/(\d{1,2})$/.exec(t);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    const [day, month] = dateOrder === "mdy" ? [b, a] : [a, b];
    return month >= 1 && month <= 12 && day >= 1 ? monthDayToISO(month - 1, day, todayISO) : null;
  }

  const monthFirst = /^([a-z]+)(\d{1,2})$/.exec(t);
  if (monthFirst && monthFirst[1] in MONTHS) {
    return monthDayToISO(MONTHS[monthFirst[1]], Number(monthFirst[2]), todayISO);
  }
  const dayFirst = /^(\d{1,2})([a-z]+)$/.exec(t);
  if (dayFirst && dayFirst[2] in MONTHS) {
    return monthDayToISO(MONTHS[dayFirst[2]], Number(dayFirst[1]), todayISO);
  }

  return null;
}

export type ParsedQuickAdd = Omit<TaskInput, "projectId" | "scheduled"> & {
  projectName?: string;
  /** undefined: no day was typed (caller decides the default). null: nodate / inbox. */
  scheduled?: string | null;
  startOn?: string;
  expiresOn?: string;
  /** Reminder lead time in minutes (parse only). */
  reminderMinutes?: number;
  commit?: boolean;
};

/**
 * Turns "call dentist thu 30m p1 3pm weekly #health @calls" into a task.
 * Everything is optional. With no day token `scheduled` is undefined and the
 * caller picks the default (today, or the inbox); capture has to stay faster
 * than the thought that prompted it. Bare text is a 30-minute task.
 * Tokens are case-insensitive and may sit anywhere in the text.
 *
 *   #project   assigns/creates a list (first one wins)
 *   @tag       adds a free tag (repeatable)
 *   p1/p2/p3   priority
 *   30m / 2h / 3d   estimate, any length (a task can be its own miniproject)
 *   today/tod, tomorrow/tmrw/tom, thu, +3d, +2w, +1m   the day to schedule it
 *   in 3d / in 2w / in 1m           two-word relative day
 *   nov12 / 12nov / nov 12 / 12 nov / jan 3   a date (past this year = next year)
 *   11/12      day/month by default, month/day when dateOrder is "mdy"
 *   2026-11-12   ISO date
 *   next week / nextweek   next Monday
 *   eow        Friday of this week (today if Friday, else the coming Friday)
 *   wknd       the coming Saturday (today if Saturday)
 *   nodate / inbox   no day at all (scheduled null). Consumed wherever it
 *              appears, so "inbox zero" becomes the title "zero" in the inbox.
 *   from:<date>   hidden until that day (startOn)
 *   until:<date>  expires after that day (expiresOn)
 *   3pm / 15:00   a due time on that day (11:12 is a time, never a date)
 *   !10m / !1h    reminder lead time (reminderMinutes; separate from the 30m estimate)
 *   *          commit to Today (a lone * word)
 *   daily / weekly / monthly / every2w   recurrence
 *   weekly! / every2w! / weekly when done   repeat from the day it is finished
 * Invalid dates (31/02, nov31) are not dates and stay in the title.
 */
export function parseQuickAdd(
  raw: string,
  now = new Date(),
  opts?: { dateOrder?: DateOrder },
): ParsedQuickAdd {
  const dateOrder = opts?.dateOrder ?? "dmy";
  const todayISO = toISODate(now);
  let minutes: Duration | undefined;
  let priority: Priority = 0;
  let projectName: string | undefined;
  const tags: string[] = [];
  let scheduled: string | null | undefined;
  let startOn: string | undefined;
  let expiresOn: string | undefined;
  let reminderMinutes: number | undefined;
  let commit: boolean | undefined;
  let dueTime: string | undefined;
  let recurrence: Recurrence | undefined;

  const kept: string[] = [];
  const words = raw.trim().split(/\s+/);

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const lower = word.toLowerCase();
    const nextLower = words[i + 1]?.toLowerCase();

    if (lower.startsWith("#") && word.length > 1 && !projectName) {
      projectName = word.slice(1);
      continue;
    }

    if (lower.startsWith("@") && word.length > 1) {
      tags.push(word.slice(1).toLowerCase());
      continue;
    }

    const p = /^p([123])$/.exec(lower);
    if (p) {
      priority = Number(p[1]) as Priority;
      continue;
    }

    const rem = /^!(\d+)(m|h)$/.exec(lower);
    if (rem) {
      reminderMinutes = Number(rem[1]) * (rem[2] === "h" ? 60 : 1);
      continue;
    }

    if (word === "*") {
      commit = true;
      continue;
    }

    const bound = /^(from|until):(.+)$/.exec(lower);
    if (bound) {
      const date = parseDateToken(bound[2], todayISO, dateOrder);
      if (date) {
        if (bound[1] === "from") startOn = date;
        else expiresOn = date;
        continue;
      }
    }

    if (lower === "nodate" || lower === "inbox") {
      scheduled = null;
      continue;
    }

    // Two-word day forms.
    if (nextLower !== undefined) {
      if (lower === "next" && nextLower === "week") {
        scheduled = parseDateToken("nextweek", todayISO)!;
        i++;
        continue;
      }
      if (lower === "in") {
        const inRel = /^(\d+)([dwm])$/.exec(nextLower);
        if (inRel) {
          scheduled = parseDateToken(`+${inRel[1]}${inRel[2]}`, todayISO)!;
          i++;
          continue;
        }
      }
      const pair = monthDayPair(lower, nextLower, todayISO);
      if (pair) {
        scheduled = pair;
        i++;
        continue;
      }
    }

    const dur = /^(\d+(?:\.\d+)?)(m|min|mins|h|hr|hrs|d|day|days)$/.exec(lower);
    if (dur) {
      const n = parseFloat(dur[1]);
      const unit = dur[2][0];
      minutes = toMinutes(unit === "h" ? n * 60 : unit === "d" ? n * 60 * 24 : n);
      continue;
    }

    const time = parseTimeToken(lower);
    if (time) {
      dueTime = time;
      continue;
    }

    const rec = parseRecurrenceToken(lower);
    if (rec) {
      if (words[i + 1]?.toLowerCase() === "when" && words[i + 2]?.toLowerCase() === "done") {
        rec.from = "done";
        i += 2;
      }
      recurrence = rec;
      continue;
    }

    const day = parseDateToken(lower, todayISO, dateOrder);
    if (day) {
      scheduled = day;
      continue;
    }

    kept.push(word);
  }

  const title = kept.join(" ").trim();

  return {
    title: title || raw.trim(),
    projectName,
    tags,
    priority,
    minutes: minutes ?? 30,
    scheduled,
    startOn,
    expiresOn,
    reminderMinutes,
    commit,
    dueTime,
    recurrence,
  };
}
