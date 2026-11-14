import { daysBetween, toISODate } from "@/lib/parse";
import { isOverdue } from "@/lib/summary";
import type { ProjectStage, StageKind, Task } from "@/lib/types";

export const HERE_AFTER_DAYS = 3;
export const QUIET_AFTER_DAYS = 14;

/** Whole days since task.stageEnteredAt (local date) to todayISO. null when missing. */
export function daysInLane(task: Task, todayISO: string): number | null {
  if (!task.stageEnteredAt) return null;
  const entered = new Date(task.stageEnteredAt);
  if (Number.isNaN(entered.getTime())) return null;
  return daysBetween(toISODate(entered), todayISO);
}

/** "3d here" label for open tasks that have sat in the lane for HERE_AFTER_DAYS or more. */
export function hereLabel(task: Task, todayISO: string): string | null {
  if (task.status !== "open") return null;
  const n = daysInLane(task, todayISO);
  return n !== null && n >= HERE_AFTER_DAYS ? `${n}d here` : null;
}

/** Open tasks of the project in an active lane for more than QUIET_AFTER_DAYS days, longest first. */
export function goneQuiet(
  tasks: Task[],
  stages: ProjectStage[],
  projectId: string,
  todayISO: string,
): Task[] {
  const active = new Set(stages.filter((s) => s.kind === "active").map((s) => s.id));
  return tasks
    .filter((t) => t.projectId === projectId && t.status === "open" && t.stageId && active.has(t.stageId))
    .map((t) => ({ t, n: daysInLane(t, todayISO) }))
    .filter((x): x is { t: Task; n: number } => x.n !== null && x.n > QUIET_AFTER_DAYS)
    .sort((a, b) => b.n - a.n || a.t.title.localeCompare(b.t.title))
    .map((x) => x.t);
}

/** Open tasks in the stage (same rule as wipCount in lib/store/stages.ts). */
export function openInStage(tasks: Task[], stageId: string): number {
  return tasks.filter((t) => t.stageId === stageId && t.status === "open").length;
}

/** Lane header count text and whether the soft WIP limit is exceeded. */
export function laneCountLabel(
  count: number,
  open: number,
  wipLimit?: number | null,
): { text: string; over: boolean } {
  if (wipLimit === null || wipLimit === undefined) return { text: String(count), over: false };
  return { text: `${open}/${wipLimit}`, over: open > wipLimit };
}

/** A limit below the current open count starts at the current count. null stays null. */
export function limitToSave(requested: number | null, open: number): number | null {
  if (requested === null) return null;
  const n = Number.isFinite(requested) ? Math.floor(requested) : 1;
  return Math.max(n, open, 1);
}

/** Sum of minutes over open tasks of the project. */
export function leftToPlanMinutes(tasks: Task[], projectId: string): number {
  return tasks
    .filter((t) => t.projectId === projectId && t.status === "open")
    .reduce((sum, t) => sum + t.minutes, 0);
}

/** Open tasks of the project that are overdue (carried over). */
export function carriedOver(tasks: Task[], projectId: string, todayISO: string): Task[] {
  return tasks.filter(
    (t) => t.projectId === projectId && t.status === "open" && isOverdue(t, todayISO),
  );
}

/** Lane header glyph by stage kind. */
export function laneGlyph(kind: StageKind): "target" | "live" | "clock" | "check" {
  switch (kind) {
    case "backlog":
      return "target";
    case "active":
      return "live";
    case "blocked":
      return "clock";
    case "done":
      return "check";
  }
}
