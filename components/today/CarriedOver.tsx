"use client";

import { useState } from "react";
import { useTasks } from "@/lib/store-context";
import { addDays, daysBetween } from "@/lib/parse";
import { STALE_AFTER_DAYS, type Task } from "@/lib/types";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import IconButton from "../ui/IconButton";
import TaskRow from "../TaskRow";

/**
 * Tasks carried over from earlier days, collapsed by default. Stale means
 * carried for STALE_AFTER_DAYS or more (lib/focus.ts isStale is strictly
 * greater, so it is not used here). No ages are shown.
 */
export default function CarriedOver({ tasks, todayISO }: { tasks: Task[]; todayISO: string }) {
  const { rescheduleTasks, trashTask } = useTasks();
  const [open, setOpen] = useState(false);

  if (tasks.length === 0) return null;

  const tomorrowISO = addDays(todayISO, 1);
  const allIds = tasks.map((t) => t.id);
  const staleIds = tasks
    .filter((t) => t.scheduled !== null && daysBetween(t.scheduled, todayISO) >= STALE_AFTER_DAYS)
    .map((t) => t.id);

  return (
    <section id="carried-over" aria-label="Carried over">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="carried-over-list"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-9 items-center gap-2 rounded-full px-3 text-secondary font-medium text-ink hover:bg-sunk"
        >
          <Icon name="chev" size={14} className={open ? "rotate-90" : ""} />
          {`Carried over, ${tasks.length}`}
        </button>
      </div>

      {open && (
        <div id="carried-over-list" className="mt-2">
          <div className="mb-2 flex items-center justify-end gap-1 px-3">
            <Button size="sm" onClick={() => void rescheduleTasks(allIds, todayISO)}>
              Move all to today
            </Button>
            <Button size="sm" onClick={() => void rescheduleTasks(allIds, tomorrowISO)}>
              Move all to tomorrow
            </Button>
          </div>
          {staleIds.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-2 px-3">
              <p className="text-meta text-ink-2">
                Some of these have been carried over for a week or more.
              </p>
              <Button size="sm" onClick={() => void rescheduleTasks(staleIds, null)}>
                Move them to the inbox
              </Button>
            </div>
          )}
          <ul className="task-list">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                todayISO={todayISO}
                compact
                showCarried={false}
                actions={
                  <>
                    <Button variant="ghost" size="sm" onClick={() => void rescheduleTasks([task.id], todayISO)}>
                      Today
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void rescheduleTasks([task.id], tomorrowISO)}>
                      Tomorrow
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
        </div>
      )}
    </section>
  );
}
