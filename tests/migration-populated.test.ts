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
 * The release gate: the upgrade landing on a database with real volume, real
 * customisation, and every task state represented — then running again, the
 * way a cold start on Vercel would.
 */
test("a populated, customised database survives repeated migration", async () => {
  const projectIds = [randomUUID(), randomUUID(), randomUUID()];
  for (const [i, id] of projectIds.entries()) {
    await db.query(`insert into projects (id, name, color, sort_order) values ($1,$2,'#0052ff',$3)`, [
      id,
      `Project ${i}`,
      i,
    ]);
  }

  // 60 tasks spread across projects, states, and the no-project case.
  const taskIds: string[] = [];
  for (let i = 0; i < 60; i++) {
    const id = randomUUID();
    taskIds.push(id);
    const status = ["open", "done", "trashed"][i % 3];
    const projectId = i % 5 === 0 ? null : projectIds[i % projectIds.length];
    await db.query(
      `insert into tasks (id, title, project_id, scheduled, minutes, priority, status, completed_at)
       values ($1,$2,$3,'2026-01-15',30,0,$4,$5)`,
      [id, `Task ${i}`, projectId, status, status === "done" ? new Date().toISOString() : null],
    );
  }

  // Pre-upgrade shape: no stages, no stage assignments.
  await db.query(`delete from project_stages`);
  await db.query(`update tasks set stage_id = null`);

  const { backfill } = await import("../lib/migrate");
  await db.withTransaction(backfill);

  // A user then renames and adds columns, as they would.
  const first = await db.store.listStages(projectIds[0]);
  await db.store.updateStage(first[0].id, { name: "Someday" });
  await db.store.addStage(projectIds[0], { name: "In Review", kind: "active" });

  const snapshot = {
    tasks: (await db.query(`select count(*)::int as n from tasks`))[0],
    stages: (await db.query(`select count(*)::int as n from project_stages`))[0],
  };

  // Cold start, twice.
  await db.withTransaction(backfill);
  await db.withTransaction(backfill);

  assert.deepEqual(
    (await db.query(`select count(*)::int as n from tasks`))[0],
    snapshot.tasks,
    "no task is created or lost",
  );
  assert.deepEqual(
    (await db.query(`select count(*)::int as n from project_stages`))[0],
    snapshot.stages,
    "no duplicate columns",
  );

  const stagesAfter = await db.store.listStages(projectIds[0]);
  assert.equal(stagesAfter[0].name, "Someday", "the rename survives");
  assert.equal(stagesAfter.length, 5, "the added column survives");

  // Every project task has a column of its own project, and completed ones are
  // in Done.
  const misplaced = await db.query(
    `select t.id from tasks t
       join project_stages s on s.id = t.stage_id
      where s.project_id <> t.project_id`,
  );
  assert.equal(misplaced.length, 0, "no task sits in another project's column");

  const unassigned = await db.query(
    `select count(*)::int as n from tasks where project_id is not null and stage_id is null`,
  );
  assert.equal(unassigned[0].n, 0, "every project task has a column");

  const doneElsewhere = await db.query(
    `select count(*)::int as n from tasks t
       join project_stages s on s.id = t.stage_id
      where t.status = 'done' and s.kind <> 'done'`,
  );
  assert.equal(doneElsewhere[0].n, 0, "completed tasks are in a done column");

  const orphaned = await db.query(
    `select count(*)::int as n from tasks where project_id is null and stage_id is not null`,
  );
  assert.equal(orphaned[0].n, 0, "tasks with no project have no column");
});

test("the single-timer index holds after migration re-runs", async () => {
  const task = await db.store.addTask({
    title: "Timed",
    scheduled: "2026-03-01",
    minutes: 30,
    priority: 0,
  });

  await db.store.startTimer(task.id);
  const { backfill } = await import("../lib/migrate");
  await db.withTransaction(backfill);

  // Time is tracked in `segments` now — see lib/store/segments.ts.
  await assert.rejects(() =>
    db.query(
      `insert into segments (id, started_at, category_id, task_id, running_lock)
       values ($1, now(), (select id from categories limit 1), $2, true)`,
      [randomUUID(), task.id],
    ),
  );
  await db.store.stopTimer();
});

/**
 * A real v0.1.3 install (fixture frozen at commit dcfc75c) is opened through
 * the current driver, migrated on start, migrated again, and cold-started a
 * second time. Later phases add their own cases against the same fixture.
 */
