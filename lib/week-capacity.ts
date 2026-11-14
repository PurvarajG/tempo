import type { Task, TrackingSettings } from "./types";
import { fmtHours, fmtWeekday, rank } from "./format";
import { isBlocked, isHiddenUntil, rankSuggestions } from "./next";
import { addDays } from "./parse";
import { isOverdue } from "./summary";
import { capacity, isCarried, isPlanned, overBy } from "./today";

export type WeekDayPlan = {
  /** Local YYYY-MM-DD. */
  date: string;
  /** Open tasks scheduled on this day, in the app's existing rank/sort order. */
  tasks: Task[];
  /** Sum of `minutes` across this day's tasks. */
  plannedMinutes: number;
  /** 0–1 fraction of the day's capacity ceiling the planned minutes occupy, capped at 1 for bar width. */
  capacityRatio: number;
  /** True fraction of the ceiling, uncapped — >1 means the day is over capacity. */
  trueCapacityRatio: number;
  /** Whether this day's ceiling comes from real waking-hours settings (false while settings are still loading). */
  ceilingIsProvisional: boolean;
};

export type WeekMetrics = {
  taskCount: number;
  plannedMinutes: number;
  overdueCount: number;
  /** The date (YYYY-MM-DD) of the day with the most planned minutes, or null if the week is empty. */
  busiestDate: string | null;
};

/**
 * The per-day capacity ceiling, in minutes, used to size the capacity bars.
 *
 * Preferred source: the waking-hours window already stored on
 * `TrackingSettings` (`wakingStartHour`/`wakingEndHour`) — the same "how much
 * of the day is usable" concept `lib/tracking-day.ts`'s `wakingWindow` derives
 * for the tracking day. No new setting is introduced.
 *
 * Fallback, only when settings haven't loaded yet: the busiest of the seven
 * days' own planned minutes, so the bars still render proportionally instead
 * of inventing a number.
 */
export function capacityCeilingMinutes(
  settings: TrackingSettings | null,
  dayPlannedMinutes: number[],
): number {
  if (settings) {
    const hours = settings.wakingEndHour - settings.wakingStartHour;
    if (hours > 0) return hours * 60;
  }
  const busiest = Math.max(0, ...dayPlannedMinutes);
  return busiest > 0 ? busiest : 1;
}

/**
 * Builds the seven day-columns (today through today+6 inclusive) for the
 * Next 7 Days grid, each with its planned minutes and a capacity ratio
 * derived from `settings`.
 */
export function buildWeekPlan(tasks: Task[], todayISO: string, settings: TrackingSettings | null): WeekDayPlan[] {
  const horizon = addDays(todayISO, 6);
  const open = tasks.filter(
    (t): t is Task & { scheduled: string } =>
      t.status === "open" && t.scheduled !== null && t.scheduled >= todayISO && t.scheduled <= horizon,
  );

  const byDay = new Map<string, Task[]>();
  for (const t of open) {
    const list = byDay.get(t.scheduled) ?? [];
    list.push(t);
    byDay.set(t.scheduled, list);
  }

  const dates: string[] = [];
  for (let i = 0; i <= 6; i++) dates.push(addDays(todayISO, i));

  const plannedByDate = dates.map((d) => (byDay.get(d) ?? []).reduce((sum, t) => sum + t.minutes, 0));
  const ceiling = capacityCeilingMinutes(settings, plannedByDate);
  // While settings hasn't loaded yet, the fallback ceiling is "the busiest
  // day's own minutes" rather than "fraction of your waking day" — a
  // different meaning that must not paint the same as the real one. Callers
  // use `ceilingIsProvisional` to suppress or visibly mark the bar until
  // settings resolve.
  const ceilingIsProvisional = !settings || settings.wakingEndHour - settings.wakingStartHour <= 0;

  return dates.map((date, i) => {
    const dayTasks = byDay.get(date) ?? [];
    const plannedMinutes = plannedByDate[i];
    const trueCapacityRatio = plannedMinutes / ceiling;
    return {
      date,
      tasks: dayTasks,
      plannedMinutes,
      capacityRatio: Math.min(1, trueCapacityRatio),
      trueCapacityRatio,
      ceilingIsProvisional,
    };
  });
}

/** Metrics for the Next 7 Days `MetricStrip`, computed entirely from real data. */
export function weekMetrics(tasks: Task[], todayISO: string, week: WeekDayPlan[]): WeekMetrics {
  const taskCount = week.reduce((sum, d) => sum + d.tasks.length, 0);
  const plannedMinutes = week.reduce((sum, d) => sum + d.plannedMinutes, 0);
  // Shared with the Today metric strip (lib/summary.ts) and the project
  // focus band (lib/focus.ts) — a complex task isn't overdue until its
  // finish date passes, not its start day.
  const overdueCount = tasks.filter((t) => t.status === "open" && isOverdue(t, todayISO)).length;

  let busiestDate: string | null = null;
  let busiestMinutes = 0;
  for (const d of week) {
    if (d.plannedMinutes > busiestMinutes) {
      busiestMinutes = d.plannedMinutes;
      busiestDate = d.date;
    }
  }

  return { taskCount, plannedMinutes, overdueCount, busiestDate };
}

