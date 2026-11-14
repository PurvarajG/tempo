import { isHiddenUntil } from "./next";
import type { Task } from "./types";

/**
 * Open tasks scheduled for today with a clock time, not hidden by a future
 * start date, ordered by time then id. Pure; the input is not mutated.
 */
export function remindersDue(tasks: Task[], todayISO: string): Task[] {
  return tasks
    .filter((t) => t.status === "open" && !!t.dueTime && t.scheduled === todayISO && !isHiddenUntil(t, todayISO))
    .sort((a, b) => ((a.dueTime ?? "") + a.id).localeCompare((b.dueTime ?? "") + b.id));
}
