import { randomUUID } from "node:crypto";
import { withTransaction } from "../db";
import type { Tx } from "../db";
import { addDays, daysBetween, nextOccurrence, toISODate } from "../parse";
import type { Subtask, Task, TaskInput } from "../types";
import {
  db,
  hydrate,
  rowToSubtask,
  type Q,
  type SubtaskRow,
  type TaskRow,
} from "./rows";
import { doneStageOf, firstOpenStageOf, getStage, renumberStage } from "./stages";

/** Thrown when a patch would put a task in another project's column; APIs map it to 400. */
export class TaskInvariantError extends Error {}

export async function allTasks(): Promise<Task[]> {
  const rows = await db.query<TaskRow>(
    `select * from tasks where status <> 'trashed' order by sort_order asc, created_at asc`,
  );
  return hydrate(db, rows);
}

export async function trashedTasks(): Promise<Task[]> {
  const rows = await db.query<TaskRow>(
    `select * from tasks where status = 'trashed' order by deleted_at desc`,
  );
  return hydrate(db, rows);
}

export async function getTask(id: string, q: Q = db): Promise<Task | null> {
  const rows = await q.query<TaskRow>(`select * from tasks where id = $1`, [id]);
  if (rows.length === 0) return null;
  return (await hydrate(q, rows))[0];
}

export async function search(q: string): Promise<Task[]> {
  const rows = await db.query<TaskRow>(
    `select * from tasks
      where status <> 'trashed' and (title ilike $1 or notes ilike $1 or $2 = any(tags))
      order by scheduled asc nulls last`,
    [`%${q}%`, q.toLowerCase()],
  );
  return hydrate(db, rows);
}

/** Resolves the column a task should sit in, rejecting cross-project columns. */
async function resolveStage(
  tx: Tx,
  projectId: string | undefined,
  stageId: string | undefined,
): Promise<string | null> {
  if (!projectId) return null;
  if (stageId) {
    const stage = await getStage(stageId, tx);
    if (!stage || stage.projectId !== projectId) {
      throw new TaskInvariantError("That column belongs to a different project");
    }
    return stage.id;
  }
  return (await firstOpenStageOf(tx, projectId))?.id ?? null;
}

/**
 * A complex task's finish date must be on or after its scheduled start; a
 * non-complex task never carries a finish date. `dueTime` doesn't apply to a
 * multi-day span, so it's cleared whenever the task is complex.
 */
function resolveComplex(
  isComplex: boolean,
  scheduled: string | null,
  finishDate: string | undefined,
  dueTime: string | undefined,
): { finishDate: string | undefined; dueTime: string | undefined } {
  if (!isComplex) return { finishDate: undefined, dueTime };
  if (!scheduled) {
    throw new TaskInvariantError("A complex task needs a scheduled date");
  }
  if (!finishDate || finishDate < scheduled) {
    throw new TaskInvariantError("finishDate must be on or after scheduled for a complex task");
  }
  return { finishDate, dueTime: undefined };
}

function checkWindow(startOn: string | null | undefined, expiresOn: string | null | undefined) {
  if (startOn && expiresOn && expiresOn < startOn) {
    throw new TaskInvariantError("expiresOn must be on or after startOn");
  }
}

async function insertTask(tx: Tx, input: TaskInput): Promise<Task> {
  const stageId = await resolveStage(tx, input.projectId, input.stageId);
  const isComplex = input.isComplex ?? false;
  const scheduled = input.scheduled ?? null;
  const resolved = resolveComplex(isComplex, scheduled, input.finishDate, input.dueTime);
  checkWindow(input.startOn, input.expiresOn);
  const rows = await tx.query<TaskRow>(
    `insert into tasks
       (id, title, notes, project_id, stage_id, tags, scheduled, due_time, minutes,
        priority, status, recurrence, sort_order, board_order, is_complex, finish_date,
        committed_on, start_on, expires_on, stage_entered_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'open',$11,
       coalesce((select max(sort_order) + 1 from tasks), 0),
       coalesce((select max(board_order) + 1 from tasks where stage_id = $5), 0),
       $12, $13, $14, $15, $16,
       case when $5::uuid is null then null else now() end)
     returning *`,
    [
      randomUUID(),
      input.title,
      input.notes ?? null,
      input.projectId ?? null,
      stageId,
      input.tags ?? [],
      scheduled,
      resolved.dueTime ?? null,
      input.minutes,
      input.priority,
      input.recurrence ? JSON.stringify(input.recurrence) : null,
      isComplex,
      resolved.finishDate ?? null,
      input.committedOn ?? null,
      input.startOn ?? null,
      input.expiresOn ?? null,
    ],
  );
  return (await hydrate(tx, rows))[0];
}

export async function addTask(input: TaskInput): Promise<Task> {
  return withTransaction((tx) => insertTask(tx, input));
}

