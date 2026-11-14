import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Driver, Tx } from "./db";
import {
  DEFAULT_ACTIVITIES,
  DEFAULT_CATEGORIES,
  DEFAULT_STAGES,
  FOCUS_WORK_CATEGORY_ID,
  GENERAL_NOTE_ID,
  TRACKING_SETTINGS_ID,
} from "./types";

/** The one default category with a fixed id — see FOCUS_WORK_CATEGORY_ID. */
const FIXED_CATEGORY_IDS: Record<string, string> = { "Focus Work": FOCUS_WORK_CATEGORY_ID };

function sql(file: string): string {
  return readFileSync(path.join(process.cwd(), "lib", file), "utf8");
}

/**
 * Startup migration, in three passes:
 *
 *   1. additive DDL that is safe on a populated database (schema.sql)
 *   2. backfill of rows the new model requires (this file)
 *   3. constraints that would have rejected the pre-backfill data
 *
 * Every step is guarded by "is this already true?" rather than by a version
 * number, so re-running never duplicates a stage, resets a renamed column, or
 * overwrites anything the user has customised.
 */
export async function runMigrations(driver: Driver): Promise<void> {
  // Held across all three passes: on Postgres, two instances running the
  // additive DDL at the same time deadlock on AccessExclusiveLock.
  await driver.withMigrationLock(async () => {
    await driver.exec(sql("schema.sql"));
    await driver.transaction(backfill);
    await driver.exec(sql("constraints.sql"));
  });
}

export async function backfill(tx: Tx): Promise<void> {
  await relaxTaskScheduledNotNull(tx);
  await backfillProjectStages(tx);
  await backfillTaskStages(tx);
  await seedGeneralNote(tx);
  await seedTrackingSettings(tx);
  await seedDefaultCategories(tx);
  await seedDefaultActivities(tx);
  await migrateTimeEntriesToSegments(tx);
  await backfillPinnedActivities(tx);
  await backfillCollapsedModules(tx);
  await backfillStageEnteredAt(tx);
  await migrateQuickTodosToInbox(tx);
}

/**
 * Relaxes a constraint (the plan's named 2.2 change: Task.scheduled becomes
 * nullable so an undated task can live in the inbox). Drops no data. Guarded by
 * information_schema so it only alters while the column is still NOT NULL, and
 * runs first so later steps may insert null-scheduled rows.
 */
async function relaxTaskScheduledNotNull(tx: Tx): Promise<void> {
  const col = await tx.query<{ is_nullable: string }>(
    `select is_nullable from information_schema.columns
      where table_schema = current_schema()
        and table_name = 'tasks' and column_name = 'scheduled'`,
  );
  if (col.length === 0 || col[0].is_nullable !== "NO") return;
  await tx.query(`alter table tasks alter column scheduled drop not null`);
}

/** Every project needs its four default stages — but only if it has none. */
async function backfillProjectStages(tx: Tx): Promise<void> {
  const projects = await tx.query<{ id: string }>(
    `select p.id from projects p
      where not exists (select 1 from project_stages s where s.project_id = p.id)`,
  );

  for (const project of projects) {
    for (const [i, stage] of DEFAULT_STAGES.entries()) {
      await tx.query(
        `insert into project_stages (id, project_id, name, kind, sort_order)
         values ($1, $2, $3, $4, $5)`,
        [randomUUID(), project.id, stage.name, stage.kind, i],
      );
    }
  }
}

/**
 * Existing project tasks land in Done if they are already completed and in the
 * first non-done stage otherwise. Tasks with no project keep no stage.
 */
async function backfillTaskStages(tx: Tx): Promise<void> {
  await tx.query(
    `update tasks t set stage_id = s.id
       from project_stages s
      where t.stage_id is null
        and t.project_id is not null
        and s.project_id = t.project_id
        and s.kind = 'done'
        and t.status = 'done'`,
  );

  await tx.query(
    `update tasks t set stage_id = s.id
       from (
         select distinct on (project_id) project_id, id
           from project_stages
          where kind <> 'done'
          order by project_id, sort_order asc, created_at asc
       ) s
      where t.stage_id is null
        and t.project_id is not null
        and s.project_id = t.project_id
        and t.status <> 'done'`,
  );
}

async function seedGeneralNote(tx: Tx): Promise<void> {
  await tx.query(
    `insert into general_note (id, body) values ($1, '')
     on conflict (id) do nothing`,
    [GENERAL_NOTE_ID],
  );
}

async function seedTrackingSettings(tx: Tx): Promise<void> {
  await tx.query(
    `insert into tracking_settings (id) values ($1)
     on conflict (id) do nothing`,
    [TRACKING_SETTINGS_ID],
  );
}

/** Starting points only — the user can rename, recolour, or delete any of them. */
async function seedDefaultCategories(tx: Tx): Promise<void> {
  const existing = await tx.query<{ n: number }>(`select count(*)::int as n from categories`);
  if (existing[0].n > 0) return;

  for (const [i, category] of DEFAULT_CATEGORIES.entries()) {
    await tx.query(
      `insert into categories (id, name, color, kind, sort_order)
       values ($1, $2, $3, $4, $5)`,
      [FIXED_CATEGORY_IDS[category.name] ?? randomUUID(), category.name, category.color, category.kind, i],
    );
  }
}

/** Only for categories that have no activities yet, so a user's own additions never get clobbered. */
async function seedDefaultActivities(tx: Tx): Promise<void> {
  const categories = await tx.query<{ id: string; name: string }>(
    `select c.id, c.name from categories c
      where not exists (select 1 from activities a where a.category_id = c.id)`,
  );

  for (const category of categories) {
    const presets = DEFAULT_ACTIVITIES[category.name];
    if (!presets) continue;
    for (const [i, name] of presets.entries()) {
      await tx.query(
        `insert into activities (id, category_id, name, is_preset, pinned, sort_order)
         values ($1, $2, $3, true, $4, $5)`,
        [randomUUID(), category.id, name, i === 0, i],
      );
    }
  }
}

