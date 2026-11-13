import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const TABLES = [
  "projects",
  "tasks",
  "subtasks",
  "project_stages",
  "general_note",
  "quick_todos",
  "time_entries",
  "categories",
  "activities",
  "segments",
  "tracking_settings",
];

/**
 * Builds a throwaway PGlite directory holding a populated v0.1.3 database
 * (schema at commit dcfc75c plus fictional data). Deliberately bypasses lib/db,
 * which would migrate it to the current schema. The caller owns `dir` and must
 * remove it.
 */
export async function loadV013Fixture(): Promise<{ dir: string; counts: Record<string, number> }> {
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = await mkdtemp(path.join(tmpdir(), "taskmgr-v013-"));
  const sql = await readFile(path.join(__dirname, "v013-populated.sql"), "utf8");
  const pg = new PGlite(dir);
  try {
    await pg.exec(sql);
    const counts: Record<string, number> = {};
    for (const t of TABLES) {
      const r = await pg.query<{ n: number }>(`select count(*)::int as n from ${t}`);
      counts[t] = r.rows[0].n;
    }
    return { dir, counts };
  } finally {
    await pg.close();
  }
}
