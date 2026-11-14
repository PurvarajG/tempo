import { fmtClock, fmtTime } from "./format";
import { daysBetween, toISODate } from "./parse";
import { isOverdue } from "./summary";
import type { Task } from "./types";

export type Suggestion = { task: Task; reasons: string[] };

export type SuggestOptions = {
  projectId?: string;
  nextEventStart?: Date | null;
  skipIds?: ReadonlySet<string>;
};

/** True when the task has a start date that is still in the future. */
export function isHiddenUntil(task: Task, todayISO: string): boolean {
  return !!task.startOn && task.startOn > todayISO;
}

/** True when any task this one waits on is still open. */
export function isBlocked(task: Task, byId: Map<string, Task>): boolean {
  return (task.blockedBy ?? []).some((id) => byId.get(id)?.status === "open");
}

type Signal = { weight: number; text: string };

function priorityRank(task: Task): number {
  // 1 is the most urgent; 0 means no priority and sorts last.
  return task.priority === 0 ? 4 : task.priority;
}

function isCandidate(
  task: Task,
  today: string,
  runningTaskId: string | null,
  byId: Map<string, Task>,
  opts: SuggestOptions,
): boolean {
  if (task.status !== "open") return false;
  if (isHiddenUntil(task, today)) return false;
  if (isBlocked(task, byId)) return false;
  if (opts.skipIds?.has(task.id)) return false;
  if (opts.projectId !== undefined && task.projectId !== opts.projectId) return false;
  if (task.id === runningTaskId) return true;
  if (task.committedOn === today) return true;
  if (task.scheduled === null) return false;
  if (task.scheduled <= today) return true;
  return false;
}

function signalsFor(
  task: Task,
  today: string,
  now: Date,
  runningTaskId: string | null,
  blocksCount: number,
  opts: SuggestOptions,
): Signal[] {
  const signals: Signal[] = [];

  if (task.id === runningTaskId) signals.push({ weight: 40, text: "Timer running" });
  if (task.committedOn === today) signals.push({ weight: 30, text: "Committed today" });

  if (task.dueTime && task.scheduled === today) {
    signals.push({ weight: 25, text: `Due ${fmtTime(task.dueTime)}` });
  }

  if (task.scheduled !== null && isOverdue(task, today)) {
    const deadline = task.isComplex && task.finishDate ? task.finishDate : task.scheduled;
    const days = Math.max(1, daysBetween(deadline, today));
    const weight = 10 + (Math.min(days, 7) - 1) * (10 / 6);
    signals.push({ weight, text: "Carried over" });
  }

  if (task.priority === 1) signals.push({ weight: 15, text: "High priority" });
  else if (task.priority === 2) signals.push({ weight: 8, text: "Medium priority" });
  else if (task.priority === 3) signals.push({ weight: 3, text: "Low priority" });

  if (blocksCount > 0) signals.push({ weight: 10, text: `Unblocks ${blocksCount}` });

  if (task.startOn && task.startOn <= today) signals.push({ weight: 5, text: "Can start now" });

  const next = opts.nextEventStart;
  if (next && next.getTime() > now.getTime()) {
    const gapMinutes = (next.getTime() - now.getTime()) / 60_000;
    if (task.minutes <= gapMinutes) {
      signals.push({ weight: 5, text: `Fits before ${fmtClock(next)}` });
    }
  }

  return signals;
}

/**
 * Best first, at most one task per project (tasks without a project are each
 * their own group). The second entry is the "Something else" alternative.
 * Weights are fixed here on purpose: they are never exposed or shown.
 */
export function rankSuggestions(
  tasks: Task[],
  now: Date,
  runningTaskId: string | null,
  opts: SuggestOptions = {},
): Suggestion[] {
  const today = toISODate(now);
  const byId = new Map(tasks.map((t) => [t.id, t]));

  const blocksCount = new Map<string, number>();
  for (const t of tasks) {
    if (t.status !== "open") continue;
    for (const id of t.blockedBy ?? []) {
      blocksCount.set(id, (blocksCount.get(id) ?? 0) + 1);
    }
  }

  const scored = tasks
    .filter((t) => isCandidate(t, today, runningTaskId, byId, opts))
    .map((task) => {
      const signals = signalsFor(task, today, now, runningTaskId, blocksCount.get(task.id) ?? 0, opts);
      const score = signals.reduce((sum, s) => sum + s.weight, 0);
      const reasons = [...signals]
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 2)
        .map((s) => s.text);
      return { task, score, reasons };
    });

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      priorityRank(a.task) - priorityRank(b.task) ||
      (a.task.scheduled ?? "9999-99-99").localeCompare(b.task.scheduled ?? "9999-99-99") ||
      a.task.sortOrder - b.task.sortOrder ||
      a.task.id.localeCompare(b.task.id),
  );

  const seen = new Set<string>();
  const result: Suggestion[] = [];
  for (const s of scored) {
    const group = s.task.projectId ? `p:${s.task.projectId}` : `t:${s.task.id}`;
    if (seen.has(group)) continue;
    seen.add(group);
    result.push({ task: s.task, reasons: s.reasons });
  }
  return result;
}

export function suggest(
  tasks: Task[],
  now: Date,
  runningTaskId: string | null,
  opts: SuggestOptions = {},
): Suggestion | null {
  return rankSuggestions(tasks, now, runningTaskId, opts)[0] ?? null;
}
