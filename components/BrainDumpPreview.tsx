"use client";

import Button from "@/components/ui/Button";
import { fmt, fmtDate, fmtRepeat, fmtTime, PRIORITY_NAME } from "@/lib/format";
import { parseQuickAdd, toISODate } from "@/lib/parse";
import type { ParsedQuickAdd } from "@/lib/parse";
import { useTasks } from "@/lib/store-context";
import { withSettingsDefaults } from "@/lib/store-context/use-tracking-config";

export type Chip = { key: string; text: string; tone?: "accent" };

export function chipClass(tone?: "accent"): string {
  return [
    "inline-flex items-center whitespace-nowrap rounded-full px-2 py-1 font-mono text-caption",
    tone === "accent" ? "bg-accent-soft text-accent" : "bg-sunk text-ink-3",
  ].join(" ");
}

/** The chips a parsed line shows, plus the unmatched #project name (if any). */
export function parsedChips(
  p: ParsedQuickAdd,
  projects: { name: string }[],
): { chips: Chip[]; unknownProject: string | null } {
  const today = toISODate(new Date());
  const chips: Chip[] = [];
  if (p.scheduled !== undefined) {
    chips.push({ key: "date", text: p.scheduled ? fmtDate(p.scheduled, today) : "No date" });
  }
  if (p.dueTime) chips.push({ key: "time", text: fmtTime(p.dueTime) });
  if (p.minutes !== undefined) chips.push({ key: "est", text: fmt(p.minutes) });
  if (p.priority) chips.push({ key: "prio", text: PRIORITY_NAME[p.priority] });
  let unknownProject: string | null = null;
  if (p.projectName) {
    const match = projects.find((pr) => pr.name.toLowerCase() === p.projectName!.toLowerCase());
    if (match) chips.push({ key: "project", text: match.name });
    else unknownProject = p.projectName;
  }
  if (p.recurrence) chips.push({ key: "repeat", text: fmtRepeat(p.recurrence) });
  return { chips, unknownProject };
}

export default function BrainDumpPreview({
  lines,
  onAdd,
  onCancel,
}: {
  lines: string[];
  onAdd: () => void;
  onCancel: () => void;
}): React.ReactElement {
  const { projects, settings } = useTasks();
  const dateOrder = withSettingsDefaults(settings).dateOrder;

  return (
    <section
      aria-label="Add several tasks"
      className="mt-3 flex flex-col gap-3 rounded-card bg-surface p-4 shadow-sm ring-1 ring-line"
    >
      <h2 className="text-title font-medium text-ink">Add {lines.length} tasks?</h2>
      <ul className="flex flex-col gap-2">
        {lines.map((line, i) => {
          const p = parseQuickAdd(line, new Date(), { dateOrder });
          const { chips } = parsedChips(p, projects);
          return (
            <li key={`${i}-${line}`} className="flex flex-wrap items-center gap-2 text-body text-ink">
              <span className="min-w-0 flex-1 truncate">{p.title || line}</span>
              {chips.map((c) => (
                <span key={c.key} className={chipClass()}>
                  {c.text}
                </span>
              ))}
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={onAdd}>
          Add
        </Button>
      </div>
    </section>
  );
}