/** All-or-nothing batch create; tasks come back in input order. */
export async function addTasks(inputs: TaskInput[]): Promise<Task[]> {
  if (inputs.length === 0) return [];
  return withTransaction(async (tx) => {
    const out: Task[] = [];
    for (const input of inputs) out.push(await insertTask(tx, input));
    return out;
  });
}

/**
 * Moves every task to `day` (null = back to the inbox) in one transaction.
 * Complex tasks keep their span length; a committed task that no longer sits
 * on its committed day is uncommitted. Unknown ids are skipped.
 */
export async function rescheduleTasks(ids: string[], day: string | null): Promise<Task[]> {
  if (ids.length === 0) return [];
  return withTransaction(async (tx) => {
    const out: Task[] = [];
    for (const id of ids) {
      const current = await getTask(id, tx);
      if (!current) continue;
      let finish: string | null = current.finishDate ?? null;
      if (current.isComplex) {
        if (day === null) {
          throw new TaskInvariantError("A complex task needs a scheduled date");
        }
        if (current.scheduled && finish) {
          finish = addDays(finish, daysBetween(current.scheduled, day));
        }
      }
      const rows = await tx.query<TaskRow>(
        `update tasks
            set scheduled = $2, finish_date = $3,
                committed_on = case when committed_on = $2::date then committed_on else null end
          where id = $1
          returning *`,
        [id, day, current.isComplex ? finish : (current.finishDate ?? null)],
      );
      if (rows.length) out.push((await hydrate(tx, rows))[0]);
    }
    return out;
  });
}

/** The day is full; the caller offers "Swap with..." using `committed`. */
export class CommitCapReached extends Error {
  committed: Task[];
  constructor(message: string, committed: Task[]) {
    super(message);
    this.name = "CommitCapReached";
    this.committed = committed;
  }
}

export async function commitTask(id: string, day: string): Promise<Task | null> {
  return withTransaction(async (tx) => {
    const task = await getTask(id, tx);
    if (!task) return null;
    if (task.committedOn === day && task.status === "open") return task;

    const capRows = await tx.query<{ today_cap: number | null }>(
      `select today_cap from tracking_settings limit 1`,
    );
    const cap = capRows[0]?.today_cap ?? 3;
    const others = await tx.query<TaskRow>(
      `select * from tasks
        where status = 'open' and committed_on = $1 and id <> $2
        order by sort_order asc, created_at asc`,
      [day, id],
    );
    if (others.length >= cap) {
      throw new CommitCapReached(
        `Already ${others.length} committed for ${day}`,
        await hydrate(tx, others),
      );
    }
    const rows = await tx.query<TaskRow>(
      `update tasks set committed_on = $2 where id = $1 returning *`,
      [id, day],
    );
    return (await hydrate(tx, rows))[0];
  });
}

export async function uncommitTask(id: string): Promise<Task | null> {
  const rows = await db.query<TaskRow>(
    `update tasks set committed_on = null where id = $1 returning *`,
    [id],
  );
  if (rows.length === 0) return null;
  return (await hydrate(db, rows))[0];
}

/** Trashes open tasks whose expiry day has arrived; returns them for the review's undo list. */
export async function expireDueTasks(todayISO: string): Promise<Task[]> {
  return withTransaction(async (tx) => {
    const rows = await tx.query<TaskRow>(
      `update tasks set status = 'trashed', deleted_at = now()
        where status = 'open' and expires_on is not null and expires_on <= $1
        returning *`,
      [todayISO],
    );
    return hydrate(tx, rows);
  });
}

/**
 * One patch path for every surface. Project, stage, and status are kept
 * consistent here so no caller can produce a task that is "done" outside the
 * done column, or sitting in a column of a project it no longer belongs to.
 */
