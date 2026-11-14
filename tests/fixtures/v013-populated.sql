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

-- ==== DATA ====
-- Fictional data only. Generated by build-v013-fixture.ts.
insert into categories (id, name, color, kind, sort_order, archived, created_at) values ('00000000-0000-0000-0000-000000000002', 'Focus Work', '#0052ff', 'work', 0, false, '2026-01-01T09:00:00Z');
insert into categories (id, name, color, kind, sort_order, archived, created_at) values ('00000000-0000-4000-8007-000000000002', 'Studio Craft', '#a855f7', 'work', 1, false, '2026-01-01T09:00:00Z');
insert into categories (id, name, color, kind, sort_order, archived, created_at) values ('00000000-0000-4000-8007-000000000003', 'Rest', '#16a34a', 'rest', 2, false, '2026-01-01T09:00:00Z');
insert into categories (id, name, color, kind, sort_order, archived, created_at) values ('00000000-0000-4000-8007-000000000004', 'Household', '#f59e0b', 'upkeep', 3, false, '2026-01-01T09:00:00Z');
insert into categories (id, name, color, kind, sort_order, archived, created_at) values ('00000000-0000-4000-8007-000000000005', 'Unsorted', '#94a3b8', 'unclassified', 4, false, '2026-01-01T09:00:00Z');
insert into activities (id, category_id, name, typical_minutes, is_preset, sort_order, archived, created_at, pinned) values ('00000000-0000-4000-8008-000000000001', '00000000-0000-0000-0000-000000000002', 'Deep Writing', 15, true, 0, false, '2026-01-01T09:00:00Z', true);
insert into activities (id, category_id, name, typical_minutes, is_preset, sort_order, archived, created_at, pinned) values ('00000000-0000-4000-8008-000000000002', '00000000-0000-0000-0000-000000000002', 'Code Review', 30, false, 1, false, '2026-01-01T09:00:00Z', false);
insert into activities (id, category_id, name, typical_minutes, is_preset, sort_order, archived, created_at, pinned) values ('00000000-0000-4000-8008-000000000003', '00000000-0000-4000-8007-000000000002', 'Pottery', 15, true, 0, false, '2026-01-01T09:00:00Z', true);
insert into activities (id, category_id, name, typical_minutes, is_preset, sort_order, archived, created_at, pinned) values ('00000000-0000-4000-8008-000000000004', '00000000-0000-4000-8007-000000000002', 'Sketching', 30, false, 1, false, '2026-01-01T09:00:00Z', false);
insert into activities (id, category_id, name, typical_minutes, is_preset, sort_order, archived, created_at, pinned) values ('00000000-0000-4000-8008-000000000005', '00000000-0000-4000-8007-000000000003', 'Nap', 15, true, 0, false, '2026-01-01T09:00:00Z', true);
insert into activities (id, category_id, name, typical_minutes, is_preset, sort_order, archived, created_at, pinned) values ('00000000-0000-4000-8008-000000000006', '00000000-0000-4000-8007-000000000003', 'Walk', 30, false, 1, false, '2026-01-01T09:00:00Z', false);
insert into activities (id, category_id, name, typical_minutes, is_preset, sort_order, archived, created_at, pinned) values ('00000000-0000-4000-8008-000000000007', '00000000-0000-4000-8007-000000000004', 'Laundry', 15, true, 0, false, '2026-01-01T09:00:00Z', false);
insert into activities (id, category_id, name, typical_minutes, is_preset, sort_order, archived, created_at, pinned) values ('00000000-0000-4000-8008-000000000008', '00000000-0000-4000-8007-000000000004', 'Meal Prep', 30, false, 1, false, '2026-01-01T09:00:00Z', false);
insert into activities (id, category_id, name, typical_minutes, is_preset, sort_order, archived, created_at, pinned) values ('00000000-0000-4000-8008-000000000009', '00000000-0000-4000-8007-000000000005', 'Browsing', 15, true, 0, true, '2026-01-01T09:00:00Z', false);
insert into projects (id, name, color, archived, sort_order, created_at, default_category_id) values ('00000000-0000-4000-8001-000000000001', 'Harbor Lantern Redesign', '#0ea5e9', false, 0, '2026-01-02T09:00:00Z', null);
insert into project_stages (id, project_id, name, kind, sort_order, created_at) values ('00000000-0000-4000-8002-000000000001', '00000000-0000-4000-8001-000000000001', 'Backlog', 'active', 0, '2026-01-02T09:00:00Z');
insert into project_stages (id, project_id, name, kind, sort_order, created_at) values ('00000000-0000-4000-8002-000000000002', '00000000-0000-4000-8001-000000000001', 'In Progress', 'active', 1, '2026-01-02T09:00:00Z');
insert into project_stages (id, project_id, name, kind, sort_order, created_at) values ('00000000-0000-4000-8002-000000000003', '00000000-0000-4000-8001-000000000001', 'Blocked', 'blocked', 2, '2026-01-02T09:00:00Z');
insert into project_stages (id, project_id, name, kind, sort_order, created_at) values ('00000000-0000-4000-8002-000000000004', '00000000-0000-4000-8001-000000000001', 'Done', 'done', 3, '2026-01-02T09:00:00Z');
insert into projects (id, name, color, archived, sort_order, created_at, default_category_id) values ('00000000-0000-4000-8001-000000000002', 'Orchard Notes Podcast', '#22c55e', false, 1, '2026-01-03T09:00:00Z', '00000000-0000-4000-8007-000000000002');
insert into project_stages (id, project_id, name, kind, sort_order, created_at) values ('00000000-0000-4000-8002-00000000000b', '00000000-0000-4000-8001-000000000002', 'Ideas', 'active', 0, '2026-01-03T09:00:00Z');
insert into project_stages (id, project_id, name, kind, sort_order, created_at) values ('00000000-0000-4000-8002-00000000000c', '00000000-0000-4000-8001-000000000002', 'In Progress', 'active', 1, '2026-01-03T09:00:00Z');
insert into project_stages (id, project_id, name, kind, sort_order, created_at) values ('00000000-0000-4000-8002-00000000000d', '00000000-0000-4000-8001-000000000002', 'Blocked', 'blocked', 2, '2026-01-03T09:00:00Z');
insert into project_stages (id, project_id, name, kind, sort_order, created_at) values ('00000000-0000-4000-8002-00000000000e', '00000000-0000-4000-8001-000000000002', 'Done', 'done', 3, '2026-01-03T09:00:00Z');
insert into projects (id, name, color, archived, sort_order, created_at, default_category_id) values ('00000000-0000-4000-8001-000000000003', 'Kiln House Renovation', '#ef4444', false, 2, '2026-01-04T09:00:00Z', null);
insert into project_stages (id, project_id, name, kind, sort_order, created_at) values ('00000000-0000-4000-8002-000000000015', '00000000-0000-4000-8001-000000000003', 'Backlog', 'active', 0, '2026-01-04T09:00:00Z');
insert into project_stages (id, project_id, name, kind, sort_order, created_at) values ('00000000-0000-4000-8002-000000000016', '00000000-0000-4000-8001-000000000003', 'In Progress', 'active', 1, '2026-01-04T09:00:00Z');
insert into project_stages (id, project_id, name, kind, sort_order, created_at) values ('00000000-0000-4000-8002-000000000017', '00000000-0000-4000-8001-000000000003', 'Blocked', 'blocked', 2, '2026-01-04T09:00:00Z');
insert into project_stages (id, project_id, name, kind, sort_order, created_at) values ('00000000-0000-4000-8002-000000000018', '00000000-0000-4000-8001-000000000003', 'Done', 'done', 3, '2026-01-04T09:00:00Z');
insert into projects (id, name, color, archived, sort_order, created_at, default_category_id) values ('00000000-0000-4000-8001-000000000004', 'Tidewater Garden Plan', '#eab308', true, 3, '2026-01-05T09:00:00Z', null);
insert into project_stages (id, project_id, name, kind, sort_order, created_at) values ('00000000-0000-4000-8002-00000000001f', '00000000-0000-4000-8001-000000000004', 'Backlog', 'active', 0, '2026-01-05T09:00:00Z');
insert into project_stages (id, project_id, name, kind, sort_order, created_at) values ('00000000-0000-4000-8002-000000000020', '00000000-0000-4000-8001-000000000004', 'In Progress', 'active', 1, '2026-01-05T09:00:00Z');
insert into project_stages (id, project_id, name, kind, sort_order, created_at) values ('00000000-0000-4000-8002-000000000021', '00000000-0000-4000-8001-000000000004', 'Blocked', 'blocked', 2, '2026-01-05T09:00:00Z');
insert into project_stages (id, project_id, name, kind, sort_order, created_at) values ('00000000-0000-4000-8002-000000000022', '00000000-0000-4000-8001-000000000004', 'Done', 'done', 3, '2026-01-05T09:00:00Z');
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-000000000001', 'Fixture task 01', 'Notes for task 1', null, array['errand','quick']::text[], '2026-01-03', '08:30', 15, 0, 'open', null, 0, '2026-01-02T08:00:00Z', null, null, null, 0, true, '2026-01-06');
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-000000000002', 'Fixture task 02', null, '00000000-0000-4000-8001-000000000002', array['deep']::text[], '2026-01-04', null, 30, 1, 'done', null, 1, '2026-01-03T08:00:00Z', '2026-01-06T17:00:00Z', null, '00000000-0000-4000-8002-00000000000e', 1, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-000000000003', 'Fixture task 03', null, '00000000-0000-4000-8001-000000000003', array[]::text[], '2026-01-05', null, 45, 2, 'trashed', '{"freq":"weekly","interval":1}'::jsonb, 2, '2026-01-04T08:00:00Z', null, '2026-01-08T12:00:00Z', '00000000-0000-4000-8002-000000000015', 2, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-000000000004', 'Fixture task 04', null, '00000000-0000-4000-8001-000000000004', array['errand','quick']::text[], '2026-01-06', null, 60, 3, 'open', null, 3, '2026-01-05T08:00:00Z', null, null, '00000000-0000-4000-8002-000000000020', 3, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-000000000005', 'Fixture task 05', 'Notes for task 5', '00000000-0000-4000-8001-000000000001', array['deep']::text[], '2026-01-07', null, 75, 0, 'done', '{"freq":"daily","interval":2}'::jsonb, 4, '2026-01-06T08:00:00Z', '2026-01-09T17:00:00Z', null, '00000000-0000-4000-8002-000000000004', 4, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-000000000006', 'Fixture task 06', null, null, array[]::text[], '2026-01-08', null, 15, 1, 'trashed', null, 5, '2026-01-07T08:00:00Z', null, '2026-01-11T12:00:00Z', null, 5, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-000000000007', 'Fixture task 07', null, '00000000-0000-4000-8001-000000000003', array['errand','quick']::text[], '2026-01-09', '14:30', 30, 2, 'open', null, 6, '2026-01-08T08:00:00Z', null, null, '00000000-0000-4000-8002-000000000015', 6, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-000000000008', 'Fixture task 08', null, '00000000-0000-4000-8001-000000000004', array['deep']::text[], '2026-01-10', null, 45, 3, 'done', null, 7, '2026-01-09T08:00:00Z', '2026-01-12T17:00:00Z', null, '00000000-0000-4000-8002-000000000022', 7, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-000000000009', 'Fixture task 09', 'Notes for task 9', '00000000-0000-4000-8001-000000000001', array[]::text[], '2026-01-11', null, 60, 0, 'trashed', '{"freq":"weekly","interval":1}'::jsonb, 8, '2026-01-10T08:00:00Z', null, '2026-01-14T12:00:00Z', '00000000-0000-4000-8002-000000000001', 8, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-00000000000a', 'Fixture task 10', null, '00000000-0000-4000-8001-000000000002', array['errand','quick']::text[], '2026-01-12', null, 75, 1, 'open', null, 9, '2026-01-11T08:00:00Z', null, null, '00000000-0000-4000-8002-00000000000c', 9, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-00000000000b', 'Fixture task 11', null, null, array['deep']::text[], '2026-01-13', null, 15, 2, 'done', '{"freq":"daily","interval":2}'::jsonb, 10, '2026-01-12T08:00:00Z', '2026-01-15T17:00:00Z', null, null, 10, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-00000000000c', 'Fixture task 12', null, '00000000-0000-4000-8001-000000000004', array[]::text[], '2026-01-14', null, 30, 3, 'trashed', null, 11, '2026-01-13T08:00:00Z', null, '2026-01-17T12:00:00Z', '00000000-0000-4000-8002-000000000020', 11, true, '2026-01-17');
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-00000000000d', 'Fixture task 13', 'Notes for task 13', '00000000-0000-4000-8001-000000000001', array['errand','quick']::text[], '2026-01-15', '10:30', 45, 0, 'open', null, 12, '2026-01-14T08:00:00Z', null, null, '00000000-0000-4000-8002-000000000001', 12, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-00000000000e', 'Fixture task 14', null, '00000000-0000-4000-8001-000000000002', array['deep']::text[], '2026-01-16', null, 60, 1, 'done', null, 13, '2026-01-15T08:00:00Z', '2026-01-18T17:00:00Z', null, '00000000-0000-4000-8002-00000000000e', 13, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-00000000000f', 'Fixture task 15', null, '00000000-0000-4000-8001-000000000003', array[]::text[], '2026-01-17', null, 75, 2, 'trashed', '{"freq":"weekly","interval":1}'::jsonb, 14, '2026-01-16T08:00:00Z', null, '2026-01-20T12:00:00Z', '00000000-0000-4000-8002-000000000017', 14, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-000000000010', 'Fixture task 16', null, null, array['errand','quick']::text[], '2026-01-18', null, 15, 3, 'open', null, 15, '2026-01-17T08:00:00Z', null, null, null, 15, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-000000000011', 'Fixture task 17', 'Notes for task 17', '00000000-0000-4000-8001-000000000001', array['deep']::text[], '2026-01-19', null, 30, 0, 'done', '{"freq":"daily","interval":2}'::jsonb, 16, '2026-01-18T08:00:00Z', '2026-01-21T17:00:00Z', null, '00000000-0000-4000-8002-000000000004', 16, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-000000000012', 'Fixture task 18', null, '00000000-0000-4000-8001-000000000002', array[]::text[], '2026-01-20', null, 45, 1, 'trashed', null, 17, '2026-01-19T08:00:00Z', null, '2026-01-23T12:00:00Z', '00000000-0000-4000-8002-00000000000c', 17, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-000000000013', 'Fixture task 19', null, '00000000-0000-4000-8001-000000000003', array['errand','quick']::text[], '2026-01-21', '16:30', 60, 2, 'open', null, 18, '2026-01-20T08:00:00Z', null, null, '00000000-0000-4000-8002-000000000015', 18, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-000000000014', 'Fixture task 20', null, '00000000-0000-4000-8001-000000000004', array['deep']::text[], '2026-01-22', null, 75, 3, 'done', null, 19, '2026-01-21T08:00:00Z', '2026-01-24T17:00:00Z', null, '00000000-0000-4000-8002-000000000022', 19, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-000000000015', 'Fixture task 21', 'Notes for task 21', null, array[]::text[], '2026-01-23', null, 15, 0, 'trashed', '{"freq":"weekly","interval":1}'::jsonb, 20, '2026-01-02T08:00:00Z', null, '2026-01-26T12:00:00Z', null, 20, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-000000000016', 'Fixture task 22', null, '00000000-0000-4000-8001-000000000002', array['errand','quick']::text[], '2026-01-24', null, 30, 1, 'open', null, 21, '2026-01-03T08:00:00Z', null, null, '00000000-0000-4000-8002-00000000000d', 21, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-000000000017', 'Fixture task 23', null, '00000000-0000-4000-8001-000000000003', array['deep']::text[], '2026-01-25', null, 45, 2, 'done', '{"freq":"daily","interval":2}'::jsonb, 22, '2026-01-04T08:00:00Z', '2026-01-27T17:00:00Z', null, '00000000-0000-4000-8002-000000000018', 22, true, '2026-01-28');
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-000000000018', 'Fixture task 24', null, '00000000-0000-4000-8001-000000000004', array[]::text[], '2026-01-26', null, 60, 3, 'trashed', null, 23, '2026-01-05T08:00:00Z', null, '2026-02-01T12:00:00Z', '00000000-0000-4000-8002-000000000020', 23, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-000000000019', 'Fixture task 25', 'Notes for task 25', '00000000-0000-4000-8001-000000000001', array['errand','quick']::text[], '2026-01-27', '12:30', 75, 0, 'open', null, 24, '2026-01-06T08:00:00Z', null, null, '00000000-0000-4000-8002-000000000001', 24, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-00000000001a', 'Fixture task 26', null, null, array['deep']::text[], '2026-01-28', null, 15, 1, 'done', null, 25, '2026-01-07T08:00:00Z', '2026-02-02T17:00:00Z', null, null, 25, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-00000000001b', 'Fixture task 27', null, '00000000-0000-4000-8001-000000000003', array[]::text[], '2026-02-01', null, 30, 2, 'trashed', '{"freq":"weekly","interval":1}'::jsonb, 26, '2026-01-08T08:00:00Z', null, '2026-02-04T12:00:00Z', '00000000-0000-4000-8002-000000000015', 26, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-00000000001c', 'Fixture task 28', null, '00000000-0000-4000-8001-000000000004', array['errand','quick']::text[], '2026-02-02', null, 45, 3, 'open', null, 27, '2026-01-09T08:00:00Z', null, null, '00000000-0000-4000-8002-000000000020', 27, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-00000000001d', 'Fixture task 29', 'Notes for task 29', '00000000-0000-4000-8001-000000000001', array['deep']::text[], '2026-02-03', null, 60, 0, 'done', '{"freq":"daily","interval":2}'::jsonb, 28, '2026-01-10T08:00:00Z', '2026-02-05T17:00:00Z', null, '00000000-0000-4000-8002-000000000004', 28, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-00000000001e', 'Fixture task 30', null, '00000000-0000-4000-8001-000000000002', array[]::text[], '2026-02-04', null, 75, 1, 'trashed', null, 29, '2026-01-11T08:00:00Z', null, '2026-02-07T12:00:00Z', '00000000-0000-4000-8002-00000000000c', 29, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-00000000001f', 'Fixture task 31', null, null, array['errand','quick']::text[], '2026-02-05', '08:30', 15, 2, 'open', null, 30, '2026-01-12T08:00:00Z', null, null, null, 30, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-000000000020', 'Fixture task 32', null, '00000000-0000-4000-8001-000000000004', array['deep']::text[], '2026-02-06', null, 30, 3, 'done', null, 31, '2026-01-13T08:00:00Z', '2026-02-08T17:00:00Z', null, '00000000-0000-4000-8002-000000000022', 31, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-000000000021', 'Fixture task 33', 'Notes for task 33', '00000000-0000-4000-8001-000000000001', array[]::text[], '2026-02-07', null, 45, 0, 'trashed', '{"freq":"weekly","interval":1}'::jsonb, 32, '2026-01-14T08:00:00Z', null, '2026-02-10T12:00:00Z', '00000000-0000-4000-8002-000000000001', 32, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-000000000022', 'Fixture task 34', null, '00000000-0000-4000-8001-000000000002', array['errand','quick']::text[], '2026-02-08', null, 60, 1, 'open', null, 33, '2026-01-15T08:00:00Z', null, null, '00000000-0000-4000-8002-00000000000c', 33, true, '2026-02-11');
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-000000000023', 'Fixture task 35', null, '00000000-0000-4000-8001-000000000003', array['deep']::text[], '2026-02-09', null, 75, 2, 'done', '{"freq":"daily","interval":2}'::jsonb, 34, '2026-01-16T08:00:00Z', '2026-02-11T17:00:00Z', null, '00000000-0000-4000-8002-000000000018', 34, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-000000000024', 'Fixture task 36', null, null, array[]::text[], '2026-02-10', null, 15, 3, 'trashed', null, 35, '2026-01-17T08:00:00Z', null, '2026-02-13T12:00:00Z', null, 35, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-000000000025', 'Fixture task 37', 'Notes for task 37', '00000000-0000-4000-8001-000000000001', array['errand','quick']::text[], '2026-02-11', '14:30', 30, 0, 'open', null, 36, '2026-01-18T08:00:00Z', null, null, '00000000-0000-4000-8002-000000000001', 36, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-000000000026', 'Fixture task 38', null, '00000000-0000-4000-8001-000000000002', array['deep']::text[], '2026-02-12', null, 45, 1, 'done', null, 37, '2026-01-19T08:00:00Z', '2026-02-14T17:00:00Z', null, '00000000-0000-4000-8002-00000000000e', 37, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-000000000027', 'Fixture task 39', null, '00000000-0000-4000-8001-000000000003', array[]::text[], '2026-02-13', null, 60, 2, 'trashed', '{"freq":"weekly","interval":1}'::jsonb, 38, '2026-01-20T08:00:00Z', null, '2026-02-16T12:00:00Z', '00000000-0000-4000-8002-000000000015', 38, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-000000000028', 'Fixture task 40', null, '00000000-0000-4000-8001-000000000004', array['errand','quick']::text[], '2026-02-14', null, 75, 3, 'open', null, 39, '2026-01-21T08:00:00Z', null, null, '00000000-0000-4000-8002-000000000020', 39, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-000000000029', 'Fixture task 41', 'Notes for task 41', null, array['deep']::text[], '2026-02-15', null, 15, 0, 'done', '{"freq":"daily","interval":2}'::jsonb, 40, '2026-01-02T08:00:00Z', '2026-02-17T17:00:00Z', null, null, 40, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-00000000002a', 'Fixture task 42', null, '00000000-0000-4000-8001-000000000002', array[]::text[], '2026-02-16', null, 30, 1, 'trashed', null, 41, '2026-01-03T08:00:00Z', null, '2026-02-19T12:00:00Z', '00000000-0000-4000-8002-00000000000c', 41, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-00000000002b', 'Fixture task 43', null, '00000000-0000-4000-8001-000000000003', array['errand','quick']::text[], '2026-02-17', '10:30', 45, 2, 'open', null, 42, '2026-01-04T08:00:00Z', null, null, '00000000-0000-4000-8002-000000000017', 42, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-00000000002c', 'Fixture task 44', null, '00000000-0000-4000-8001-000000000004', array['deep']::text[], '2026-02-18', null, 60, 3, 'done', null, 43, '2026-01-05T08:00:00Z', '2026-02-20T17:00:00Z', null, '00000000-0000-4000-8002-000000000022', 43, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-00000000002d', 'Fixture task 45', 'Notes for task 45', '00000000-0000-4000-8001-000000000001', array[]::text[], '2026-02-19', null, 75, 0, 'trashed', '{"freq":"weekly","interval":1}'::jsonb, 44, '2026-01-06T08:00:00Z', null, '2026-02-22T12:00:00Z', '00000000-0000-4000-8002-000000000001', 44, true, '2026-02-22');
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-00000000002e', 'Fixture task 46', null, null, array['errand','quick']::text[], '2026-02-20', null, 15, 1, 'open', null, 45, '2026-01-07T08:00:00Z', null, null, null, 45, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-00000000002f', 'Fixture task 47', null, '00000000-0000-4000-8001-000000000003', array['deep']::text[], '2026-02-21', null, 30, 2, 'done', '{"freq":"daily","interval":2}'::jsonb, 46, '2026-01-08T08:00:00Z', '2026-02-23T17:00:00Z', null, '00000000-0000-4000-8002-000000000018', 46, false, null);
insert into tasks (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order, created_at, completed_at, deleted_at, stage_id, board_order, is_complex, finish_date) values ('00000000-0000-4000-8003-000000000030', 'Fixture task 48', null, '00000000-0000-4000-8001-000000000004', array[]::text[], '2026-02-22', null, 45, 3, 'trashed', null, 47, '2026-01-09T08:00:00Z', null, '2026-02-25T12:00:00Z', '00000000-0000-4000-8002-000000000020', 47, false, null);
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-000000000001', '00000000-0000-4000-8003-000000000001', 'Step 1 of task 1', true, 0, '2026-01-03T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-000000000002', '00000000-0000-4000-8003-000000000001', 'Step 2 of task 1', false, 1, '2026-01-03T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-000000000003', '00000000-0000-4000-8003-000000000001', 'Step 3 of task 1', false, 2, '2026-01-03T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-000000000004', '00000000-0000-4000-8003-000000000004', 'Step 1 of task 4', true, 0, '2026-01-06T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-000000000005', '00000000-0000-4000-8003-000000000004', 'Step 2 of task 4', false, 1, '2026-01-06T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-000000000006', '00000000-0000-4000-8003-000000000004', 'Step 3 of task 4', false, 2, '2026-01-06T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-000000000007', '00000000-0000-4000-8003-000000000007', 'Step 1 of task 7', true, 0, '2026-01-09T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-000000000008', '00000000-0000-4000-8003-000000000007', 'Step 2 of task 7', false, 1, '2026-01-09T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-000000000009', '00000000-0000-4000-8003-000000000007', 'Step 3 of task 7', false, 2, '2026-01-09T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-00000000000a', '00000000-0000-4000-8003-00000000000a', 'Step 1 of task 10', true, 0, '2026-01-12T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-00000000000b', '00000000-0000-4000-8003-00000000000a', 'Step 2 of task 10', false, 1, '2026-01-12T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-00000000000c', '00000000-0000-4000-8003-00000000000a', 'Step 3 of task 10', false, 2, '2026-01-12T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-00000000000d', '00000000-0000-4000-8003-00000000000d', 'Step 1 of task 13', true, 0, '2026-01-15T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-00000000000e', '00000000-0000-4000-8003-00000000000d', 'Step 2 of task 13', false, 1, '2026-01-15T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-00000000000f', '00000000-0000-4000-8003-00000000000d', 'Step 3 of task 13', false, 2, '2026-01-15T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-000000000010', '00000000-0000-4000-8003-000000000010', 'Step 1 of task 16', true, 0, '2026-01-18T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-000000000011', '00000000-0000-4000-8003-000000000010', 'Step 2 of task 16', false, 1, '2026-01-18T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-000000000012', '00000000-0000-4000-8003-000000000010', 'Step 3 of task 16', false, 2, '2026-01-18T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-000000000013', '00000000-0000-4000-8003-000000000013', 'Step 1 of task 19', true, 0, '2026-01-21T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-000000000014', '00000000-0000-4000-8003-000000000013', 'Step 2 of task 19', false, 1, '2026-01-21T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-000000000015', '00000000-0000-4000-8003-000000000013', 'Step 3 of task 19', false, 2, '2026-01-21T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-000000000016', '00000000-0000-4000-8003-000000000016', 'Step 1 of task 22', true, 0, '2026-01-24T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-000000000017', '00000000-0000-4000-8003-000000000016', 'Step 2 of task 22', false, 1, '2026-01-24T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-000000000018', '00000000-0000-4000-8003-000000000016', 'Step 3 of task 22', false, 2, '2026-01-24T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-000000000019', '00000000-0000-4000-8003-000000000019', 'Step 1 of task 25', true, 0, '2026-01-27T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-00000000001a', '00000000-0000-4000-8003-000000000019', 'Step 2 of task 25', false, 1, '2026-01-27T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-00000000001b', '00000000-0000-4000-8003-000000000019', 'Step 3 of task 25', false, 2, '2026-01-27T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-00000000001c', '00000000-0000-4000-8003-00000000001c', 'Step 1 of task 28', true, 0, '2026-02-02T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-00000000001d', '00000000-0000-4000-8003-00000000001c', 'Step 2 of task 28', false, 1, '2026-02-02T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-00000000001e', '00000000-0000-4000-8003-00000000001c', 'Step 3 of task 28', false, 2, '2026-02-02T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-00000000001f', '00000000-0000-4000-8003-00000000001f', 'Step 1 of task 31', true, 0, '2026-02-05T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-000000000020', '00000000-0000-4000-8003-00000000001f', 'Step 2 of task 31', false, 1, '2026-02-05T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-000000000021', '00000000-0000-4000-8003-00000000001f', 'Step 3 of task 31', false, 2, '2026-02-05T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-000000000022', '00000000-0000-4000-8003-000000000022', 'Step 1 of task 34', true, 0, '2026-02-08T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-000000000023', '00000000-0000-4000-8003-000000000022', 'Step 2 of task 34', false, 1, '2026-02-08T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-000000000024', '00000000-0000-4000-8003-000000000022', 'Step 3 of task 34', false, 2, '2026-02-08T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-000000000025', '00000000-0000-4000-8003-000000000025', 'Step 1 of task 37', true, 0, '2026-02-11T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-000000000026', '00000000-0000-4000-8003-000000000025', 'Step 2 of task 37', false, 1, '2026-02-11T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-000000000027', '00000000-0000-4000-8003-000000000025', 'Step 3 of task 37', false, 2, '2026-02-11T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-000000000028', '00000000-0000-4000-8003-000000000028', 'Step 1 of task 40', true, 0, '2026-02-14T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-000000000029', '00000000-0000-4000-8003-000000000028', 'Step 2 of task 40', false, 1, '2026-02-14T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-00000000002a', '00000000-0000-4000-8003-000000000028', 'Step 3 of task 40', false, 2, '2026-02-14T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-00000000002b', '00000000-0000-4000-8003-00000000002b', 'Step 1 of task 43', true, 0, '2026-02-17T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-00000000002c', '00000000-0000-4000-8003-00000000002b', 'Step 2 of task 43', false, 1, '2026-02-17T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-00000000002d', '00000000-0000-4000-8003-00000000002b', 'Step 3 of task 43', false, 2, '2026-02-17T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-00000000002e', '00000000-0000-4000-8003-00000000002e', 'Step 1 of task 46', true, 0, '2026-02-20T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-00000000002f', '00000000-0000-4000-8003-00000000002e', 'Step 2 of task 46', false, 1, '2026-02-20T08:00:00Z');
insert into subtasks (id, task_id, title, done, sort_order, created_at) values ('00000000-0000-4000-8004-000000000030', '00000000-0000-4000-8003-00000000002e', 'Step 3 of task 46', false, 2, '2026-02-20T08:00:00Z');
insert into time_entries (id, task_id, started_at, ended_at, minutes, note, running_lock, created_at, updated_at) values ('00000000-0000-4000-8006-000000000001', '00000000-0000-4000-8003-000000000001', '2026-01-10T09:00:00Z', '2026-01-10T10:15:00Z', 75, null, null, '2026-01-10T09:00:00Z', '2026-01-10T10:15:00Z');
insert into segments (id, started_at, ended_at, category_id, activity_id, task_id, note, source, running_lock, created_at, updated_at) values ('00000000-0000-4000-8006-000000000001', '2026-01-10T09:00:00Z', '2026-01-10T10:15:00Z', '00000000-0000-0000-0000-000000000002', null, '00000000-0000-4000-8003-000000000001', null, 'timer', null, '2026-01-10T09:00:00Z', '2026-01-10T10:15:00Z');
insert into time_entries (id, task_id, started_at, ended_at, minutes, note, running_lock, created_at, updated_at) values ('00000000-0000-4000-8006-000000000002', '00000000-0000-4000-8003-000000000005', '2026-01-11T09:00:00Z', '2026-01-11T10:15:00Z', 75, 'Went well', null, '2026-01-11T09:00:00Z', '2026-01-11T10:15:00Z');
insert into segments (id, started_at, ended_at, category_id, activity_id, task_id, note, source, running_lock, created_at, updated_at) values ('00000000-0000-4000-8006-000000000002', '2026-01-11T09:00:00Z', '2026-01-11T10:15:00Z', '00000000-0000-0000-0000-000000000002', null, '00000000-0000-4000-8003-000000000005', 'Went well', 'timer', null, '2026-01-11T09:00:00Z', '2026-01-11T10:15:00Z');
insert into time_entries (id, task_id, started_at, ended_at, minutes, note, running_lock, created_at, updated_at) values ('00000000-0000-4000-8006-000000000003', '00000000-0000-4000-8003-000000000009', '2026-01-12T09:00:00Z', '2026-01-12T10:15:00Z', 75, null, null, '2026-01-12T09:00:00Z', '2026-01-12T10:15:00Z');
insert into segments (id, started_at, ended_at, category_id, activity_id, task_id, note, source, running_lock, created_at, updated_at) values ('00000000-0000-4000-8006-000000000003', '2026-01-12T09:00:00Z', '2026-01-12T10:15:00Z', '00000000-0000-0000-0000-000000000002', null, '00000000-0000-4000-8003-000000000009', null, 'timer', null, '2026-01-12T09:00:00Z', '2026-01-12T10:15:00Z');
insert into time_entries (id, task_id, started_at, ended_at, minutes, note, running_lock, created_at, updated_at) values ('00000000-0000-4000-8006-000000000004', '00000000-0000-4000-8003-00000000000d', '2026-01-13T09:00:00Z', '2026-01-13T10:15:00Z', 75, 'Went well', null, '2026-01-13T09:00:00Z', '2026-01-13T10:15:00Z');
insert into segments (id, started_at, ended_at, category_id, activity_id, task_id, note, source, running_lock, created_at, updated_at) values ('00000000-0000-4000-8006-000000000004', '2026-01-13T09:00:00Z', '2026-01-13T10:15:00Z', '00000000-0000-0000-0000-000000000002', null, '00000000-0000-4000-8003-00000000000d', 'Went well', 'timer', null, '2026-01-13T09:00:00Z', '2026-01-13T10:15:00Z');
insert into time_entries (id, task_id, started_at, ended_at, minutes, note, running_lock, created_at, updated_at) values ('00000000-0000-4000-8006-000000000005', '00000000-0000-4000-8003-000000000011', '2026-01-14T09:00:00Z', '2026-01-14T10:15:00Z', 75, null, null, '2026-01-14T09:00:00Z', '2026-01-14T10:15:00Z');
insert into segments (id, started_at, ended_at, category_id, activity_id, task_id, note, source, running_lock, created_at, updated_at) values ('00000000-0000-4000-8006-000000000005', '2026-01-14T09:00:00Z', '2026-01-14T10:15:00Z', '00000000-0000-0000-0000-000000000002', null, '00000000-0000-4000-8003-000000000011', null, 'timer', null, '2026-01-14T09:00:00Z', '2026-01-14T10:15:00Z');
insert into time_entries (id, task_id, started_at, ended_at, minutes, note, running_lock, created_at, updated_at) values ('00000000-0000-4000-8006-000000000006', '00000000-0000-4000-8003-000000000015', '2026-01-15T09:00:00Z', '2026-01-15T10:15:00Z', 75, 'Went well', null, '2026-01-15T09:00:00Z', '2026-01-15T10:15:00Z');
insert into segments (id, started_at, ended_at, category_id, activity_id, task_id, note, source, running_lock, created_at, updated_at) values ('00000000-0000-4000-8006-000000000006', '2026-01-15T09:00:00Z', '2026-01-15T10:15:00Z', '00000000-0000-0000-0000-000000000002', null, '00000000-0000-4000-8003-000000000015', 'Went well', 'timer', null, '2026-01-15T09:00:00Z', '2026-01-15T10:15:00Z');
insert into time_entries (id, task_id, started_at, ended_at, minutes, note, running_lock, created_at, updated_at) values ('00000000-0000-4000-8006-000000000007', '00000000-0000-4000-8003-000000000019', '2026-01-16T09:00:00Z', '2026-01-16T10:15:00Z', 75, null, null, '2026-01-16T09:00:00Z', '2026-01-16T10:15:00Z');
insert into segments (id, started_at, ended_at, category_id, activity_id, task_id, note, source, running_lock, created_at, updated_at) values ('00000000-0000-4000-8006-000000000007', '2026-01-16T09:00:00Z', '2026-01-16T10:15:00Z', '00000000-0000-0000-0000-000000000002', null, '00000000-0000-4000-8003-000000000019', null, 'timer', null, '2026-01-16T09:00:00Z', '2026-01-16T10:15:00Z');
insert into time_entries (id, task_id, started_at, ended_at, minutes, note, running_lock, created_at, updated_at) values ('00000000-0000-4000-8006-000000000008', '00000000-0000-4000-8003-00000000001d', '2026-01-17T09:00:00Z', '2026-01-17T10:15:00Z', 75, 'Went well', null, '2026-01-17T09:00:00Z', '2026-01-17T10:15:00Z');
insert into segments (id, started_at, ended_at, category_id, activity_id, task_id, note, source, running_lock, created_at, updated_at) values ('00000000-0000-4000-8006-000000000008', '2026-01-17T09:00:00Z', '2026-01-17T10:15:00Z', '00000000-0000-0000-0000-000000000002', null, '00000000-0000-4000-8003-00000000001d', 'Went well', 'timer', null, '2026-01-17T09:00:00Z', '2026-01-17T10:15:00Z');
insert into time_entries (id, task_id, started_at, ended_at, minutes, note, running_lock, created_at, updated_at) values ('00000000-0000-4000-8006-000000000009', '00000000-0000-4000-8003-000000000021', '2026-01-18T09:00:00Z', '2026-01-18T10:15:00Z', 75, null, null, '2026-01-18T09:00:00Z', '2026-01-18T10:15:00Z');
insert into segments (id, started_at, ended_at, category_id, activity_id, task_id, note, source, running_lock, created_at, updated_at) values ('00000000-0000-4000-8006-000000000009', '2026-01-18T09:00:00Z', '2026-01-18T10:15:00Z', '00000000-0000-0000-0000-000000000002', null, '00000000-0000-4000-8003-000000000021', null, 'timer', null, '2026-01-18T09:00:00Z', '2026-01-18T10:15:00Z');
insert into time_entries (id, task_id, started_at, ended_at, minutes, note, running_lock, created_at, updated_at) values ('00000000-0000-4000-8006-00000000000a', '00000000-0000-4000-8003-000000000025', '2026-01-19T09:00:00Z', '2026-01-19T10:15:00Z', 75, 'Went well', null, '2026-01-19T09:00:00Z', '2026-01-19T10:15:00Z');
insert into segments (id, started_at, ended_at, category_id, activity_id, task_id, note, source, running_lock, created_at, updated_at) values ('00000000-0000-4000-8006-00000000000a', '2026-01-19T09:00:00Z', '2026-01-19T10:15:00Z', '00000000-0000-0000-0000-000000000002', null, '00000000-0000-4000-8003-000000000025', 'Went well', 'timer', null, '2026-01-19T09:00:00Z', '2026-01-19T10:15:00Z');
insert into segments (id, started_at, ended_at, category_id, activity_id, task_id, note, source, running_lock, created_at, updated_at) values ('00000000-0000-4000-8009-00000000000b', '2026-01-12T14:00:00Z', '2026-01-12T14:45:00Z', '00000000-0000-0000-0000-000000000002', '00000000-0000-4000-8008-000000000001', null, null, 'backfill', null, '2026-01-12T14:00:00Z', '2026-01-12T14:00:00Z');
insert into segments (id, started_at, ended_at, category_id, activity_id, task_id, note, source, running_lock, created_at, updated_at) values ('00000000-0000-4000-8009-00000000000c', '2026-01-13T14:00:00Z', '2026-01-13T14:45:00Z', '00000000-0000-0000-0000-000000000002', '00000000-0000-4000-8008-000000000002', null, null, 'manual', null, '2026-01-13T14:00:00Z', '2026-01-13T14:00:00Z');
insert into segments (id, started_at, ended_at, category_id, activity_id, task_id, note, source, running_lock, created_at, updated_at) values ('00000000-0000-4000-8009-00000000000d', '2026-01-14T14:00:00Z', '2026-01-14T14:45:00Z', '00000000-0000-4000-8007-000000000002', '00000000-0000-4000-8008-000000000003', null, null, 'backfill', null, '2026-01-14T14:00:00Z', '2026-01-14T14:00:00Z');
insert into segments (id, started_at, ended_at, category_id, activity_id, task_id, note, source, running_lock, created_at, updated_at) values ('00000000-0000-4000-8009-00000000000e', '2026-01-15T14:00:00Z', '2026-01-15T14:45:00Z', '00000000-0000-4000-8007-000000000002', '00000000-0000-4000-8008-000000000004', null, null, 'manual', null, '2026-01-15T14:00:00Z', '2026-01-15T14:00:00Z');
insert into segments (id, started_at, ended_at, category_id, activity_id, task_id, note, source, running_lock, created_at, updated_at) values ('00000000-0000-4000-8009-00000000000f', '2026-01-16T14:00:00Z', '2026-01-16T14:45:00Z', '00000000-0000-4000-8007-000000000003', '00000000-0000-4000-8008-000000000005', null, null, 'backfill', null, '2026-01-16T14:00:00Z', '2026-01-16T14:00:00Z');
insert into segments (id, started_at, ended_at, category_id, activity_id, task_id, note, source, running_lock, created_at, updated_at) values ('00000000-0000-4000-8009-000000000010', '2026-01-17T14:00:00Z', '2026-01-17T14:45:00Z', '00000000-0000-4000-8007-000000000003', '00000000-0000-4000-8008-000000000006', null, null, 'manual', null, '2026-01-17T14:00:00Z', '2026-01-17T14:00:00Z');
insert into segments (id, started_at, ended_at, category_id, activity_id, task_id, note, source, running_lock, created_at, updated_at) values ('00000000-0000-4000-8009-000000000011', '2026-01-18T14:00:00Z', '2026-01-18T14:45:00Z', '00000000-0000-4000-8007-000000000004', '00000000-0000-4000-8008-000000000007', null, null, 'backfill', null, '2026-01-18T14:00:00Z', '2026-01-18T14:00:00Z');
insert into segments (id, started_at, ended_at, category_id, activity_id, task_id, note, source, running_lock, created_at, updated_at) values ('00000000-0000-4000-8009-000000000012', '2026-01-19T14:00:00Z', '2026-01-19T14:45:00Z', '00000000-0000-4000-8007-000000000004', '00000000-0000-4000-8008-000000000008', null, null, 'manual', null, '2026-01-19T14:00:00Z', '2026-01-19T14:00:00Z');
insert into segments (id, started_at, ended_at, category_id, activity_id, task_id, note, source, running_lock, created_at, updated_at) values ('00000000-0000-4000-8009-000000000013', '2026-01-20T14:00:00Z', '2026-01-20T14:45:00Z', '00000000-0000-4000-8007-000000000005', '00000000-0000-4000-8008-000000000009', null, null, 'backfill', null, '2026-01-20T14:00:00Z', '2026-01-20T14:00:00Z');
insert into segments (id, started_at, ended_at, category_id, activity_id, task_id, note, source, running_lock, created_at, updated_at) values ('00000000-0000-4000-8009-000000000014', '2026-01-21T14:00:00Z', '2026-01-21T14:45:00Z', '00000000-0000-0000-0000-000000000002', '00000000-0000-4000-8008-000000000001', null, null, 'manual', null, '2026-01-21T14:00:00Z', '2026-01-21T14:00:00Z');
insert into segments (id, started_at, ended_at, category_id, activity_id, task_id, note, source, running_lock, created_at, updated_at) values ('00000000-0000-4000-8009-000000000015', '2026-01-22T14:00:00Z', '2026-01-22T14:45:00Z', '00000000-0000-0000-0000-000000000002', '00000000-0000-4000-8008-000000000002', null, null, 'backfill', null, '2026-01-22T14:00:00Z', '2026-01-22T14:00:00Z');
insert into segments (id, started_at, ended_at, category_id, activity_id, task_id, note, source, running_lock, created_at, updated_at) values ('00000000-0000-4000-8009-000000000016', '2026-01-23T14:00:00Z', '2026-01-23T14:45:00Z', '00000000-0000-4000-8007-000000000002', '00000000-0000-4000-8008-000000000003', null, null, 'manual', null, '2026-01-23T14:00:00Z', '2026-01-23T14:00:00Z');
insert into quick_todos (id, title, done, sort_order, created_at, updated_at) values ('00000000-0000-4000-8005-000000000001', 'Buy lamp oil', false, 0, '2026-01-20T09:00:00Z', '2026-01-20T09:00:00Z');
insert into quick_todos (id, title, done, sort_order, created_at, updated_at) values ('00000000-0000-4000-8005-000000000002', 'Email the printer', false, 1, '2026-01-21T09:00:00Z', '2026-01-21T09:00:00Z');
insert into quick_todos (id, title, done, sort_order, created_at, updated_at) values ('00000000-0000-4000-8005-000000000003', 'Book dentist', false, 2, '2026-01-22T09:00:00Z', '2026-01-22T09:00:00Z');
insert into quick_todos (id, title, done, sort_order, created_at, updated_at) values ('00000000-0000-4000-8005-000000000004', 'Water the ferns', true, 3, '2026-01-23T09:00:00Z', '2026-01-23T09:00:00Z');
insert into general_note (id, body, updated_at) values ('owner', 'Fictional scratch note: remember to test the lantern prototype on Friday.', '2026-01-25T09:00:00Z');
insert into tracking_settings (id, day_start_hour, waking_start_hour, waking_end_hour, min_gap_minutes, module_order, hidden_modules, collapsed_modules, collapsed_modules_seeded, hidden_nav_items, updated_at) values ('00000000-0000-0000-0000-000000000001', 5, 6, 22, 15, array['now','ribbon','unaccounted','rollups','signals','records']::text[], array['signals']::text[], array['ribbon']::text[], true, array['records']::text[], '2026-01-26T09:00:00Z');
