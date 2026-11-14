"use client";

import Checkbox from "@/components/ui/Checkbox";
import { fmt } from "@/lib/format";
import { useTasks } from "@/lib/store-context";
import type { Task } from "@/lib/types";

/** Open by design (soft.html 539-543): a header line with the total, then the done rows. */
export default function DoneToday({ tasks }: { tasks: Task[] }) {
  const { reopenTask } = useTasks();
  if (tasks.length === 0) return null;
  const total = tasks.reduce((sum, t) => sum + t.minutes, 0);

  return (
    <section aria-label="Done today">
      <div className="flex items-center justify-between px-3 pb-1 pt-4 text-meta text-ink-3">
        <span>{`Done today, ${tasks.length}`}</span>
        <span className="font-mono">{fmt(total)}</span>
      </div>
      <ul className="task-list">
        {tasks.map((t) => (
          <li key={t.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-row px-3 py-3">
            <Checkbox checked onCheckedChange={() => void reopenTask(t.id)} label={`Reopen ${t.title}`} />
            <span className="min-w-0 truncate text-body font-normal text-ink-3 line-through decoration-line-2">
              {t.title}
            </span>
            <span className="font-mono text-meta text-ink-3">{fmt(t.minutes)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
