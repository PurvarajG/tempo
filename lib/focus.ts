import { daysBetween } from "./parse";
import { rank } from "./format";
import { isBlocked, isHiddenUntil, suggest } from "./next";
import { isOverdue } from "./summary";
import { STALE_AFTER_DAYS, type ProjectStage, type Task, type TimeEntry } from "./types";

/**
 * How many days a task has sat on its scheduled date, as of `todayISO`.
 * Undated tasks have no scheduled date to sit on, so their age is 0.
 */
export function taskAge(task: Task, todayISO: string): number {
  if (task.scheduled === null) return 0;
  return daysBetween(task.scheduled, todayISO);
}

/**
 * A task that has sat open past `STALE_AFTER_DAYS` on its scheduled date —
 * the banner condition in `TaskRow` ("Still doing it" / "Let it go") and the
 * stalled-waiting half of the project focus band's attention list.
 * Undated tasks are never stale.
 */
export function isStale(task: Task, todayISO: string): boolean {
  return task.status === "open" && taskAge(task, todayISO) > STALE_AFTER_DAYS;
}

// One overdue definition for the whole app — see lib/summary.ts.

function isDueToday(task: Task, todayISO: string): boolean {
  if (task.status !== "open" || task.scheduled === null) return false;
  if (task.isComplex) return task.scheduled <= todayISO && todayISO <= task.finishDate!;
  return task.scheduled === todayISO;
}

/**
 * The single task a project screen should put in front of you. The ranking
 * itself lives in `suggest` (lib/next.ts) so the app has one ordering: the
 * running task wins, then a task committed today, then the best carried-over
 * or due-today task. Undated tasks only qualify when committed today.
 * Returns null when there's nothing to focus on.
 *
 * `suggest` weighs how long a task has been carried over; this screen has
 * always ranked plain due/overdue tasks by priority, then scheduled date, so
 * that tie-break is applied here to pick the one plain candidate handed to
 * `suggest` alongside the running and committed tasks.
 */
export function getFocusTask(
  tasks: Task[],
  projectId: string,
  running: Pick<TimeEntry, "taskId"> | null | undefined,
  todayISO: string,
  now?: Date,
): Task | null {
  const [y, m, d] = todayISO.split("-").map(Number);
  const at = now ?? new Date(y, m - 1, d, 12);
  const runningId = running?.taskId ?? null;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const projectTasks = tasks.filter((t) => t.projectId === projectId && t.status !== "trashed");

  const special: Task[] = [];
  const plain: Task[] = [];
  for (const t of projectTasks) {
    if (t.id === runningId || t.committedOn === todayISO) special.push(t);
    else if (
      t.status === "open" &&
      t.scheduled !== null &&
      (isOverdue(t, todayISO) || isDueToday(t, todayISO)) &&
      !isHiddenUntil(t, todayISO) &&
      !isBlocked(t, byId)
    ) {
      plain.push(t);
    }
  }
  plain.sort((a, b) => rank(a) - rank(b) || a.scheduled!.localeCompare(b.scheduled!));

  const pool = plain.length > 0 ? [...special, plain[0]] : special;
  // Pass every task so `suggest` still sees what blocks what, but skip all
  // but the pool so only those compete.
  const poolIds = new Set(pool.map((t) => t.id));
  const skipIds = new Set(tasks.filter((t) => !poolIds.has(t.id)).map((t) => t.id));
  const result = suggest(tasks, at, runningId, { projectId, skipIds });
  return result ? result.task : null;
}

export type AttentionItem = {
  task: Task;
  reason: "overdue" | "stalled-waiting";
  detail: string;
};

/**
 * Tasks the project screen should flag as needing a decision: anything
 * overdue, plus anything sitting in a waiting-kind stage with no follow-up
 * past the same staleness threshold `TaskRow` already uses.
 */
export function getAttentionItems(
  tasks: Task[],
  stages: ProjectStage[],
  projectId: string,
  todayISO: string,
): AttentionItem[] {
  const projectTasks = tasks.filter((t) => t.projectId === projectId && t.status !== "trashed");
  const waitingStageIds = new Set(
    stages.filter((s) => s.projectId === projectId && s.kind === "blocked").map((s) => s.id),
  );
  const isWaiting = (task: Task) => !!task.stageId && waitingStageIds.has(task.stageId);

  const items: AttentionItem[] = [];

  // A waiting-kind stage's tasks are judged on staleness ("no follow-up
  // date"), not the scheduled-date deadline every other stage uses — the two
  // rules would otherwise always overlap, since staleness implies the
  // scheduled date has passed too.
  for (const task of projectTasks) {
    if (isWaiting(task)) continue;
    if (task.scheduled === null) continue; // undated tasks are never overdue
    if (task.status !== "open" || !isOverdue(task, todayISO)) continue;
    const age = taskAge(task, todayISO);
    items.push({
      task,
      reason: "overdue",
      detail: `Overdue by ${age} ${age === 1 ? "day" : "days"} · reschedule or complete`,
    });
  }

  for (const task of projectTasks) {
    if (!isWaiting(task) || !isStale(task, todayISO)) continue;
    items.push({ task, reason: "stalled-waiting", detail: "Waiting with no follow-up date" });
  }

  return items;
}
