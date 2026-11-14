"use client";

import { useTasks } from "@/lib/store-context";
import { fmtDate } from "@/lib/format";
import { addDays } from "@/lib/parse";
import type { Task } from "@/lib/types";
import Button from "../ui/Button";
import Card, { CardHeader } from "../ui/Card";
import Icon from "../ui/Icon";
import IconButton from "../ui/IconButton";
import TaskRow from "../TaskRow";
import CommitTomorrow from "./CommitTomorrow";

/** Tomorrow in the wrap: planned tasks, then an open Carried over group, each with Commit, Later and Move to trash. */
export default function TomorrowCard({
  planned,
  carried,
  todayISO,
}: {
  planned: Task[];
  carried: Task[];
  todayISO: string;
}): React.ReactElement {
  const { rescheduleTasks, trashTask } = useTasks();
  const tomorrowISO = addDays(todayISO, 1);

  function row(task: Task) {
    return (
      <TaskRow
        key={task.id}
        task={task}
        todayISO={todayISO}
        actions={
          <>
            <CommitTomorrow task={task} dayISO={tomorrowISO} />
            {!task.isComplex && (
              <Button variant="ghost" size="sm" onClick={() => void rescheduleTasks([task.id], null)}>
                Later
              </Button>
            )}
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
    );
  }

  const empty = planned.length === 0 && carried.length === 0;

  return (
    <Card aria-labelledby="wrap-tomorrow-title">
      <CardHeader
        titleId="wrap-tomorrow-title"
        icon={<Icon name="cal" size={16} />}
        title="Tomorrow"
        count={planned.length + carried.length}
        right={fmtDate(tomorrowISO, todayISO)}
      />
      {empty ? (
        <p className="px-4 pb-4 text-body text-ink-3">Nothing planned for tomorrow yet.</p>
      ) : (
        <div className="px-2 pb-2">
          {planned.length > 0 && <ul className="task-list">{planned.map(row)}</ul>}
          {carried.length > 0 && (
            <>
              <div className="flex justify-between px-3 pb-1 pt-4 text-meta text-ink-3">
                <span>{`Carried over, ${carried.length}`}</span>
              </div>
              <ul className="task-list">{carried.map(row)}</ul>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
