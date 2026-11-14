import type { ProjectStage, Task, TimeEntry } from "./types";

export type ProjectSummary = {
  open: number;
  completed: number;
  total: number;
  /** Completed non-trashed tasks over all non-trashed project tasks, 0-100. */
  percentComplete: number;
  byStage: { stage: ProjectStage; count: number }[];
  overdue: number;
  blocked: number;
  estimatedMinutes: number;
  recordedMinutes: number;
  recordedTodayMinutes: number;
  recordedWeekMinutes: number;
};

/** Trashed tasks are not work — they're deleted, and never count anywhere. */
function live(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.status !== "trashed");
}

/** A complex task is due on every day of its range, not just its start day. */
function isDueOn(task: Task, iso: string): boolean {
  if (task.scheduled === null) return false;
  if (!task.isComplex) return task.scheduled === iso;
  return task.scheduled <= iso && iso <= task.finishDate!;
}

/**
 * A complex task isn't overdue until its finish date passes, not its start day.
 *
 * This is a DEADLINE predicate only — it says nothing about status, so every
 * caller pairs it with its own `status === "open"` check. Keeping the two
 * apart lets callers that have already filtered by status avoid re-checking.
 */
export function isOverdue(task: Task, todayISO: string): boolean {
  // Undated (inbox) tasks have no deadline, so they are never overdue.
  if (task.scheduled === null) return false;
  const deadline = task.isComplex ? task.finishDate! : task.scheduled;
  return deadline < todayISO;
}

/**
 * Every project number is derived here from tasks, stage semantics, and time
 * entries. Nothing is stored, so a rename or a drag can't leave a stale figure
 * behind, and there is no opaque "health" score to explain.
 */
export function projectSummary(
  projectId: string,
  allTasks: Task[],
  allStages: ProjectStage[],
  entries: TimeEntry[],
  todayISO: string,
): ProjectSummary {
  const tasks = live(allTasks).filter((t) => t.projectId === projectId);
  const stages = allStages
    .filter((s) => s.projectId === projectId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const blockedStageIds = new Set(stages.filter((s) => s.kind === "blocked").map((s) => s.id));
  const completed = tasks.filter((t) => t.status === "done").length;
  const open = tasks.length - completed;

  const taskIds = new Set(tasks.map((t) => t.id));
  const projectEntries = entries.filter((e) => taskIds.has(e.taskId) && e.endedAt && e.minutes);

  const weekAgo = shiftDays(todayISO, -6);

  return {
    open,
    completed,
    total: tasks.length,
    percentComplete: tasks.length === 0 ? 0 : Math.round((completed / tasks.length) * 100),
    byStage: stages.map((stage) => ({
      stage,
      count: tasks.filter((t) => t.stageId === stage.id).length,
    })),
    // Overdue means an open task whose deadline has already passed — a
    // completed task is never late, however long it sat there.
    overdue: tasks.filter((t) => t.status === "open" && isOverdue(t, todayISO)).length,
    blocked: tasks.filter((t) => t.status === "open" && t.stageId && blockedStageIds.has(t.stageId))
      .length,
    estimatedMinutes: tasks
      .filter((t) => t.status === "open")
      .reduce((sum, t) => sum + t.minutes, 0),
    recordedMinutes: projectEntries.reduce((sum, e) => sum + (e.minutes ?? 0), 0),
    recordedTodayMinutes: projectEntries
      .filter((e) => e.startedAt.slice(0, 10) === todayISO)
      .reduce((sum, e) => sum + (e.minutes ?? 0), 0),
    recordedWeekMinutes: projectEntries
      .filter((e) => e.startedAt.slice(0, 10) >= weekAgo)
      .reduce((sum, e) => sum + (e.minutes ?? 0), 0),
  };
}

/** Calendar-safe day shift on a local YYYY-MM-DD. */
export function shiftDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export type TodaySummary = {
  dueToday: Task[];
  overdue: Task[];
  blocked: Task[];
  plannedMinutes: number;
  recordedTodayMinutes: number;
};

export function todaySummary(
  allTasks: Task[],
  allStages: ProjectStage[],
  entries: TimeEntry[],
  todayISO: string,
): TodaySummary {
  const tasks = live(allTasks);
  const blockedStageIds = new Set(allStages.filter((s) => s.kind === "blocked").map((s) => s.id));
  const openToday = tasks.filter((t) => t.status === "open" && isDueOn(t, todayISO));

  return {
    dueToday: openToday,
    overdue: tasks.filter((t) => t.status === "open" && isOverdue(t, todayISO)),
    blocked: tasks.filter(
      (t) => t.status === "open" && t.stageId && blockedStageIds.has(t.stageId),
    ),
    plannedMinutes: openToday.reduce((sum, t) => sum + t.minutes, 0),
    recordedTodayMinutes: entries
      .filter((e) => e.endedAt && e.minutes && e.startedAt.slice(0, 10) === todayISO)
      .reduce((sum, e) => sum + (e.minutes ?? 0), 0),
  };
}
