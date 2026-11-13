"use client";

import type { Task } from "@/lib/types";
import { useTasks } from "@/lib/store-context";
import { fmt, fmtDate, fmtRange, fmtTime } from "@/lib/format";
import { isHiddenUntil } from "@/lib/next";
import { isOverdue } from "@/lib/summary";
import { hasTextSelection } from "@/lib/selection";
import Icon from "../ui/Icon";
import Pill from "../ui/Pill";
import PriorityBadge from "../ui/PriorityBadge";

const META_ITEM = "inline-flex items-center gap-1";

export type BoardCardProps = { task: Task; todayISO: string; actions?: React.ReactNode; dimmed?: boolean };

/** A board card (soft.html .kc) for the Today and Next 7 days boards: kanban Card minus drag and stage menu. */
export default function BoardCard({ task, todayISO, actions, dimmed }: BoardCardProps) {
  const { openTask, running, recordedMinutes } = useTasks();

  const done = task.status === "done";
  const isRunning = running?.taskId === task.id;
  const recorded = recordedMinutes(task.id);
  const hidden = !done && isHiddenUntil(task, todayISO);
  const carried = !done && task.status === "open" && isOverdue(task, todayISO);
  const doneSubtasks = task.subtasks.filter((s) => s.done).length;
  // Mockup: only the running card draws the thin progress bar (.mini); tracked cards show the dashed footer only.
  const showBar = isRunning && task.minutes > 0;
  const prio = !done && task.priority > 0;

  let dateText: string | null = null;
  if (task.scheduled) {
    dateText =
      task.isComplex && task.finishDate
        ? fmtRange(task.scheduled, task.finishDate)
        : fmtDate(task.scheduled, todayISO);
    if (task.dueTime && !task.isComplex) dateText += `, ${fmtTime(task.dueTime)}`;
  }

  let doneText = "Done";
  if (done && task.completedAt) {
    const day = task.completedAt.slice(0, 10);
    doneText = day === todayISO ? "Done today" : `Done ${fmtDate(day, todayISO)}`;
  }

  let right: React.ReactNode = null;
  if (isRunning) right = <span className="text-ok font-medium">Running</span>;
  else if (recorded > 0) right = <span>{`${fmt(recorded)} tracked`}</span>;
  else if (!done) right = <span>Not started</span>;

  return (
    <li
      className={`group relative bg-surface rounded-tab p-3 ring-1 ring-line shadow-sm transition-shadow hover:ring-line-2 hover:shadow-md ${
        dimmed || hidden ? "opacity-60" : ""
      }`}
    >
      {actions && (
        <div className="absolute right-2 top-2 z-10 flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          {actions}
        </div>
      )}

      {prio && <PriorityBadge priority={task.priority} />}

      <h3 className={`text-card-title mb-1 ${prio ? "mt-2" : ""}`}>
        <button
          onClick={() => {
            if (hasTextSelection()) return;
            openTask(task.id);
          }}
          className={`select-text min-w-0 text-left ${
            done ? "text-ink-3 line-through decoration-line-2" : "text-ink"
          }`}
        >
          {task.title}
        </button>
      </h3>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-ink-3">
        {done ? (
          <span className={META_ITEM}>
            <Icon name="check" size={12} />
            {doneText}
          </span>
        ) : (
          <span className={META_ITEM}>
            <Icon name="cal" size={12} />
            {hidden && task.startOn ? `From ${fmtDate(task.startOn, todayISO)}` : (dateText ?? "No date")}
          </span>
        )}
        {carried && (
          <span className={META_ITEM}>
            <Icon name="today" size={12} />
            Carried over
          </span>
        )}
        {task.subtasks.length > 0 && (
          <span className={META_ITEM}>
            <Icon name="check" size={12} />
            {`${doneSubtasks}/${task.subtasks.length} subtasks`}
          </span>
        )}
      </div>

      {task.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <Pill key={tag}>{tag}</Pill>
          ))}
        </div>
      )}

      {showBar && (
        <div data-testid="card-progress" className="mt-2 h-1 overflow-hidden rounded-full bg-off">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${Math.min(100, (recorded / task.minutes) * 100)}%` }}
          />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-dashed border-line-2 pt-2 text-meta text-ink-3">
        <span>
          {isRunning ? (
            <>
              Tracked <b className="font-mono font-medium text-ink-2">{fmt(recorded)}</b> of {fmt(task.minutes)}
            </>
          ) : (
            <>
              Estimate <b className="font-mono font-medium text-ink-2">{fmt(task.minutes)}</b>
            </>
          )}
        </span>
        {right}
      </div>
    </li>
  );
}
