import { fmt, fmtDate, fmtTime, PRIORITY_NAME } from "./format";
import type { Project, Task } from "./types";

const NOTES_MAX = 120;

function firstLine(notes: string): string {
  const line = notes.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  return line.length > NOTES_MAX ? line.slice(0, NOTES_MAX).trimEnd() : line;
}

/** Plain-text prompt for pasting today's open tasks into Claude Code. */
export function todayTasksPrompt({
  open,
  projects,
  todayISO,
}: {
  open: Task[];
  projects: Project[];
  todayISO: string;
}): string {
  const head = `My tasks for today, ${fmtDate(todayISO)} (from Doem):`;
  if (open.length === 0) return `${head} nothing open.`;

  const names = new Map(projects.map((p) => [p.id, p.name]));
  const lines = open.map((t, i) => {
    const facts: string[] = [];
    if (t.priority === 1 || t.priority === 2) facts.push(PRIORITY_NAME[t.priority]);
    const project = t.projectId ? names.get(t.projectId) : undefined;
    if (project) facts.push(project);
    if (t.minutes > 0) facts.push(fmt(t.minutes));
    if (t.dueTime) facts.push(`due ${fmtTime(t.dueTime)}`);
    let line = `${i + 1}. ${t.title}${facts.length ? ` (${facts.join(", ")})` : ""}`;
    const note = t.notes ? firstLine(t.notes) : "";
    if (note) line += `\n   Notes: ${note}`;
    return line;
  });
  return `${head}\n\n${lines.join("\n")}`;
}
