import { randomUUID } from "node:crypto";
import { withTransaction } from "../db";
import type { Tx } from "../db";
import type { Gap, Segment, TrackingSettings } from "../types";
import { db, rowToSegment, type Q, type SegmentRow } from "./rows";
import { resolveTaskCategoryId } from "./task-category";

/** Thrown when a second segment would start while one is already running; APIs map it to 409. */
export class TimerConflict extends Error {
  constructor(readonly runningTaskId: string) {
    super("Another activity is already being timed");
  }
}

/** Thrown when a manual or backfilled segment would overlap one that already exists. */
export class SegmentOverlap extends Error {}

export type StartSegmentInput = {
  /** Ignored when `taskId` is set — the task's project decides, via resolveTaskCategoryId. */
  categoryId?: string;
  activityId?: string;
  taskId?: string;
  note?: string;
};

/**
 * A task-linked segment always gets its category from the task's project,
 * never from the client, so the dashboard's own category picker and a task's
 * own timer button can never disagree about where a session lands.
 */
async function resolveCategoryId(tx: Q, input: { categoryId?: string; taskId?: string }): Promise<string> {
  if (input.taskId) return resolveTaskCategoryId(input.taskId, tx);
  if (!input.categoryId) throw new Error("categoryId is required when taskId is not set");
  return input.categoryId;
}

export async function listSegments(fromISO: string, toISO: string): Promise<Segment[]> {
  const rows = await db.query<SegmentRow>(
    `select * from segments
      where started_at < $2 and coalesce(ended_at, now()) > $1
      order by started_at asc`,
    [fromISO, toISO],
  );
  return rows.map(rowToSegment);
}

export async function runningSegment(q: Q = db): Promise<Segment | null> {
  const rows = await q.query<SegmentRow>(`select * from segments where ended_at is null limit 1`);
  return rows.length ? rowToSegment(rows[0]) : null;
}

export async function getSegment(id: string, q: Q = db): Promise<Segment | null> {
  const rows = await q.query<SegmentRow>(`select * from segments where id = $1`, [id]);
  return rows.length ? rowToSegment(rows[0]) : null;
}

async function insertRunning(tx: Tx, input: StartSegmentInput): Promise<Segment> {
  const categoryId = await resolveCategoryId(tx, input);
  const rows = await tx.query<SegmentRow>(
    `insert into segments (id, started_at, category_id, activity_id, task_id, note, source, running_lock)
     values ($1, now(), $2, $3, $4, $5, 'timer', true)
     returning *`,
    [randomUUID(), categoryId, input.activityId ?? null, input.taskId ?? null, input.note ?? null],
  );
  return rowToSegment(rows[0]);
}

async function stopRunning(tx: Tx): Promise<Segment | null> {
  const rows = await tx.query<SegmentRow>(
    `update segments set ended_at = now(), running_lock = null, updated_at = now()
      where ended_at is null
      returning *`,
  );
  return rows.length ? rowToSegment(rows[0]) : null;
}

export async function startSegment(input: StartSegmentInput): Promise<Segment> {
  return withTransaction(async (tx) => {
    const running = await runningSegment(tx);
    if (running) throw new TimerConflict(running.taskId ?? "");
    return insertRunning(tx, input);
  });
}

/** One atomic hand-off, so the timeline is never briefly tracking nothing. */
export async function switchSegment(
  input: StartSegmentInput,
): Promise<{ stopped: Segment | null; started: Segment }> {
  return withTransaction(async (tx) => {
    const stopped = await stopRunning(tx);
    return { stopped, started: await insertRunning(tx, input) };
  });
}

export async function stopSegment(): Promise<Segment | null> {
  return withTransaction(stopRunning);
}

export async function addManualSegment(input: {
  startedAt: string;
  endedAt: string;
  /** Ignored when `taskId` is set — see resolveCategoryId. */
  categoryId?: string;
  activityId?: string;
  taskId?: string;
  note?: string;
}): Promise<Segment> {
  return withTransaction(async (tx) => {
    await assertNoOverlap(tx, input.startedAt, input.endedAt);
    const categoryId = await resolveCategoryId(tx, input);
    const rows = await tx.query<SegmentRow>(
      `insert into segments (id, started_at, ended_at, category_id, activity_id, task_id, note, source)
       values ($1, $2, $3, $4, $5, $6, $7, 'manual')
       returning *`,
      [
        randomUUID(),
        input.startedAt,
        input.endedAt,
        categoryId,
        input.activityId ?? null,
        input.taskId ?? null,
        input.note ?? null,
      ],
    );
    return rowToSegment(rows[0]);
  });
}

