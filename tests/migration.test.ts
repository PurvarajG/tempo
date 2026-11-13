import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { freshDb, type TestDb } from "./helpers/db";

let db: TestDb;

before(async () => {
  db = await freshDb();
});
after(async () => db.close());

/**
 * The interesting case is not a clean install — it's the upgrade landing on a
 * database that already has projects and tasks from before stages existed.
 */
async function seedLegacyData() {
  const projectId = randomUUID();
  await db.query(`insert into projects (id, name, color) values ($1, 'Legacy', '#0052ff')`, [
    projectId,
  ]);

  const openTask = randomUUID();
  const doneTask = randomUUID();
  const looseTask = randomUUID();
  await db.query(
    `insert into tasks (id, title, project_id, scheduled, minutes, priority, status)
     values ($1, 'Open one', $4, '2026-01-01', 30, 0, 'open'),
            ($2, 'Done one', $4, '2026-01-01', 30, 0, 'done'),
            ($3, 'No project', null, '2026-01-01', 30, 0, 'open')`,
    [openTask, doneTask, looseTask, projectId],
  );

  // Undo the upgrade for these rows so the backfill has real work to do.
  await db.query(`update tasks set stage_id = null where id = any($1)`, [
    [openTask, doneTask, looseTask],
  ]);
  await db.query(`delete from project_stages where project_id = $1`, [projectId]);

  return { projectId, openTask, doneTask, looseTask };
}

test("backfills default stages and assigns existing tasks", async () => {
  const seeded = await seedLegacyData();
  const { backfill } = await import("../lib/migrate");
  await db.withTransaction(backfill);

  const stages = await db.store.listStages(seeded.projectId);
  assert.deepEqual(
    stages.map((s) => s.kind),
    ["backlog", "active", "blocked", "done"],
  );

  const open = await db.store.getTask(seeded.openTask);
  const done = await db.store.getTask(seeded.doneTask);
  const loose = await db.store.getTask(seeded.looseTask);

  assert.equal(open?.stageId, stages[0].id, "open tasks land in the first column");
  assert.equal(done?.stageId, stages[3].id, "completed tasks land in Done");
  assert.equal(loose?.stageId, undefined, "tasks with no project stay unassigned");
});

test("re-running migration neither duplicates stages nor undoes customization", async () => {
  const { projectId } = await seedLegacyData();
  const { backfill } = await import("../lib/migrate");
  await db.withTransaction(backfill);

  const before = await db.store.listStages(projectId);
  await db.store.updateStage(before[0].id, { name: "Icebox" });
  await db.store.addStage(projectId, { name: "Review", kind: "active" });

  await db.withTransaction(backfill);
  await db.withTransaction(backfill);

  const after = await db.store.listStages(projectId);
  assert.equal(after.length, 5, "no duplicate default stages");
  assert.equal(after[0].name, "Icebox", "a renamed column stays renamed");
});

test("seeds exactly one general note", async () => {
  const { backfill } = await import("../lib/migrate");
  await db.withTransaction(backfill);
  await db.withTransaction(backfill);

  const rows = await db.query(`select id from general_note`);
  assert.equal(rows.length, 1);
  assert.equal((await db.store.getNote()).body, "");
});

test("stage_entered_at is backfilled from created_at for staged tasks only", async () => {
  const { backfill } = await import("../lib/migrate");
  const { projectId, openTask, looseTask } = await seedLegacyData();
  await db.withTransaction(backfill);

  const staged = (
    await db.query<{ ok: boolean }>(`select stage_entered_at = created_at as ok from tasks where id = $1`, [
      openTask,
    ])
  )[0];
  assert.equal(staged.ok, true, "staged task copies created_at");
  const loose = (
    await db.query<{ stage_entered_at: unknown }>(`select stage_entered_at from tasks where id = $1`, [looseTask])
  )[0];
  assert.equal(loose.stage_entered_at, null, "unstaged task stays null");

  // A value already set is never overwritten.
  await db.query(`update tasks set stage_entered_at = '2020-01-01T00:00:00Z' where id = $1`, [openTask]);
  await db.withTransaction(backfill);
  const kept = (
    await db.query<{ y: number }>(`select extract(year from stage_entered_at)::int as y from tasks where id = $1`, [
      openTask,
    ])
  )[0];
  assert.equal(kept.y, 2020);
  assert.ok(projectId);
});

test("task_links cascade when either task is deleted", async () => {
  const [a, b, c] = [randomUUID(), randomUUID(), randomUUID()];
  await db.query(
    `insert into tasks (id, title, scheduled, minutes, priority, status)
     values ($1,'A','2026-01-01',30,0,'open'), ($2,'B','2026-01-01',30,0,'open'), ($3,'C','2026-01-01',30,0,'open')`,
    [a, b, c],
  );
  const links = async () =>
    Number((await db.query<{ n: number }>(`select count(*)::int as n from task_links where blocker_id = any($1) or blocked_id = any($1)`, [[a, b, c]]))[0].n);

  await db.query(`insert into task_links (blocker_id, blocked_id) values ($1,$2), ($2,$3)`, [a, b, c]);
  assert.equal(await links(), 2);
  await db.query(`delete from tasks where id = $1`, [a]);
  assert.equal(await links(), 1, "deleting the blocker removes its link");
  await db.query(`delete from tasks where id = $1`, [c]);
  assert.equal(await links(), 0, "deleting the blocked task removes its link");
});

test("schema.sql plus backfill twice is a no-op", async () => {
  const { runMigrations } = await import("../lib/migrate");
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite("memory://");
  try {
    const driver: import("../lib/db").Driver = {
      async query(text: string, params: unknown[] = []) {
        return (await pg.query(text, params)).rows as never;
      },
      async exec(text: string) {
        await pg.exec(text);
      },
      async transaction<T>(fn: (tx: import("../lib/db").Tx) => Promise<T>) {
        return (await pg.transaction(async (t) =>
          fn({ query: async (text: string, params: unknown[] = []) => (await t.query(text, params)).rows as never }),
        )) as T;
      },
      async withMigrationLock<T>(fn: () => Promise<T>) {
        return fn();
      },
    };
    await runMigrations(driver);
    await pg.query(`insert into quick_todos (id, title) values ($1, 'Later')`, [randomUUID()]).catch(() => {});
    const snap = async () => ({
      tasks: (await pg.query(`select title, sort_order, scheduled from tasks order by title`)).rows,
      settings: (await pg.query(`select * from tracking_settings`)).rows,
      quick: (await pg.query(`select id from quick_todos order by id`)).rows,
    });
    const first = await snap();
    await runMigrations(driver);
    await runMigrations(driver);
    assert.deepEqual(await snap(), first);
  } finally {
    await pg.close();
  }
});
