"use client";

import Card, { CardHeader } from "@/components/ui/Card";
import Checkbox from "@/components/ui/Checkbox";
import Icon from "@/components/ui/Icon";
import { fmt, fmtHours } from "@/lib/format";
import { useTasks } from "@/lib/store-context";
import type { Task } from "@/lib/types";

/** The wrap's Done today card: header with focused total, visible struck-through rows. */
export default function WrapDone({
  tasks,
  focusedMinutes,
}: {
  tasks: Task[];
  focusedMinutes: number;
}) {
  const { reopenTask } = useTasks();

  return (
    <Card>
      <CardHeader
        icon={<Icon name="check" size={16} />}
        title="Done today"
        count={tasks.length}
        right={<span className="font-mono">{`${fmtHours(focusedMinutes)} focused`}</span>}
      />
      {tasks.length > 0 ? (
        <ul className="task-list px-2 pb-2">
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
      ) : null}
    </Card>
  );
}
