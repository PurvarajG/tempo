import { toISODate } from "./parse";
import type { Project, Task, TimeEntry } from "./types";

export type MomentumInput = {
  /** Tasks done today. */
  done: Task[];
  /** Today's open tasks still on the Today card (up next, committed, could also, carried). */
  open: Task[];
  upNext: Task | null;
  /** All tasks, to map time entries to projects. */
  tasks: Task[];
  projects: Project[];
  /** All time entries. */
  entries: TimeEntry[];
  todayISO: string;
  dayDone: boolean;
};

export type Momentum = {
  sentence: string;
  done: number;
  total: number;
  percent: number;
  foot: string | null;
};

/** Below this much tracked time the foot line says nothing. */
const FOOT_MIN_MINUTES = 15;

function sentenceFor(i: MomentumInput): string {
  const done = i.done.length;
  const open = i.open.length;
  if (done + open === 0) return "Nothing planned for today.";
  if (open === 0) return "All done for today.";
  if (i.dayDone) {
    return `Day wrapped with ${open} still open. Carry ${open === 1 ? "it" : "them"} to tomorrow.`;
  }
  if (i.upNext) {
    return done === 0 ? `Start with ${i.upNext.title}.` : `${done} done. ${i.upNext.title} is next.`;
  }
  return `${done} done. ${open} still open.`;
}

function footFor(i: MomentumInput): string | null {
  const projectOf = new Map<string, string | undefined>();
  for (const t of i.tasks) projectOf.set(t.id, t.projectId);

  const byProject = new Map<string, number>();
  let total = 0;
  for (const e of i.entries) {
    if (!e.endedAt || !e.minutes) continue;
    if (toISODate(new Date(e.startedAt)) !== i.todayISO) continue;
    total += e.minutes;
    const pid = projectOf.get(e.taskId);
    if (pid) byProject.set(pid, (byProject.get(pid) ?? 0) + e.minutes);
  }
  if (total < FOOT_MIN_MINUTES) return null;

  let best: string | null = null;
  let bestMin = 0;
  for (const [pid, mins] of byProject) {
    if (mins > bestMin) {
      best = pid;
      bestMin = mins;
    }
  }
  const name = best ? i.projects.find((p) => p.id === best)?.name.trim() : "";
  return name ? `Most of today went to ${name}.` : null;
}

export function momentum(input: MomentumInput): Momentum {
  const done = input.done.length;
  const total = done + input.open.length;
  return {
    sentence: sentenceFor(input),
    done,
    total,
    percent: total ? Math.round((done / total) * 100) : 0,
    foot: footFor(input),
  };
}
