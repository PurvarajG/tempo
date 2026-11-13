/**
 * Generates v013-populated.sql: the v0.1.3 schema (lib/schema.sql at dcfc75c)
 * followed by fictional, deterministic data in every table.
 *
 *   npx tsx tests/fixtures/build-v013-fixture.ts
 *
 * The SQL file is the fixture; this generator is committed so it can be
 * regenerated and reviewed.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const here = __dirname;
const out = path.join(here, "v013-populated.sql");

// Schema frozen at v0.1.3. Prefer the committed copy inside the existing SQL
// file; fall back to git when regenerating from scratch.
function schema(): string {
  const marker = "-- ==== DATA ====";
  if (existsSync(out)) {
    const text = readFileSync(out, "utf8");
    const i = text.indexOf(marker);
    if (i > 0) return text.slice(0, i);
  }
  const s = execFileSync("git", ["show", "dcfc75c:lib/schema.sql"], { encoding: "utf8" });
  return s.endsWith("\n") ? s : s + "\n";
}

const q = (v: string | number | boolean | null): string =>
  v === null ? "null" : typeof v === "string" ? `'${v.replace(/'/g, "''")}'` : String(v);
const arr = (xs: string[]): string => (xs.length ? `array[${xs.map((x) => q(x)).join(",")}]::text[]` : "array[]::text[]");

function uuid(kind: number, n: number): string {
  const k = kind.toString(16).padStart(4, "0");
  return `00000000-0000-4000-8${k.slice(1)}-${n.toString(16).padStart(12, "0")}`;
}
const K = { project: 1, stage: 2, task: 3, sub: 4, quick: 5, entry: 6, cat: 7, act: 8, seg: 9 };

const lines: string[] = [];
const insert = (table: string, cols: string[], vals: (string | number | boolean | null)[]) =>
  lines.push(`insert into ${table} (${cols.join(", ")}) values (${vals.map((v) => (typeof v === "string" && v.startsWith("@raw:") ? v.slice(5) : q(v))).join(", ")});`);
const raw = (s: string) => `@raw:${s}`;
const ts = (day: number, h = 9, m = 0) => `2026-${String(1 + Math.floor((day - 1) / 28)).padStart(2, "0")}-${String(((day - 1) % 28) + 1).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`;
const date = (day: number) => ts(day).slice(0, 10);

// Categories (Focus Work keeps the app's fixed id)
const cats = [
  { id: "00000000-0000-0000-0000-000000000002", name: "Focus Work", color: "#0052ff", kind: "work" },
  { id: uuid(K.cat, 2), name: "Studio Craft", color: "#a855f7", kind: "work" },
  { id: uuid(K.cat, 3), name: "Rest", color: "#16a34a", kind: "rest" },
  { id: uuid(K.cat, 4), name: "Household", color: "#f59e0b", kind: "upkeep" },
  { id: uuid(K.cat, 5), name: "Unsorted", color: "#94a3b8", kind: "unclassified" },
];
cats.forEach((c, i) => insert("categories", ["id", "name", "color", "kind", "sort_order", "archived", "created_at"], [c.id, c.name, c.color, c.kind, i, i === 4 ? false : false, ts(1)]));

const acts: { id: string; cat: string }[] = [];
const actNames = [["Deep Writing", "Code Review"], ["Pottery", "Sketching"], ["Nap", "Walk"], ["Laundry", "Meal Prep"], ["Browsing"]];
cats.forEach((c, ci) =>
  actNames[ci].forEach((name, ai) => {
    const id = uuid(K.act, acts.length + 1);
    acts.push({ id, cat: c.id });
    insert("activities", ["id", "category_id", "name", "typical_minutes", "is_preset", "sort_order", "archived", "created_at", "pinned"], [id, c.id, name, 15 + ai * 15, ai === 0, ai, name === "Browsing", ts(1), ai === 0 && ci < 3]);
  }),
);

// Projects and stages
const projNames = [["Harbor Lantern Redesign", "#0ea5e9"], ["Orchard Notes Podcast", "#22c55e"], ["Kiln House Renovation", "#ef4444"], ["Tidewater Garden Plan", "#eab308"]];
const stageDefs = [["Backlog", "active"], ["In Progress", "active"], ["Blocked", "blocked"], ["Done", "done"]];
const stageIds: string[][] = [];
projNames.forEach(([name, color], pi) => {
  const pid = uuid(K.project, pi + 1);
  insert("projects", ["id", "name", "color", "archived", "sort_order", "created_at", "default_category_id"], [pid, name, color, pi === 3, pi, ts(2 + pi), pi === 1 ? cats[1].id : null]);
  stageIds[pi] = stageDefs.map(([sn, kind], si) => {
    const sid = uuid(K.stage, pi * 10 + si + 1);
    insert("project_stages", ["id", "project_id", "name", "kind", "sort_order", "created_at"], [sid, pid, pi === 1 && si === 0 ? "Ideas" : sn, kind, si, ts(2 + pi)]);
    return sid;
  });
});

// 48 tasks: i%3 -> open/done/trashed, every 5th has no project
const taskCount = 48;
const recurrences = [null, null, { freq: "weekly", interval: 1 }, null, { freq: "daily", interval: 2 }, null];
const tasks: { id: string; status: string }[] = [];
for (let i = 0; i < taskCount; i++) {
  const id = uuid(K.task, i + 1);
  const status = ["open", "done", "trashed"][i % 3];
  tasks.push({ id, status });
  const pi = i % 5 === 0 ? -1 : i % 4;
  const stage = pi < 0 ? null : stageIds[pi][status === "done" ? 3 : i % 7 === 0 ? 2 : i % 2];
  const rec = recurrences[i % recurrences.length];
  const complex = i % 11 === 0;
  insert(
    "tasks",
    ["id", "title", "notes", "project_id", "tags", "scheduled", "due_time", "minutes", "priority", "status", "recurrence", "sort_order", "created_at", "completed_at", "deleted_at", "stage_id", "board_order", "is_complex", "finish_date"],
    [id, `Fixture task ${String(i + 1).padStart(2, "0")}`, i % 4 === 0 ? `Notes for task ${i + 1}` : null, pi < 0 ? null : uuid(K.project, pi + 1), raw(arr(i % 3 === 0 ? ["errand", "quick"] : i % 3 === 1 ? ["deep"] : [])), date(3 + i), i % 6 === 0 ? `${String(8 + (i % 10)).padStart(2, "0")}:30` : null, 15 + (i % 5) * 15, i % 4, status, rec === null ? null : raw(`${q(JSON.stringify(rec))}::jsonb`), i, ts(2 + (i % 20), 8), status === "done" ? ts(5 + i, 17) : null, status === "trashed" ? ts(6 + i, 12) : null, stage, i, complex, complex ? date(6 + i) : null],
  );
}
// Subtasks on every 3rd task
let sub = 0;
for (let i = 0; i < taskCount; i += 3) for (let s = 0; s < 3; s++) insert("subtasks", ["id", "task_id", "title", "done", "sort_order", "created_at"], [uuid(K.sub, ++sub), tasks[i].id, `Step ${s + 1} of task ${i + 1}`, s === 0, s, ts(3 + i, 8)]);

// Time entries, each already mirrored as a segment with the same id (v0.1.3
// had migrated them), plus pure activity segments. Nothing is left running.
let seg = 0;
for (let e = 0; e < 10; e++) {
  const id = uuid(K.entry, e + 1);
  const t = tasks[(e * 4) % taskCount];
  const start = ts(10 + e, 9, 0);
  const end = ts(10 + e, 10, 15);
  insert("time_entries", ["id", "task_id", "started_at", "ended_at", "minutes", "note", "running_lock", "created_at", "updated_at"], [id, t.id, start, end, 75, e % 2 ? "Went well" : null, null, start, end]);
  insert("segments", ["id", "started_at", "ended_at", "category_id", "activity_id", "task_id", "note", "source", "running_lock", "created_at", "updated_at"], [id, start, end, cats[0].id, null, t.id, e % 2 ? "Went well" : null, "timer", null, start, end]);
  seg++;
}
for (let a = 0; a < 12; a++) {
  const act = acts[a % acts.length];
  const start = ts(12 + a, 14, 0);
  insert("segments", ["id", "started_at", "ended_at", "category_id", "activity_id", "task_id", "note", "source", "running_lock", "created_at", "updated_at"], [uuid(K.seg, ++seg), start, ts(12 + a, 14, 45), act.cat, act.id, null, null, a % 2 ? "manual" : "backfill", null, start, start]);
}

// Quick todos
["Buy lamp oil", "Email the printer", "Book dentist", "Water the ferns"].forEach((t, i) => insert("quick_todos", ["id", "title", "done", "sort_order", "created_at", "updated_at"], [uuid(K.quick, i + 1), t, i === 3, i, ts(20 + i), ts(20 + i)]));

insert("general_note", ["id", "body", "updated_at"], ["owner", "Fictional scratch note: remember to test the lantern prototype on Friday.", ts(25)]);
insert("tracking_settings", ["id", "day_start_hour", "waking_start_hour", "waking_end_hour", "min_gap_minutes", "module_order", "hidden_modules", "collapsed_modules", "collapsed_modules_seeded", "hidden_nav_items", "updated_at"], ["00000000-0000-0000-0000-000000000001", 5, 6, 22, 15, raw(arr(["now", "ribbon", "unaccounted", "rollups", "signals", "records"])), raw(arr(["signals"])), raw(arr(["ribbon"])), true, raw(arr(["records"])), ts(26)]);

const header = schema();
writeFileSync(out, `${header}\n-- ==== DATA ====\n-- Fictional data only. Generated by build-v013-fixture.ts.\n${lines.join("\n")}\n`);
console.log(`wrote ${out} (${lines.length} inserts)`);