/** A manual backfill of an untracked gap — rejected if it would overlap an existing segment. */
export async function fillGap(input: {
  startedAt: string;
  endedAt: string;
  /** Ignored when `taskId` is set — see resolveCategoryId. */
  categoryId?: string;
  activityId?: string;
  taskId?: string;
  note?: string;
}): Promise<Segment> {
  return withTransaction(async (tx) => {
    await assertNoOverlap(tx, input.startedAt, input.endedAt);
    const categoryId = await resolveCategoryId(tx, input);
    // A task-linked backfill is never also an activity — same one-subject rule as a live segment.
    const activityId = input.taskId ? undefined : input.activityId;
    const rows = await tx.query<SegmentRow>(
      `insert into segments (id, started_at, ended_at, category_id, activity_id, task_id, note, source)
       values ($1, $2, $3, $4, $5, $6, $7, 'backfill')
       returning *`,
      [randomUUID(), input.startedAt, input.endedAt, categoryId, activityId ?? null, input.taskId ?? null, input.note ?? null],
    );
    return rowToSegment(rows[0]);
  });
}

async function assertNoOverlap(tx: Tx, startedAt: string, endedAt: string): Promise<void> {
  const overlapping = await tx.query<{ id: string }>(
    `select id from segments
      where tstzrange(started_at, coalesce(ended_at, now())) && tstzrange($1::timestamptz, $2::timestamptz)
      limit 1`,
    [startedAt, endedAt],
  );
  if (overlapping.length) throw new SegmentOverlap("This span overlaps a segment that's already tracked");
}

export async function updateSegment(
  id: string,
  patch: {
    startedAt?: string;
    endedAt?: string;
    categoryId?: string;
    activityId?: string;
    taskId?: string;
    note?: string;
  },
): Promise<Segment | null> {
  return withTransaction(async (tx) => {
    const existing = await getSegment(id, tx);
    if (!existing) return null;

    if (patch.startedAt !== undefined || patch.endedAt !== undefined) {
      const startedAt = patch.startedAt ?? existing.startedAt;
      const endedAt = patch.endedAt ?? existing.endedAt;
      if (endedAt) {
        const overlapping = await tx.query<{ id: string }>(
          `select id from segments
            where id <> $1
              and tstzrange(started_at, coalesce(ended_at, now())) && tstzrange($2::timestamptz, $3::timestamptz)
            limit 1`,
          [id, startedAt, endedAt],
        );
        if (overlapping.length) throw new SegmentOverlap("This span overlaps a segment that's already tracked");
      }
    }

    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (patch.startedAt !== undefined) {
      sets.push(`started_at = $${i++}`);
      vals.push(patch.startedAt);
    }
    if (patch.endedAt !== undefined) {
      sets.push(`ended_at = $${i++}`);
      vals.push(patch.endedAt);
    }
    if (patch.categoryId !== undefined) {
      sets.push(`category_id = $${i++}`);
      vals.push(patch.categoryId);
    }
    // Empty string is the "clear this relation" sentinel, same convention as tasks.ts.
    if (patch.activityId !== undefined) {
      sets.push(`activity_id = $${i++}`);
      vals.push(patch.activityId || null);
    }
    if (patch.taskId !== undefined) {
      sets.push(`task_id = $${i++}`);
      vals.push(patch.taskId || null);
    }
    if (patch.note !== undefined) {
      sets.push(`note = $${i++}`);
      vals.push(patch.note || null);
    }
    if (sets.length === 0) return existing;

    vals.push(id);
    const rows = await tx.query<SegmentRow>(
      `update segments set ${sets.join(", ")}, updated_at = now() where id = $${i} returning *`,
      vals,
    );
    return rows.length ? rowToSegment(rows[0]) : null;
  });
}

/**
 * Splits one segment at `at` into [started_at, at) (keeps the id) and
 * [at, original end) (new row, same subject). A running segment's running
 * state moves to the second half, so the single-timer index still holds.
 */
