import { toISODate } from "./parse";
import type { Task, TimeEntry } from "./types";

export type CalendarBlock = {
  /** Stable React key, e.g. `p:${task.id}` or `t:${entry.id}:${dayISO}`. */
  key: string;
  kind: "planned" | "tracked";
  taskId: string | null;
  /** Task title; "Untitled" when the entry's task is not found. */
  title: string;
  projectId: string | null;
  /** Minutes from local midnight of the day, 0..1440. */
  startMin: number;
  /** > startMin, <= 1440. */
  endMin: number;
  /** Tracked block whose entry has no endedAt. */
  running: boolean;
  done: boolean;
};

export type PlacedBlock = CalendarBlock & { lane: number; lanes: number };

export const DEFAULT_BLOCK_MINUTES = 30;

const DAY_MIN = 1440;

function dayStartOf(dayISO: string): Date {
  const [y, m, d] = dayISO.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Planned blocks: tasks with a `dueTime`. `tasks` are already that day's tasks. */
export function plannedBlocks(dayISO: string, tasks: Task[]): CalendarBlock[] {
  const out: CalendarBlock[] = [];
  for (const task of tasks) {
    if (!task.dueTime) continue;
    const m = /^(\d{1,2}):(\d{2})$/.exec(task.dueTime);
    if (!m) continue;
    const start = Number(m[1]) * 60 + Number(m[2]);
    if (start >= DAY_MIN) continue;
    const len = task.minutes > 0 ? task.minutes : DEFAULT_BLOCK_MINUTES;
    out.push({
      key: `p:${task.id}`,
      kind: "planned",
      taskId: task.id,
      title: task.title,
      projectId: task.projectId ?? null,
      startMin: start,
      endMin: Math.min(DAY_MIN, start + len),
      running: false,
      done: task.status === "done",
    });
  }
  return out;
}

/** Tracked blocks for one local day, clipped to it. Read-only data. */
export function trackedBlocks(
  dayISO: string,
  entries: TimeEntry[],
  running: TimeEntry | null,
  tasks: Task[],
  now: Date,
): CalendarBlock[] {
  const dayStart = dayStartOf(dayISO).getTime();
  const nextDay = dayStartOf(toISODate(new Date(dayStart + 36 * 3_600_000))); // safe across DST
  const dayEnd = nextDay.getTime();
  const all = running && !entries.some((e) => e.id === running.id) ? [...entries, running] : entries;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const out: CalendarBlock[] = [];
  const seen = new Set<string>();
  for (const e of all) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    const start = new Date(e.startedAt).getTime();
    const end = e.endedAt ? new Date(e.endedAt).getTime() : now.getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) continue;
    if (start >= dayEnd) continue;
    if (end <= dayStart) continue;
    const startMin = Math.min(DAY_MIN - 1, Math.max(0, Math.round((Math.max(start, dayStart) - dayStart) / 60_000)));
    let endMin = Math.min(DAY_MIN, Math.round((Math.min(end, dayEnd) - dayStart) / 60_000));
    if (endMin < startMin + 1) endMin = startMin + 1;
    const task = byId.get(e.taskId);
    out.push({
      key: `t:${e.id}:${dayISO}`,
      kind: "tracked",
      taskId: e.taskId ?? null,
      title: task?.title ?? "Untitled",
      projectId: task?.projectId ?? null,
      startMin,
      endMin,
      running: !e.endedAt,
      done: task?.status === "done",
    });
  }
  return out;
}

/** Overlapping blocks share a cluster; each takes the lowest free lane. */
export function layoutLanes(blocks: CalendarBlock[]): PlacedBlock[] {
  const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const placed: PlacedBlock[] = [];
  let cluster: PlacedBlock[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    for (const p of cluster) p.lanes = laneEnds.length;
    placed.push(...cluster);
    cluster = [];
    laneEnds = [];
  };
  for (const b of sorted) {
    if (cluster.length && b.startMin >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= b.startMin);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = b.endMin;
    clusterEnd = cluster.length ? Math.max(clusterEnd, b.endMin) : b.endMin;
    cluster.push({ ...b, lane, lanes: 1 });
  }
  flush();
  return placed;
}

/** 540 -> "09:00", 1440 -> "24:00". */
export function minutesToHHMM(min: number): string {
  const m = Math.max(0, Math.round(min));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