test("a populated v0.1.3 fixture migrates twice without losing a row", async () => {
  const { rmSync } = await import("node:fs");
  const { loadV013Fixture } = await import("./fixtures/v013");
  const dbMod = await import("../lib/db");
  const { backfill } = await import("../lib/migrate");
  const savedDir = process.env.PGLITE_DIR;
  const { dir, counts } = await loadV013Fixture();

  // lib/db has no close(), and leaked PGlite instances keep the process alive,
  // so remember each one this case opens and close them at the end.
  const { PGlite } = await import("@electric-sql/pglite");
  const opened = new Set<{ close(): Promise<void> }>();
  const originalQuery = PGlite.prototype.query;
  PGlite.prototype.query = function (this: { close(): Promise<void> }, ...args: unknown[]) {
    opened.add(this);
    return (originalQuery as (...a: unknown[]) => unknown).apply(this, args);
  } as typeof PGlite.prototype.query;

  try {
    delete process.env.POSTGRES_URL;
    delete process.env.DATABASE_URL;
    process.env.PGLITE_DIR = dir;

    const count = async (table: string) =>
      Number((await dbMod.query<{ n: number }>(`select count(*)::int as n from ${table}`))[0].n);

    // Undone quick todos, counted from the fixture before any migration runs.
    const pre = new PGlite(dir);
    const undone = (await pre.query<{ n: number }>(`select count(*)::int as n from quick_todos where not done`))
      .rows[0].n;
    await pre.close();
    opened.delete(pre); // the query patch tracked it; it is already closed

    // First cold start: migration runs on the first query.
    dbMod.resetDriverForTests();
    await dbMod.query(`select 1`);
    await dbMod.withTransaction(backfill);

    // Second cold start: close the first instance, then reopen the same dir.
    for (const pg of opened) await pg.close();
    opened.clear();
    dbMod.resetDriverForTests();
    await dbMod.query(`select 1`);

    const untouched = ["projects", "time_entries", "segments", "quick_todos"];
    for (const [table, before] of Object.entries(counts)) {
      const now = await count(table);
      if (untouched.includes(table)) assert.equal(now, before, `${table} row count is unchanged`);
      else assert.ok(now >= before, `${table} lost rows: ${before} -> ${now}`);
    }
    // The named exception: the quick-list copy adds exactly the undone quick todos, once.
    assert.equal(await count("tasks"), counts.tasks + undone, "tasks grew by exactly the undone quick todos");
  } finally {
    PGlite.prototype.query = originalQuery;
    dbMod.resetDriverForTests();
    for (const pg of opened) await pg.close().catch(() => {});
    if (savedDir === undefined) delete process.env.PGLITE_DIR;
    else process.env.PGLITE_DIR = savedDir;
    rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * Phase 4A: the v2 schema and the quick-list copy land on a real v0.1.3
 * database. Undone quick todos become inbox tasks exactly once; nothing that
 * was there before moves.
 */
test("v2 schema and quick-list migration on the v0.1.3 fixture are additive and run once", async () => {
  const { rmSync } = await import("node:fs");
  const { loadV013Fixture } = await import("./fixtures/v013");
  const dbMod = await import("../lib/db");
  const { backfill } = await import("../lib/migrate");
  const savedDir = process.env.PGLITE_DIR;
  const { dir, counts } = await loadV013Fixture();

  const { PGlite } = await import("@electric-sql/pglite");
  const opened = new Set<{ close(): Promise<void> }>();
  const originalQuery = PGlite.prototype.query;
  PGlite.prototype.query = function (this: { close(): Promise<void> }, ...args: unknown[]) {
    opened.add(this);
    return (originalQuery as (...a: unknown[]) => unknown).apply(this, args);
  } as typeof PGlite.prototype.query;

  try {
    delete process.env.POSTGRES_URL;
    delete process.env.DATABASE_URL;
    process.env.PGLITE_DIR = dir;

    const count = async (table: string) =>
      Number((await dbMod.query<{ n: number }>(`select count(*)::int as n from ${table}`))[0].n);

    // Capture the pre-migration state straight from the fixture directory.
    const pre = new PGlite(dir);
    const preTasks = (
      await pre.query<{ id: string; scheduled: string }>(
        `select id, scheduled::text as scheduled from tasks`,
      )
    ).rows;
    const undone = (await pre.query<{ n: number }>(`select count(*)::int as n from quick_todos where not done`))
      .rows[0].n;
    await pre.close();
    assert.ok(undone > 0, "the fixture has undone quick todos");

    dbMod.resetDriverForTests();
    await dbMod.query(`select 1`); // schema.sql + first backfill (via runMigrations)
    await dbMod.withTransaction(backfill);
    const afterFirst = await count("tasks");
    await dbMod.withTransaction(backfill);
    await dbMod.withTransaction(backfill);

    assert.equal(afterFirst, counts.tasks + undone, "undone quick todos were copied");
    assert.equal(await count("tasks"), afterFirst, "re-running adds nothing");
    assert.equal(await count("quick_todos"), counts.quick_todos, "quick_todos is untouched");

    const now = await dbMod.query<{ id: string; scheduled: string | null }>(
      `select id, scheduled::text as scheduled from tasks`,
    );
    const byId = new Map(now.map((r) => [r.id, r.scheduled]));
    for (const t of preTasks) {
      assert.ok(byId.has(t.id), `task ${t.id} still exists`);
      assert.equal(byId.get(t.id), t.scheduled, `task ${t.id} keeps its date`);
    }
    const inbox = await dbMod.query<{ title: string; minutes: number }>(
      `select title, minutes from tasks where scheduled is null order by sort_order`,
    );
    assert.equal(inbox.length, undone);
    assert.equal(inbox[0].title, "Buy lamp oil", "quick-list order is kept");

    const cols = await dbMod.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_name = 'tasks'`,
    );
    for (const c of ["committed_on", "start_on", "expires_on", "stage_entered_at"]) {
      assert.ok(cols.some((r) => r.column_name === c), `tasks.${c} exists`);
    }
    assert.equal(await count("task_links"), 0);
    assert.equal(await count("day_reviews"), 0);

    const settings = await dbMod.query<Record<string, unknown>>(`select * from tracking_settings`);
    assert.equal(settings.length, 1);
    assert.equal(settings[0].today_cap, 3);
    assert.equal(settings[0].date_order, "dmy");
    assert.equal(settings[0].quick_todos_migrated, true);

    await dbMod.query(
      `insert into tasks (id, title, scheduled, minutes, priority, status) values ($1,'Undated',null,30,0,'open')`,
      [randomUUID()],
    );
    assert.equal(await count("tasks"), afterFirst + 1, "a task can be inserted with scheduled null");
  } finally {
    PGlite.prototype.query = originalQuery;
    dbMod.resetDriverForTests();
    for (const pg of opened) await pg.close().catch(() => {});
    if (savedDir === undefined) delete process.env.PGLITE_DIR;
    else process.env.PGLITE_DIR = savedDir;
    rmSync(dir, { recursive: true, force: true });
  }
});