export async function splitSegmentAt(
  id: string,
  at: string,
): Promise<{ before: Segment; after: Segment } | null> {
  return withTransaction(async (tx) => {
    const existing = await getSegment(id, tx);
    if (!existing) return null;

    const atMs = new Date(at).getTime();
    const startMs = new Date(existing.startedAt).getTime();
    const endMs = existing.endedAt ? new Date(existing.endedAt).getTime() : Date.now();
    if (Number.isNaN(atMs) || atMs <= startMs || atMs >= endMs) {
      throw new SegmentOverlap("The split point must fall inside the segment");
    }

    const wasRunning = existing.endedAt === null;
    const beforeRows = await tx.query<SegmentRow>(
      `update segments set ended_at = $2::timestamptz, running_lock = null, updated_at = now()
        where id = $1 returning *`,
      [id, at],
    );
    const afterRows = await tx.query<SegmentRow>(
      `insert into segments (id, started_at, ended_at, category_id, activity_id, task_id, note, source, running_lock)
       values ($1, $2::timestamptz, $3, $4, $5, $6, $7, $8, $9)
       returning *`,
      [
        randomUUID(),
        at,
        wasRunning ? null : existing.endedAt,
        existing.categoryId,
        existing.activityId ?? null,
        existing.taskId ?? null,
        existing.note ?? null,
        existing.source,
        wasRunning ? true : null,
      ],
    );
    return { before: rowToSegment(beforeRows[0]), after: rowToSegment(afterRows[0]) };
  });
}

export async function deleteSegment(id: string): Promise<boolean> {
  const rows = await db.query<{ id: string }>(`delete from segments where id = $1 returning id`, [id]);
  return rows.length > 0;
}

/**
 * Recorded minutes per task, counting only finished segments — the running
 * one is shown separately so totals never move on their own.
 */
export async function recordedMinutesByTask(): Promise<Record<string, number>> {
  const rows = await db.query<{ task_id: string; total: string }>(
    `select task_id, sum(extract(epoch from (ended_at - started_at)) / 60) as total
       from segments
      where task_id is not null and ended_at is not null
      group by task_id`,
  );
  return Object.fromEntries(rows.map((r) => [r.task_id, Number(r.total)]));
}

function hourOnDay(dayISO: string, hour: number): Date {
  const [y, m, d] = dayISO.split("-").map(Number);
  return new Date(y, m - 1, d, hour, 0, 0, 0);
}

/**
 * Gaps are computed, never stored — that's what makes last night's untracked
 * span still visible tomorrow morning without anything having run overnight.
 * `dayISO` is the day the tracking window *starts* on: with a 04:00 day
 * boundary, a 1am session still belongs to the previous day.
 */
export async function findGaps(dayISO: string, settings: TrackingSettings): Promise<Gap[]> {
  const dayStart = hourOnDay(dayISO, settings.dayStartHour);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const wakeStart = hourOnDay(dayISO, settings.wakingStartHour);
  const wakeEnd = hourOnDay(dayISO, settings.wakingEndHour);

  const rows = await db.query<{ gap_start: string; gap_end: string }>(
    `with bounds as (select $1::timestamptz as day_start, $2::timestamptz as day_end),
          ordered as (
            select started_at, ended_at,
                   lag(ended_at) over (order by started_at) as prev_end
              from segments, bounds
             where started_at < bounds.day_end
               and coalesce(ended_at, now()) > bounds.day_start
          )
     select coalesce(prev_end, (select day_start from bounds)) as gap_start,
            started_at as gap_end
       from ordered
      where started_at > coalesce(prev_end, (select day_start from bounds))`,
    [dayStart.toISOString(), dayEnd.toISOString()],
  );

  const spans = rows.map((r) => ({ start: new Date(r.gap_start), end: new Date(r.gap_end) }));

  const [{ last_end, has_running }] = await db.query<{ last_end: string | null; has_running: boolean | null }>(
    `select max(ended_at) as last_end, bool_or(ended_at is null) as has_running
       from segments
      where started_at < $2 and coalesce(ended_at, now()) > $1`,
    [dayStart.toISOString(), dayEnd.toISOString()],
  );

  // Nothing untracked trails a currently-running segment — it covers up to now.
  if (!has_running) {
    const now = new Date();
    const trailingStart = last_end ? new Date(last_end) : dayStart;
    const trailingEnd = now < dayEnd ? now : dayEnd;
    if (trailingStart < trailingEnd) spans.push({ start: trailingStart, end: trailingEnd });
  }

  return spans
    .map((s) => ({
      start: s.start < wakeStart ? wakeStart : s.start,
      end: s.end > wakeEnd ? wakeEnd : s.end,
    }))
    .filter((s) => s.end.getTime() - s.start.getTime() >= settings.minGapMinutes * 60_000)
    .map((s) => ({
      startedAt: s.start.toISOString(),
      endedAt: s.end.toISOString(),
      minutes: Math.round((s.end.getTime() - s.start.getTime()) / 60_000),
    }))
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}