export async function updateTask(id: string, patch: Partial<TaskInput>): Promise<Task | null> {
  return withTransaction(async (tx) => {
    const current = await getTask(id, tx);
    if (!current) return null;

    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    const col = (name: string, value: unknown) => {
      sets.push(`${name} = $${i++}`);
      vals.push(value);
    };

    if (patch.title !== undefined) col("title", patch.title);
    if (patch.notes !== undefined) col("notes", patch.notes || null);
    if (patch.tags !== undefined) col("tags", patch.tags);
    if (patch.scheduled !== undefined) col("scheduled", patch.scheduled);
    if (patch.committedOn !== undefined) col("committed_on", patch.committedOn);
    if (patch.startOn !== undefined) col("start_on", patch.startOn);
    if (patch.expiresOn !== undefined) col("expires_on", patch.expiresOn);
    if (patch.startOn !== undefined || patch.expiresOn !== undefined) {
      checkWindow(
        patch.startOn !== undefined ? patch.startOn : current.startOn,
        patch.expiresOn !== undefined ? patch.expiresOn : current.expiresOn,
      );
    }
    if (patch.minutes !== undefined) col("minutes", patch.minutes);
    if (patch.priority !== undefined) col("priority", patch.priority);
    if (patch.recurrence !== undefined)
      col("recurrence", patch.recurrence ? JSON.stringify(patch.recurrence) : null);

    // The complex-task range and the due-time it displaces are kept
    // consistent as one unit, same pattern as the project/stage block below.
    if (patch.isComplex !== undefined || patch.finishDate !== undefined || patch.dueTime !== undefined) {
      const isComplex = patch.isComplex !== undefined ? patch.isComplex : current.isComplex;
      const scheduled = patch.scheduled !== undefined ? patch.scheduled : current.scheduled;
      const finishDate = patch.finishDate !== undefined ? patch.finishDate : current.finishDate;
      const dueTime = patch.dueTime !== undefined ? patch.dueTime || undefined : current.dueTime;
      const resolved = resolveComplex(isComplex, scheduled, finishDate, dueTime);

      if (patch.isComplex !== undefined) col("is_complex", isComplex);
      if (resolved.finishDate !== current.finishDate) col("finish_date", resolved.finishDate ?? null);
      if (resolved.dueTime !== current.dueTime) col("due_time", resolved.dueTime ?? null);
    } else if (patch.scheduled !== undefined && current.isComplex) {
      // Re-check the range invariant when only the start day moves.
      resolveComplex(true, patch.scheduled, current.finishDate, current.dueTime);
    }

    const projectChanged = patch.projectId !== undefined && (patch.projectId || undefined) !== current.projectId;
    const stageChanged = patch.stageId !== undefined && (patch.stageId || undefined) !== current.stageId;

    if (projectChanged || stageChanged) {
      const projectId = patch.projectId !== undefined ? patch.projectId || undefined : current.projectId;
      // Changing project discards the old column: the new project's first open
      // column is the default unless the caller named one explicitly.
      const stageId = await resolveStage(
        tx,
        projectId,
        projectChanged && !patch.stageId ? undefined : patch.stageId || undefined,
      );
      col("project_id", projectId ?? null);
      col("stage_id", stageId);
      if (stageId !== (current.stageId ?? null)) {
        sets.push(stageId ? `stage_entered_at = now()` : `stage_entered_at = null`);
      }
      col(
        "board_order",
        stageId
          ? (
              await tx.query<{ next: number }>(
                `select coalesce(max(board_order)+1, 0) as next from tasks where stage_id = $1`,
                [stageId],
              )
            )[0].next
          : 0,
      );

      // Landing in (or leaving) the done column is the same event as
      // completing (or reopening) the task.
      const doneStage = projectId ? await doneStageOf(tx, projectId) : null;
      if (stageId && doneStage && stageId === doneStage.id) {
        if (current.status !== "done") {
          col("status", "done");
          sets.push(`completed_at = now()`);
        }
      } else if (current.status === "done") {
        col("status", "open");
        sets.push(`completed_at = null`);
      }
    }

    if (sets.length === 0) return current;

    vals.push(id);
    const rows = await tx.query<TaskRow>(
      `update tasks set ${sets.join(", ")} where id = $${i} returning *`,
      vals,
    );
    if (rows.length === 0) return null;
    return (await hydrate(tx, rows))[0];
  });
}

/**
 * Kanban drop: place `id` at `index` within `stageId`, renumbering the column
 * so board order stays dense. Status follows the column, per updateTask.
 */
export async function moveTaskToStage(
  id: string,
  stageId: string,
  index: number,
): Promise<Task | null> {
  return withTransaction(async (tx) => {
    const task = await getTask(id, tx);
    if (!task) return null;

    const stage = await getStage(stageId, tx);
    if (!stage || !task.projectId || stage.projectId !== task.projectId) {
      throw new TaskInvariantError("That column belongs to a different project");
    }

    const from = task.stageId;
    const doneStage = await doneStageOf(tx, task.projectId);
    const landsInDone = doneStage?.id === stageId;

    const statusFix =
      landsInDone && task.status !== "done"
        ? `, status = 'done', completed_at = now()`
        : !landsInDone && task.status === "done"
          ? `, status = 'open', completed_at = null`
          : "";

    // Open a gap at `index`, drop the task into it, then close any gaps left
    // behind so both columns stay densely ordered.
    await tx.query(
      `update tasks set board_order = board_order + 1
        where stage_id = $1 and id <> $2 and board_order >= $3`,
      [stageId, id, index],
    );
    await tx.query(
      `update tasks set stage_id = $2, board_order = $3${statusFix}${
        from !== stageId ? `, stage_entered_at = now()` : ""
      } where id = $1`,
      [id, stageId, index],
    );
    await renumberStage(tx, stageId);
    if (from && from !== stageId) await renumberStage(tx, from);

    return getTask(id, tx);
  });
}

