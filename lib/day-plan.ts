import type { Task } from "./types";
import { fmtTime } from "./format";

export type PlanBlock =
  | { kind: "task"; task: Task; start: string; end: string; minutes: number; fixed: boolean; current: boolean }
  | { kind: "free"; start: string; end: string; minutes: number; fits: Task | null };

export type DayPlan = { label: string; from: string; to: string; blocks: PlanBlock[]; leftover: Task[] };

const MIN_FREE = 15;
const DEFAULT_MINUTES = 15;

function hhmm(total: number): string {
  const t = Math.max(0, Math.min(total, 24 * 60));
  return fmtTime(`${Math.floor(t / 60)}:${t % 60}`);
}

function parseHM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

type Placed = { task: Task; start: number; end: number; minutes: number; fixed: boolean; current: boolean };

/**
 * Derived schedule for the rest of today: the running task first, timed tasks
 * at their dueTime, the others packed in list order. Free gaps of 15 minutes
 * or more are shown. Pure: `now` is passed in.
 */
export function dayPlan(input: {
  open: Task[];
  now: Date;
  endHour: number;
  runningTaskId: string | null;
}): DayPlan {
  const { open, now, endHour, runningTaskId } = input;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const hasSub = now.getSeconds() > 0 || now.getMilliseconds() > 0;
  const fromMin = Math.ceil((nowMin + (hasSub ? 1 : 0)) / 5) * 5;
  const toMin = endHour * 60;
  const label = now.getHours() < 12 ? "This morning" : now.getHours() < 17 ? "This afternoon" : "This evening";
  const from = hhmm(fromMin);
  const to = hhmm(toMin);

  if (nowMin >= toMin || fromMin >= toMin) {
    return { label, from, to, blocks: [], leftover: [...open] };
  }

  const eff = (t: Task) => (t.minutes > 0 ? t.minutes : DEFAULT_MINUTES);
  const placed: Placed[] = [];
  const leftover: Task[] = [];
  let cursor = fromMin;

  const running = runningTaskId ? open.find((t) => t.id === runningTaskId) : undefined;
  if (running) {
    const minutes = eff(running);
    placed.push({ task: running, start: fromMin, end: fromMin + minutes, minutes, fixed: false, current: true });
    cursor = fromMin + minutes;
  }

  // Fixed blocks: dueTime in [from, to), ordered by time, shifted past overlaps.
  const timed = open
    .filter((t) => t !== running)
    .map((t) => ({ t, at: t.dueTime ? parseHM(t.dueTime) : null }))
    .filter((x): x is { t: Task; at: number } => x.at !== null && x.at >= fromMin && x.at < toMin)
    .sort((a, b) => a.at - b.at);
  const fixed: Placed[] = [];
  let prevEnd = cursor;
  for (const { t, at } of timed) {
    const minutes = eff(t);
    const start = Math.max(at, prevEnd);
    if (start >= toMin) {
      leftover.push(t);
      continue;
    }
    fixed.push({ task: t, start, end: start + minutes, minutes, fixed: true, current: false });
    prevEnd = start + minutes;
  }
  const fixedSet = new Set(fixed.map((f) => f.task));

  // Pack the rest in list order.
  const rest = open.filter((t) => t !== running && !fixedSet.has(t) && !leftover.includes(t));
  let fi = 0;
  for (const t of rest) {
    const minutes = eff(t);
    let done = false;
    while (fi < fixed.length) {
      const f = fixed[fi];
      if (cursor + minutes <= f.start) {
        placed.push({ task: t, start: cursor, end: cursor + minutes, minutes, fixed: false, current: false });
        cursor += minutes;
        done = true;
        break;
      }
      // Does not fit before this fixed block: jump past it, leaving the gap free.
      placed.push(f);
      cursor = Math.max(cursor, f.end);
      fi += 1;
    }
    if (done) continue;
    if (cursor + minutes <= toMin) {
      placed.push({ task: t, start: cursor, end: cursor + minutes, minutes, fixed: false, current: false });
      cursor += minutes;
    } else {
      leftover.push(t);
    }
  }
  while (fi < fixed.length) placed.push(fixed[fi++]);

  placed.sort((a, b) => a.start - b.start);

  // Free blocks from the gaps.
  type Gap = { start: number; end: number };
  const gaps: Gap[] = [];
  let at = fromMin;
  for (const p of placed) {
    if (p.start - at >= MIN_FREE) gaps.push({ start: at, end: p.start });
    at = Math.max(at, p.end);
  }
  if (toMin - at >= MIN_FREE) gaps.push({ start: at, end: toMin });

  const movable = (after: number) => [
    ...placed.filter((p) => !p.fixed && !p.current && p.start >= after).map((p) => p.task),
    ...leftover,
  ];

  const blocks: PlanBlock[] = [];
  const gapBlock = (g: Gap): PlanBlock => {
    const minutes = g.end - g.start;
    const cands = movable(g.end).filter((t) => eff(t) <= minutes);
    return { kind: "free", start: hhmm(g.start), end: hhmm(g.end), minutes, fits: cands.length === 1 ? cands[0] : null };
  };
  let gi = 0;
  for (const p of placed) {
    while (gi < gaps.length && gaps[gi].start < p.start) blocks.push(gapBlock(gaps[gi++]));
    blocks.push({
      kind: "task",
      task: p.task,
      start: hhmm(p.start),
      end: hhmm(p.end),
      minutes: p.minutes,
      fixed: p.fixed,
      current: p.current,
    });
  }
  while (gi < gaps.length) blocks.push(gapBlock(gaps[gi++]));

  return { label, from, to, blocks, leftover };
}
