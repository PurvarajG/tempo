import { withTransaction } from "../db";
import { db } from "./rows";
import { TaskInvariantError } from "./tasks";

/** A link that points a task at itself or would close a loop; APIs map it to 400. */
export class LinkInvalid extends TaskInvariantError {}

/**
 * Record "blockerId blocks blockedId". Returns false when either task is
 * missing. A duplicate link is a no-op that still returns true.
 */
export async function linkBlocker(blockerId: string, blockedId: string): Promise<boolean> {
  if (blockerId === blockedId) throw new LinkInvalid("A task cannot block itself");
  return withTransaction(async (tx) => {
    const found = await tx.query<{ id: string }>(`select id from tasks where id = any($1::uuid[])`, [
      [blockerId, blockedId],
    ]);
    if (found.length < 2) return false;

    // Cycle: blockedId already (transitively) blocks blockerId.
    const loop = await tx.query<{ hit: number }>(
      `with recursive downstream(id) as (
         select blocked_id from task_links where blocker_id = $1
         union
         select l.blocked_id from task_links l join downstream d on l.blocker_id = d.id
       )
       select 1 as hit from downstream where id = $2 limit 1`,
      [blockedId, blockerId],
    );
    if (loop.length > 0) throw new LinkInvalid("That link would make the tasks block each other");

    await tx.query(
      `insert into task_links (blocker_id, blocked_id) values ($1, $2)
       on conflict (blocker_id, blocked_id) do nothing`,
      [blockerId, blockedId],
    );
    return true;
  });
}

export async function unlinkBlocker(blockerId: string, blockedId: string): Promise<boolean> {
  const rows = await db.query<{ blocker_id: string }>(
    `delete from task_links where blocker_id = $1 and blocked_id = $2 returning blocker_id`,
    [blockerId, blockedId],
  );
  return rows.length > 0;
}

/** Ids of open tasks that this task blocks. */
export async function blockedTasksOf(blockerId: string): Promise<string[]> {
  const rows = await db.query<{ id: string }>(
    `select t.id from task_links l join tasks t on t.id = l.blocked_id
     where l.blocker_id = $1 and t.status = 'open'
     order by t.sort_order asc, t.created_at asc`,
    [blockerId],
  );
  return rows.map((r) => r.id);
}
