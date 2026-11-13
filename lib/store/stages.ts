import { randomUUID } from "node:crypto";
import { withTransaction } from "../db";
import type { Tx } from "../db";
import { DEFAULT_STAGES, type ProjectStage, type StageInput, type StageKind } from "../types";
import { Invalid } from "../validate";
import { db, rowToStage, type Q, type StageRow } from "./rows";

/** Thrown when a request would break a board invariant; APIs map it to 409. */
export class StageConflict extends Error {}

/**
 * Open tasks sitting in a column, for the board header's "3 / 5" count.
 * The limit is soft: this never blocks a move.
 */
export function wipCount(tasks: { stageId?: string; status: string }[], stageId: string): number {
  return tasks.filter((t) => t.stageId === stageId && t.status === "open").length;
}

export async function listStages(projectId?: string): Promise<ProjectStage[]> {
  const rows = projectId
    ? await db.query<StageRow>(
        `select * from project_stages where project_id = $1 order by sort_order asc, created_at asc`,
        [projectId],
      )
    : await db.query<StageRow>(
        `select * from project_stages order by project_id, sort_order asc, created_at asc`,
      );
  return rows.map(rowToStage);
}

export async function getStage(id: string, q: Q = db): Promise<ProjectStage | null> {
  const rows = await q.query<StageRow>(`select * from project_stages where id = $1`, [id]);
  return rows.length ? rowToStage(rows[0]) : null;
}

async function stagesOf(q: Q, projectId: string): Promise<ProjectStage[]> {
  const rows = await q.query<StageRow>(
    `select * from project_stages where project_id = $1 order by sort_order asc, created_at asc`,
    [projectId],
  );
  return rows.map(rowToStage);
}

/** The column a completed task belongs in. Every project has exactly one. */
export async function doneStageOf(q: Q, projectId: string): Promise<ProjectStage | null> {
  const rows = await q.query<StageRow>(
    `select * from project_stages where project_id = $1 and kind = 'done' limit 1`,
    [projectId],
  );
  return rows.length ? rowToStage(rows[0]) : null;
}

/** Where a task lands when it is created, or reopened out of Done. */
export async function firstOpenStageOf(q: Q, projectId: string): Promise<ProjectStage | null> {
  const rows = await q.query<StageRow>(
    `select * from project_stages where project_id = $1 and kind <> 'done'
      order by sort_order asc, created_at asc limit 1`,
    [projectId],
  );
  return rows.length ? rowToStage(rows[0]) : null;
}

export async function createDefaultStages(tx: Tx, projectId: string): Promise<ProjectStage[]> {
  const created: ProjectStage[] = [];
  for (const [i, stage] of DEFAULT_STAGES.entries()) {
    const rows = await tx.query<StageRow>(
      `insert into project_stages (id, project_id, name, kind, sort_order)
       values ($1,$2,$3,$4,$5) returning *`,
      [randomUUID(), projectId, stage.name, stage.kind, i],
    );
    created.push(rowToStage(rows[0]));
  }
  return created;
}

export async function addStage(projectId: string, input: StageInput): Promise<ProjectStage> {
  return withTransaction(async (tx) => {
    if (input.kind === "done" && (await doneStageOf(tx, projectId))) {
      throw new StageConflict("This project already has a done column");
    }
    const rows = await tx.query<StageRow>(
      `insert into project_stages (id, project_id, name, kind, sort_order)
       values ($1,$2,$3,$4,
         coalesce((select max(sort_order)+1 from project_stages where project_id=$2), 0))
       returning *`,
      [randomUUID(), projectId, input.name, input.kind],
    );
    return rowToStage(rows[0]);
  });
}

