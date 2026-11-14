import { isCarried, isPlanned } from "./today";
import { SETTINGS_DEFAULTS, type DockBadge, type Task } from "./types";

/** Dock badge: today's open tasks plus overdue open tasks that have a due time. 0 hides the badge. */
export function dockBadgeCount(tasks: Task[], todayISO: string, mode: DockBadge | undefined): number {
  if ((mode ?? SETTINGS_DEFAULTS.dockBadge) === "none") return 0;
  let n = 0;
  for (const t of tasks) {
    if (isPlanned(t, todayISO) || (isCarried(t, todayISO) && !!t.dueTime)) n += 1;
  }
  return n;
}
