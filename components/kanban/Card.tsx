"use client";

import { useTasks } from "@/lib/store-context";
import { fmt, fmtDate, fmtRange, fmtTime } from "@/lib/format";
import { isHiddenUntil } from "@/lib/next";
import { isOverdue } from "@/lib/summary";
import type { ProjectStage, StageKind, Task } from "@/lib/types";
import { hasTextSelection } from "@/lib/selection";
import TimerButton from "../TimerButton";
import Icon from "../ui/Icon";
import Menu from "../ui/Menu";
import Pill from "../ui/Pill";
import PriorityBadge from "../ui/PriorityBadge";
import { hereLabel } from "./lanes";

const META_ITEM = "inline-flex items-center gap-1";

/**
 * A board card (soft.html .kc). Priority pill on top, 14/500 title, icon meta
 * items, outlined tag pills, a mini progress bar (running card only) and a dashed footer. Hover
 * controls are absolutely positioned so they never take width from the title.
 */
export default function Card({
  task,
  stages,
  todayISO,
  dragging,
  dragProps,
  onMoveToStage,
}: {
  task: Task;
  stages: ProjectStage[];
  todayISO: string;
  dragging: boolean;
  dragProps: React.HTMLAttributes<HTMLElement> & { draggable: boolean };
  onMoveToStage: (stageId: string) => void;
  laneKind: StageKind;
}) {
  const { openTask, running, recordedMinutes } = useTasks();

  const done = task.status === "done";
  const isRunning = running?.taskId === task.id;
  const recorded = recordedMinutes(task.id);
  const hidden = !done && isHiddenUntil(task, todayISO);
  const carried = !done && task.status === "open" && isOverdue(task, todayISO);
  const doneSubtasks = task.subtasks.filter((s) => s.done).length;
  const here = hereLabel(task, todayISO);
  const showBar = isRunning && task.minutes > 0;

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
  else if (here) right = <span>{here}</span>;
  else if (recorded > 0) right = <span>{`${fmt(recorded)} tracked`}</span>;
  else if (!done) right = <span>Not started</span>;

  return (
    <li
      {...dragProps}
      className={`group relative bg-surface rounded-tab p-3 ring-1 ring-line shadow-sm transition-shadow hover:ring-line-2 hover:shadow-md ${
        dragging ? "opacity-40" : hidden ? "opacity-60" : ""
      }`}
    >
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        {!done && <TimerButton taskId={task.id} title={task.title} />}
        <Menu
          variant="icon"
          label={<Icon name="updown" />}
          ariaLabel={`Move ${task.title} to another column`}
          items={stages.map((stage) => {
            const current = stage.id === task.stageId;
            return {
              id: stage.id,
              label: current ? `${stage.name} (here)` : `Move to ${stage.name}`,
              disabled: current,
              onSelect: () => onMoveToStage(stage.id),
            };
          })}
        />
      </div>

      {!done && task.priority > 0 && <PriorityBadge priority={task.priority} />}

      <h3 className={`text-card-title mb-1 ${!done && task.priority > 0 ? "mt-2" : ""}`}>
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
        ) : hidden && task.startOn ? (
          <span className={META_ITEM}>
            <Icon name="cal" size={12} />
            {`From ${fmtDate(task.startOn, todayISO)}`}
          </span>
        ) : dateText ? (
          <span className={META_ITEM}>
            <Icon name="cal" size={12} />
            {dateText}
          </span>
        ) : (
          <span className={META_ITEM}>
            <Icon name="cal" size={12} />
            No date
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