/** Marks done, moves to the done column, and spins up the next occurrence. */
export async function completeTask(id: string): Promise<{ task: Task; next: Task | null } | null> {
  const result = await withTransaction(async (tx) => {
    const task = await getTask(id, tx);
    if (!task) return null;

    const doneStage = task.projectId ? await doneStageOf(tx, task.projectId) : null;
    const rows = await tx.query<TaskRow>(
      `update tasks
          set status = 'done', completed_at = now(),
              stage_entered_at = case when $2::uuid is not null and stage_id is distinct from $2::uuid
                then now() else stage_entered_at end,
              stage_id = coalesce($2, stage_id),
              board_order = case when $2 is null then board_order
                else coalesce((select max(board_order)+1 from tasks where stage_id = $2), 0) end
        where id = $1
        returning *`,
      [id, doneStage?.id ?? null],
    );
    if (rows.length === 0) return null;
    return { task: (await hydrate(tx, rows))[0], recurrence: task };
  });

  if (!result) return null;

  // The follow-up occurrence is a normal create, so it picks up the project's
  // first open column the same way any other new task does.
  const source = result.recurrence;
  const today = toISODate(new Date());
  const next = source.recurrence
    ? await addTask({
        title: source.title,
        notes: source.notes,
        projectId: source.projectId,
        tags: source.tags,
        scheduled: nextOccurrence(source.scheduled ?? today, source.recurrence, today),
        dueTime: source.dueTime,
        minutes: source.minutes,
        priority: source.priority,
        recurrence: source.recurrence,
      })
    : null;

  return { task: result.task, next };
}

/** Reopening puts a project task back in the first column that isn't done. */
export async function reopenTask(id: string): Promise<Task | null> {
  return withTransaction(async (tx) => {
    const task = await getTask(id, tx);
    if (!task) return null;
    const stage = task.projectId ? await firstOpenStageOf(tx, task.projectId) : null;
    const rows = await tx.query<TaskRow>(
      `update tasks
          set status = 'open', completed_at = null,
              stage_entered_at = case when $2::uuid is not null and stage_id is distinct from $2::uuid
                then now() else stage_entered_at end,
              stage_id = coalesce($2, stage_id),
              board_order = case when $2 is null then board_order
                else coalesce((select max(board_order)+1 from tasks where stage_id = $2), 0) end
        where id = $1
        returning *`,
      [id, stage?.id ?? null],
    );
    if (rows.length === 0) return null;
    return (await hydrate(tx, rows))[0];
  });
}

export async function trashTask(id: string): Promise<boolean> {
  const rows = await db.query<TaskRow>(
    `update tasks set status = 'trashed', deleted_at = now() where id = $1 returning id`,
    [id],
  );
  return rows.length > 0;
}

export async function restoreTask(id: string): Promise<Task | null> {
  const rows = await db.query<TaskRow>(
    `update tasks set status = 'open', deleted_at = null where id = $1 returning *`,
    [id],
  );
  if (rows.length === 0) return null;
  return (await hydrate(db, rows))[0];
}

export async function deleteTaskForever(id: string): Promise<boolean> {
  const rows = await db.query<{ id: string }>(`delete from tasks where id = $1 returning id`, [id]);
  return rows.length > 0;
}

export async function reorderTasks(orderedIds: string[]): Promise<void> {
  await withTransaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.query(`update tasks set sort_order = $1 where id = $2`, [i, orderedIds[i]]);
    }
  });
}

// ── Subtasks ───────────────────────────────────────────────────────────────

export async function addSubtask(taskId: string, title: string): Promise<Subtask> {
  const rows = await db.query<SubtaskRow>(
    `insert into subtasks (id, task_id, title, sort_order)
     values ($1,$2,$3, coalesce((select max(sort_order)+1 from subtasks where task_id=$2), 0))
     returning *`,
    [randomUUID(), taskId, title],
  );
  return rowToSubtask(rows[0]);
}

export async function updateSubtask(
  id: string,
  patch: { title?: string; done?: boolean },
): Promise<Subtask | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (patch.title !== undefined) {
    sets.push(`title = $${i++}`);
    vals.push(patch.title);
  }
  if (patch.done !== undefined) {
    sets.push(`done = $${i++}`);
    vals.push(patch.done);
  }
  if (sets.length === 0) return null;
  vals.push(id);
  const rows = await db.query<SubtaskRow>(
    `update subtasks set ${sets.join(", ")} where id = $${i} returning *`,
    vals,
  );
  return rows.length ? rowToSubtask(rows[0]) : null;
}

export async function deleteSubtask(id: string): Promise<boolean> {
  const rows = await db.query<{ id: string }>(
    `delete from subtasks where id = $1 returning id`,
    [id],
  );
  return rows.length > 0;
}