export async function updateStage(
  id: string,
  patch: Partial<StageInput> & { wipLimit?: number | null },
): Promise<ProjectStage | null> {
  // Invalid (from ../validate, no import cycle) is already mapped to 400 by lib/api.
  if (patch.wipLimit !== undefined && patch.wipLimit !== null) {
    if (!Number.isInteger(patch.wipLimit) || patch.wipLimit < 1) {
      throw new Invalid("wipLimit must be a whole number of at least 1, or null");
    }
  }
  return withTransaction(async (tx) => {
    const stage = await getStage(id, tx);
    if (!stage) return null;

    if (patch.kind !== undefined && patch.kind !== stage.kind) {
      await assertKindChangeAllowed(tx, stage, patch.kind);
    }

    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (patch.name !== undefined) {
      sets.push(`name = $${i++}`);
      vals.push(patch.name);
    }
    if (patch.kind !== undefined) {
      sets.push(`kind = $${i++}`);
      vals.push(patch.kind);
    }
    if (patch.wipLimit !== undefined) {
      sets.push(`wip_limit = $${i++}`);
      vals.push(patch.wipLimit);
    }
    if (sets.length === 0) return stage;

    vals.push(id);
    const rows = await tx.query<StageRow>(
      `update project_stages set ${sets.join(", ")} where id = $${i} returning *`,
      vals,
    );
    return rows.length ? rowToStage(rows[0]) : null;
  });
}

/**
 * A project must keep exactly one done column and at least one column that is
 * not done, so neither "everything is finished" nor "nothing can finish" is
 * reachable by re-typing a column.
 */
async function assertKindChangeAllowed(
  tx: Tx,
  stage: ProjectStage,
  kind: StageKind,
): Promise<void> {
  const siblings = await stagesOf(tx, stage.projectId);
  if (kind === "done" && siblings.some((s) => s.kind === "done" && s.id !== stage.id)) {
    throw new StageConflict("This project already has a done column");
  }
  if (stage.kind === "done" && kind !== "done") {
    throw new StageConflict("A project needs a done column");
  }
  if (kind === "done" && !siblings.some((s) => s.kind !== "done" && s.id !== stage.id)) {
    throw new StageConflict("A project needs at least one column that isn't done");
  }
}

export async function reorderStages(projectId: string, orderedIds: string[]): Promise<void> {
  await withTransaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.query(
        `update project_stages set sort_order = $1 where id = $2 and project_id = $3`,
        [i, orderedIds[i], projectId],
      );
    }
  });
}

/**
 * Removing a column never destroys work: its tasks move to `destinationId`
 * first, in the same transaction. Tasks landing in Done are completed and
 * tasks leaving Done are reopened, so board state and status cannot diverge.
 */
export async function removeStage(id: string, destinationId: string): Promise<boolean> {
  return withTransaction(async (tx) => {
    const stage = await getStage(id, tx);
    if (!stage) return false;
    if (destinationId === id) throw new StageConflict("Pick a different column to move tasks to");

    const destination = await getStage(destinationId, tx);
    if (!destination || destination.projectId !== stage.projectId) {
      throw new StageConflict("Tasks can only move to another column in this project");
    }

    const siblings = await stagesOf(tx, stage.projectId);
    if (stage.kind === "done") throw new StageConflict("A project needs a done column");
    if (!siblings.some((s) => s.kind !== "done" && s.id !== id)) {
      throw new StageConflict("A project needs at least one column that isn't done");
    }

    await moveTasksToStage(tx, id, destination);
    await tx.query(`delete from project_stages where id = $1`, [id]);
    return true;
  });
}

/** Shared by stage removal and project deletion: relocate tasks, fixing status. */
export async function moveTasksToStage(
  tx: Tx,
  fromStageId: string,
  destination: ProjectStage,
): Promise<void> {
  // The large offset parks incoming tasks behind whatever is already in the
  // destination; renumberStage then collapses both groups back to 0..n-1.
  const statusFix =
    destination.kind === "done"
      ? `status = case when status = 'trashed' then status else 'done' end,
         completed_at = case when status = 'trashed' then completed_at
                             else coalesce(completed_at, now()) end`
      : `status = case when status = 'done' then 'open' else status end,
         completed_at = case when status = 'done' then null else completed_at end`;

  await tx.query(
    `update tasks
        set stage_id = $2, board_order = board_order + 1000000,
            stage_entered_at = now(), ${statusFix}
      where stage_id = $1 and stage_id <> $2`,
    [fromStageId, destination.id],
  );
  await renumberStage(tx, destination.id);
}

/** Collapses a column's board_order back to a dense 0..n-1 in its current order. */
export async function renumberStage(tx: Tx, stageId: string): Promise<void> {
  await tx.query(
    `update tasks t set board_order = o.rn - 1
       from (
         select id, row_number() over (order by board_order asc, created_at asc) as rn
           from tasks where stage_id = $1
       ) o
      where t.id = o.id`,
    [stageId],
  );
}
