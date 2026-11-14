import type { Project, Task } from "./types";

function terms(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/** True when every whitespace-separated term of `query` is a case-insensitive substring of `text`. */
export function matchesQuery(text: string, query: string): boolean {
  const ts = terms(query);
  if (ts.length === 0) return false;
  const hay = text.toLowerCase();
  return ts.every((t) => hay.includes(t));
}

function taskMatches(task: Task, ts: string[]): boolean {
  const title = task.title.toLowerCase();
  const notes = (task.notes ?? "").toLowerCase();
  const tags = task.tags.map((t) => t.toLowerCase());
  return ts.every((t) => title.includes(t) || notes.includes(t) || tags.includes(t));
}

export function searchTasks(tasks: Task[], query: string, limit?: number): Task[] {
  const ts = terms(query);
  if (ts.length === 0) return [];
  const rank = (t: Task) =>
    (t.status === "done" ? 2 : 0) + (t.title.toLowerCase().startsWith(ts[0]) ? 0 : 1);
  const out = tasks
    .filter((t) => t.status !== "trashed" && taskMatches(t, ts))
    .map((t, i) => ({ t, i, r: rank(t) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.t);
  return limit === undefined ? out : out.slice(0, Math.max(0, limit));
}

export function searchProjects(projects: Project[], query: string, limit?: number): Project[] {
  const ts = terms(query);
  if (ts.length === 0) return [];
  const out = projects
    .filter((p) => !p.archived && matchesQuery(p.name, query))
    .map((p, i) => ({ p, i, r: p.name.toLowerCase().startsWith(ts[0]) ? 0 : 1 }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.p);
  return limit === undefined ? out : out.slice(0, Math.max(0, limit));
}