export type WeekRow = {
  /** YYYY-MM-DD */
  date: string;
  isToday: boolean;
  /** Open tasks of that day, sorted by rank() then sortOrder. */
  tasks: Task[];
  plannedMinutes: number;
  ceilingMinutes: number;
  /** max(0, ceiling - planned) */
  freeMinutes: number;
  /** max(0, planned - ceiling) */
  overByMinutes: number;
  over: boolean;
  /** planned / ceiling clamped to 0..1; 0 when ceiling is 0. */
  ratio: number;
  /** Settings not loaded (same rule as buildWeekPlan's ceilingIsProvisional). */
  provisional: boolean;
};

function byRankThenOrder(a: Task, b: Task): number {
  return rank(a) - rank(b) || a.sortOrder - b.sortOrder;
}

const sumMinutes = (ts: Task[]) => ts.reduce((n, t) => n + t.minutes, 0);

/** Seven rows, today through today+6. The today row agrees with the Today screen's capacity(). */
export function weekRows(tasks: Task[], todayISO: string, now: Date, settings: TrackingSettings | null): WeekRow[] {
  const provisional = !settings || settings.wakingEndHour - settings.wakingStartHour <= 0;
  const dates = Array.from({ length: 7 }, (_, i) => addDays(todayISO, i));

  const dayTasks = dates.map((date, i) =>
    i === 0
      ? tasks.filter((t) => t.status === "open" && (isPlanned(t, date) || t.committedOn === date))
      : tasks.filter((t) => t.status === "open" && t.scheduled === date && !isHiddenUntil(t, date)),
  );
  const planned = dayTasks.map(sumMinutes);
  const futureCeiling = capacityCeilingMinutes(settings, planned.slice(1));
  const cap = capacity(tasks, todayISO, now, settings);

  return dates.map((date, i) => {
    const sorted = [...dayTasks[i]].sort(byRankThenOrder);
    const isToday = i === 0;
    const plannedMinutes = isToday ? cap.plannedMinutes : planned[i];
    const ceilingMinutes = isToday ? cap.minutesLeft : futureCeiling;
    const over = isToday ? cap.over : !provisional && plannedMinutes > ceilingMinutes;
    return {
      date,
      isToday,
      tasks: sorted,
      plannedMinutes,
      ceilingMinutes,
      freeMinutes: isToday ? cap.freeMinutes : Math.max(0, ceilingMinutes - plannedMinutes),
      overByMinutes: isToday ? overBy(cap) : Math.max(0, plannedMinutes - ceilingMinutes),
      over,
      ratio: ceilingMinutes > 0 ? Math.min(1, plannedMinutes / ceilingMinutes) : 0,
      provisional,
    };
  });
}

/** Open tasks dated before today, oldest first; the same order layoutToday uses. */
export function carriedTasks(tasks: Task[], todayISO: string): Task[] {
  return tasks
    .filter((t) => isCarried(t, todayISO))
    .sort((a, b) => (a.scheduled ?? "").localeCompare(b.scheduled ?? "") || a.sortOrder - b.sortOrder);
}

/** "14 tasks, 18h 35m planned. Tuesday is over capacity. 2 carried over." */
export function weekHeadline(rows: WeekRow[], carriedCount: number): string {
  const total = rows.reduce((n, r) => n + r.tasks.length, 0);
  const minutes = rows.reduce((n, r) => n + r.plannedMinutes, 0);
  if (total === 0 && carriedCount <= 0) return "Nothing planned in the next 7 days.";

  const parts: string[] = [];
  if (total > 0) parts.push(`${total} ${total === 1 ? "task" : "tasks"}, ${fmtHours(minutes)} planned.`);

  const overRows = rows.filter((r) => r.over);
  const name = (r: WeekRow) => (r.isToday ? "Today" : fmtWeekday(r.date));
  if (overRows.length === 1) parts.push(`${name(overRows[0])} is over capacity.`);
  else if (overRows.length === 2) parts.push(`${name(overRows[0])} and ${name(overRows[1])} are over capacity.`);
  else if (overRows.length >= 3) parts.push(`${overRows.length} days are over capacity.`);

  if (carriedCount > 0) parts.push(`${carriedCount} carried over.`);
  return parts.join(" ");
}

/** A carried or undated task that fits an empty day's free time, for the "Plan it for Wednesday" chip. */
export function planItFor(
  tasks: Task[],
  row: WeekRow,
  todayISO: string,
  now: Date,
  runningTaskId: string | null,
  exclude?: ReadonlySet<string>,
): Task | null {
  if (row.tasks.length !== 0 || row.freeMinutes <= 0) return null;
  const fits = (t: Task) => t.minutes > 0 && t.minutes <= row.freeMinutes && !exclude?.has(t.id);

  const carried = rankSuggestions(tasks, now, runningTaskId)
    .map((s) => s.task)
    .filter((t) => t.scheduled !== null && t.scheduled < todayISO);
  const first = carried.find(fits);
  if (first) return first;

  const byId = new Map(tasks.map((t) => [t.id, t]));
  return (
    tasks
      .filter(
        (t) =>
          t.status === "open" && t.scheduled === null && !isHiddenUntil(t, row.date) && !isBlocked(t, byId),
      )
      .sort(byRankThenOrder)
      .find(fits) ?? null
  );
}
