"use client";

import { useState } from "react";
import { useTasks } from "@/lib/store-context";
import { addDays } from "@/lib/parse";
import type { Task } from "@/lib/types";
import { QUIET_AFTER_DAYS } from "@/lib/wrap";
import Button from "../ui/Button";
import Card, { CardHeader } from "../ui/Card";
import Icon from "../ui/Icon";
import IconButton from "../ui/IconButton";
import TaskRow from "../TaskRow";

/**
 * Weekly reset: open tasks untouched for 14 days. Keep, Push back a week or
 * Move to trash.
 */
export default function GoneQuiet({ tasks, todayISO }: { tasks: Task[]; todayISO: string }) {
  const { patchTask, trashTask } = useTasks();
  // Keep only hides the row for this visit. Tasks have no updated_at column,
  // so there is nothing to write.
  const [kept, setKept] = useState<ReadonlySet<string>>(new Set());
  const shown = tasks.filter((t) => !kept.has(t.id));

  return (
    <Card aria-labelledby="gone-quiet-title">
      <CardHeader
        titleId="gone-quiet-title"
        icon={<Icon name="clock" size={14} />}
        title="Gone quiet"
        count={shown.length}
        right={`Untouched for ${QUIET_AFTER_DAYS} days`}
      />
      {shown.length === 0 ? (
        <p className="px-4 pb-4 text-body text-ink-3">Nothing has gone quiet.</p>
      ) : (
        <ul className="task-list px-2 pb-2">
          {shown.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              todayISO={todayISO}
              actions={
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setKept((prev) => new Set(prev).add(task.id))}
                  >
                    Keep
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void patchTask(task.id, { startOn: addDays(todayISO, 7) })}
                  >
                    Push back a week
                  </Button>
                  <IconButton
                    icon="trash"
                    shape="tile"
                    size={14}
                    label="Move to trash"
                    onClick={() => void trashTask(task.id)}
                  />
                </>
              }
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