/**
 * Existing installs get `pinned = false` on every row from the column
 * default, which would render an empty pinned row on the NOW card. Run once:
 * if nothing is pinned anywhere yet, pin the lowest-sort_order preset
 * activity per category.
 */
async function backfillPinnedActivities(tx: Tx): Promise<void> {
  const pinned = await tx.query<{ n: number }>(`select count(*)::int as n from activities where pinned`);
  if (pinned[0].n > 0) return;

  await tx.query(
    `update activities a set pinned = true
       from (
         select distinct on (category_id) id
           from activities
          where is_preset and not archived
          order by category_id, sort_order asc, created_at asc
       ) first
      where a.id = first.id`,
  );
}

/**
 * Existing installs get `collapsed_modules = '{}'` from the column default
 * that predates this phase — the schema.sql default only reaches a brand
 * new row, not one that already exists — so RECORDS/ROLL-UPS/SIGNALS would
 * otherwise stay expanded forever on every install that isn't a fresh
 * database.
 *
 * Two separate guards, for two separate risks:
 *
 *   - `collapsed_modules_seeded` (a flag, not a re-derivable check) makes
 *     this run at most once per row, ever. This migration reruns on every
 *     app launch (see runMigrations), and "is collapsed_modules still
 *     empty?" can't tell a never-touched row apart from a user who has
 *     since expanded every module back out — gating on emptiness alone
 *     would re-collapse their choice on their very next launch.
 *   - The `case` below only WRITES the default when collapsed_modules is
 *     still empty at the moment this fires. A user who upgraded having
 *     already collapsed something of their own (say, just `{ribbon}`)
 *     must not have that replaced by the three-module default — this is
 *     "collapsed by default for a FIRST-RUN user" (plan §6), not "collapsed
 *     by default for everyone who hasn't touched RECORDS/ROLL-UPS/SIGNALS
 *     specifically". Either way the row is marked seeded so this never
 *     reconsiders it again, honouring the invariant at the top of this file:
 *     re-running a migration never overwrites anything the user customised.
 *
 * A brand-new row (schema.sql) is seeded true immediately, so only a
 * genuinely pre-existing row ever reaches the UPDATE below.
 */
async function backfillCollapsedModules(tx: Tx): Promise<void> {
  await tx.query(
    `update tracking_settings
        set collapsed_modules = case
              when cardinality(collapsed_modules) = 0
                then array['records','rollups','signals']
              else collapsed_modules
            end,
            collapsed_modules_seeded = true
      where id = $1 and not collapsed_modules_seeded`,
    [TRACKING_SETTINGS_ID],
  );
}

/**
 * Superseded by `segments`, but existing time_entries rows must land there
 * once — reusing the same id keeps the migration idempotent, and the fixed
 * Focus Work category id gives every migrated row somewhere to roll up.
 */
async function migrateTimeEntriesToSegments(tx: Tx): Promise<void> {
  await tx.query(
    `insert into segments (id, started_at, ended_at, category_id, task_id, note, source, running_lock, created_at, updated_at)
     select t.id, t.started_at,
            coalesce(t.ended_at, t.started_at + make_interval(mins => t.minutes)),
            $1,
            t.task_id, t.note, 'timer',
            case when t.ended_at is null then true else null end,
            t.created_at, t.updated_at
       from time_entries t
      where not exists (select 1 from segments s where s.id = t.id)`,
    [FOCUS_WORK_CATEGORY_ID],
  );
}

/**
 * `stage_entered_at` is new, so every already-staged task has it null. The
 * best available answer for "when did it enter its stage" is when it was
 * created. Only null rows are touched, so a value the store has since set is
 * never overwritten and re-running is a no-op.
 */
async function backfillStageEnteredAt(tx: Tx): Promise<void> {
  await tx.query(
    `update tasks set stage_entered_at = created_at
      where stage_entered_at is null and stage_id is not null`,
  );
}

/**
 * Copies each undone quick_todos row into tasks as an undated inbox task,
 * once. Guarded by `tracking_settings.quick_todos_migrated` (a flag, not a
 * "does it exist already?" check, so a user who later deletes the inbox copy
 * never gets it back). The quick_todos table and its rows are left alone:
 * the quick list keeps working until it is retired. Done quick todos are not
 * copied. New tasks are appended after the current max sort_order in quick
 * list order and keep the quick todo's created_at.
 */
async function migrateQuickTodosToInbox(tx: Tx): Promise<void> {
  const flag = await tx.query<{ quick_todos_migrated: boolean }>(
    `select quick_todos_migrated from tracking_settings where id = $1`,
    [TRACKING_SETTINGS_ID],
  );
  if (flag.length === 0 || flag[0].quick_todos_migrated) return;

  const todos = await tx.query<{ title: string; created_at: string | Date }>(
    `select title, created_at from quick_todos
      where not done order by sort_order asc, created_at asc`,
  );
  const max = await tx.query<{ n: number }>(`select coalesce(max(sort_order), -1)::int as n from tasks`);
  let order = max[0].n + 1;

  for (const todo of todos) {
    await tx.query(
      `insert into tasks (id, title, scheduled, minutes, priority, status, tags, sort_order, created_at)
       values ($1, $2, null, 30, 0, 'open', '{}', $3, $4)`,
      [randomUUID(), todo.title, order++, todo.created_at],
    );
  }

  await tx.query(`update tracking_settings set quick_todos_migrated = true where id = $1`, [
    TRACKING_SETTINGS_ID,
  ]);
}
