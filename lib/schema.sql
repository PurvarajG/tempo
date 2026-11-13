-- Idempotent: runs on every cold start, so everything is IF NOT EXISTS.
-- IDs are generated in application code (crypto.randomUUID()), not by the
-- database, so this schema has zero dependency on pgcrypto/uuid-ossp being
-- installed — it works unmodified on Vercel Postgres, Neon, Supabase, or the
-- embedded PGlite fallback used for local dev.
--
-- This file is DDL only, and only DDL that is safe against a populated
-- database: new columns are nullable or defaulted, never NOT NULL without a
-- default. Anything that needs existing rows to be correct first (default
-- stages, stage assignment) lives in lib/migrate.ts and runs after this, with
-- the post-backfill constraints applied last.

create table if not exists projects (
  id uuid primary key,
  name text not null,
  color text not null default '#0052ff',
  archived boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key,
  title text not null,
  notes text,
  project_id uuid references projects(id) on delete set null,
  tags text[] not null default '{}',
  scheduled date not null,
  due_time text,
  minutes integer not null default 30,
  priority integer not null default 0,
  status text not null default 'open',
  recurrence jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  deleted_at timestamptz
);

create table if not exists subtasks (
  id uuid primary key,
  task_id uuid not null references tasks(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ── Workspace upgrade ──────────────────────────────────────────────────────

-- Kanban columns. `kind` carries the semantics (progress, blocked, done) so a
-- renamed column never desyncs a summary; `name` is purely what the user sees.
create table if not exists project_stages (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  kind text not null default 'active',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table tasks add column if not exists stage_id uuid references project_stages(id) on delete set null;
alter table tasks add column if not exists board_order integer not null default 0;

-- Multi-day task deadlines: an optional start->finish range, gated behind
-- is_complex so ordinary single-day tasks are unaffected. The range invariant
-- (finish_date >= scheduled) is enforced in the store layer, not here.
alter table tasks add column if not exists is_complex boolean not null default false;
alter table tasks add column if not exists finish_date date;

-- Exactly one general note, for the single owner.
create table if not exists general_note (
  id text primary key,
  body text not null default '',
  updated_at timestamptz not null default now()
);

-- Deliberately not tasks: a scratch checklist that can graduate into a task.
create table if not exists quick_todos (
  id uuid primary key,
  title text not null,
  done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- `running_lock` is true while running and NULL once stopped. A plain unique
-- index over it therefore permits at most one running entry (NULLs never
-- collide), enforcing the single-timer rule in the database rather than in
-- client state. Portable to both Postgres and PGlite.
create table if not exists time_entries (
  id uuid primary key,
  task_id uuid not null references tasks(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  minutes integer,
  note text,
  running_lock boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_scheduled_idx on tasks (scheduled);
create index if not exists tasks_status_idx on tasks (status);
create index if not exists tasks_project_idx on tasks (project_id);
create index if not exists tasks_stage_idx on tasks (stage_id, board_order);
create index if not exists subtasks_task_idx on subtasks (task_id);
create index if not exists project_stages_project_idx on project_stages (project_id, sort_order);
create index if not exists time_entries_task_idx on time_entries (task_id);
create index if not exists time_entries_started_idx on time_entries (started_at);

-- ── Time tracking lab ───────────────────────────────────────────────────────

-- A category is the top-level bucket a segment rolls up into. `kind` lets
-- summaries reason about time without knowing the user's chosen names.
create table if not exists categories (
  id uuid primary key,
  name text not null,
  color text not null,
  kind text not null,            -- 'work' | 'rest' | 'upkeep' | 'unclassified'
  sort_order integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- A named thing the user actually does. Quick-entry chips are just the
-- activities flagged `is_preset`.
create table if not exists activities (
  id uuid primary key,
  category_id uuid not null references categories(id) on delete cascade,
  name text not null,
  typical_minutes integer,
  is_preset boolean not null default false,
  sort_order integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- The continuous life timeline. Exactly one of task_id / activity_id may be
-- set; category_id is always present so every minute rolls up somewhere.
create table if not exists segments (
  id uuid primary key,
  started_at timestamptz not null,
  ended_at timestamptz,
  category_id uuid not null references categories(id),
  activity_id uuid references activities(id) on delete set null,
  task_id uuid references tasks(id) on delete cascade,
  note text,
  source text not null default 'timer',   -- 'timer' | 'manual' | 'backfill'
  running_lock boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Single-row settings table, same one-row pattern as general_note.
create table if not exists tracking_settings (
  id uuid primary key,
  day_start_hour integer not null default 4,
  waking_start_hour integer not null default 7,
  waking_end_hour integer not null default 23,
  min_gap_minutes integer not null default 10,
  module_order text[] not null default
    array['now','unaccounted','ribbon','rollups','signals','records'],
  hidden_modules text[] not null default array[]::text[],
  updated_at timestamptz not null default now()
);

create index if not exists segments_started_idx on segments (started_at);
create index if not exists segments_task_idx on segments (task_id);
create index if not exists segments_category_idx on segments (category_id);
create index if not exists activities_category_idx on activities (category_id, sort_order);

-- A project's own timer sessions inherit this category instead of the
-- hardcoded Focus Work default. Nullable + on delete set null so archiving
-- or deleting a category can never orphan a project.
alter table projects add column if not exists default_category_id uuid references categories(id) on delete set null;

-- Which modules the user has collapsed on the tracking dashboard, so the
-- state survives a reload instead of every card re-expanding. Records,
-- roll-ups and signals default to collapsed for a first-run install — they
-- are the "more information" tier behind NOW and UNACCOUNTED, the actual
-- input surface. A brand-new row picks this up straight from the column
-- default below; an existing row needs the one-time backfillCollapsedModules
-- in lib/migrate.ts instead, since ADD COLUMN only ever touches a row that
-- doesn't exist yet — see collapsed_modules_seeded just below for why a
-- plain "is it still empty?" check isn't enough to drive that backfill.
alter table tracking_settings add column if not exists collapsed_modules text[] not null default array['records','rollups','signals'];

-- Whether the one-time collapsed-modules backfill has already run for this
-- row. A flag, not a re-derivable check, because "is collapsed_modules
-- still empty?" can't tell a never-touched row apart from a user who
-- deliberately expanded every module back out — re-collapsing the second
-- case on the next launch would silently overwrite their choice. ADD COLUMN
-- backdates existing rows to false (so the pending backfill can find them);
-- the ALTER COLUMN right after only changes the default new rows get, so a
-- brand-new install — whose collapsed_modules is already correct from its
-- own column default — is seeded true immediately and never runs the
-- backfill at all.
alter table tracking_settings add column if not exists collapsed_modules_seeded boolean not null default false;
alter table tracking_settings alter column collapsed_modules_seeded set default true;

-- Which sidebar nav entries the user has hidden. Hiding a route only hides
-- the link — the route itself still loads if navigated to directly.
alter table tracking_settings add column if not exists hidden_nav_items text[] not null default array[]::text[];

-- Which preset activities show as quick-start chips on the NOW card, distinct
-- from is_preset (which only marks eligibility). See backfill() in migrate.ts
-- for the one-time pin given to existing installs.
alter table activities add column if not exists pinned boolean not null default false;

-- ---------------------------------------------------------------------------
-- v2 data layer (Phase 4A)
-- Additive and idempotent: every column is nullable or defaulted, nothing is
-- dropped, and the whole section is safe to run twice on a populated v0.1.3
-- database.
-- ---------------------------------------------------------------------------

-- A task with no date is an inbox item. tasks.scheduled is made nullable by
-- the guarded relax step in lib/migrate.ts, not here.
create index if not exists tasks_inbox_idx on tasks (created_at) where scheduled is null;

-- Committed day (today list), hidden-until, expiry, and when the task entered
-- its current stage (backfilled from created_at in lib/migrate.ts).
alter table tasks add column if not exists committed_on date;
alter table tasks add column if not exists start_on date;
alter table tasks add column if not exists expires_on date;
alter table tasks add column if not exists stage_entered_at timestamptz;

-- "blocker_id blocks blocked_id". Deleting either task removes the link.
create table if not exists task_links (
  blocker_id uuid references tasks(id) on delete cascade,
  blocked_id uuid references tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
create index if not exists task_links_blocked_idx on task_links (blocked_id);

-- Per-column work-in-progress limit; null = no limit.
alter table project_stages add column if not exists wip_limit integer;

-- End-of-day review: energy and a short note, one row per day.
create table if not exists day_reviews (
  day date primary key,
  energy smallint,
  note text,
  updated_at timestamptz not null default now()
);

alter table tracking_settings add column if not exists today_cap integer not null default 3;
alter table tracking_settings add column if not exists dock_badge text not null default 'today';
alter table tracking_settings add column if not exists capture_shortcut text not null default 'Control+Alt+Space';
-- null = nudges off
alter table tracking_settings add column if not exists nudge_minutes integer;
alter table tracking_settings add column if not exists wrap_hour integer not null default 17;
alter table tracking_settings add column if not exists weekly_reset_day integer not null default 0;
alter table tracking_settings add column if not exists claude_awareness boolean not null default false;
alter table tracking_settings add column if not exists date_order text not null default 'dmy';
-- Whether the one-time quick_todos -> inbox copy has run (see migrate.ts).
alter table tracking_settings add column if not exists quick_todos_migrated boolean not null default false;
