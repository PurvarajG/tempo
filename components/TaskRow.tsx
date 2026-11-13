"use client";

import { Children, useMemo, useState } from "react";
import { useTasks } from "@/lib/store-context";
import { fmt, fmtDate, fmtDay, fmtRepeat, fmtTime } from "@/lib/format";
import { isBlocked, isHiddenUntil } from "@/lib/next";
import { projectColorVar, type Task } from "@/lib/types";
import { hasTextSelection } from "@/lib/selection";
import Checkbox from "./ui/Checkbox";
import Icon from "./ui/Icon";
import IconButton from "./ui/IconButton";
import Menu from "./ui/Menu";
import Pill from "./ui/Pill";
import PriorityBadge from "./ui/PriorityBadge";
import PostponeButton from "./ui/PostponeButton";
import SubtaskList from "./SubtaskList";
import TimerButton, { FocusButton } from "./TimerButton";

/** "Waiting on A" or "Waiting on A and 2 more", from the first open blocker. */
function blockerText(task: Task, byId: Map<string, Task>): string | null {
  const open = (task.blockedBy ?? [])
    .map((id) => byId.get(id))
    .filter((t): t is Task => !!t && t.status === "open");
  if (open.length === 0) return null;
  const more = open.length - 1;
  return `Waiting on ${open[0].title}${more > 0 ? ` and ${more} more` : ""}`;
}

export const ITEM = "inline-flex items-center gap-1 whitespace-nowrap";

/** The one-line meta of a task: every fact is its own chip or icon item, never run-on text. */
export function TaskMeta({
  task,
  todayISO,
  showProject = true,
  showDate = false,
  showEstimate = false,
  hidePriority = false,
  nowrap = false,
  lead,
  children,
}: {
  task: Task;
  todayISO: string;
  showProject?: boolean;
  showDate?: boolean;
  showEstimate?: boolean;
  hidePriority?: boolean;
  /** One line, clipped, instead of wrapping. */
  nowrap?: boolean;
  lead?: React.ReactNode;
  children?: React.ReactNode;
}): React.ReactElement | null {
  const { tasks, projects } = useTasks();
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const project = showProject ? projects.find((p) => p.id === task.projectId) : undefined;
  const done = task.status === "done";
  const blocked = !done && isBlocked(task, byId) ? blockerText(task, byId) : null;
  const hidden = !done && isHiddenUntil(task, todayISO);
  const showPriority = !hidePriority && task.priority !== 0;
  const showScheduled = showDate && !!task.scheduled;
  const showEst = showEstimate && task.minutes > 0;

  const hasItems =
    !!lead ||
    showPriority ||
    !!blocked ||
    (hidden && !!task.startOn) ||
    !!project ||
    !!task.dueTime ||
    showScheduled ||
    showEst ||
    !!task.recurrence ||
    task.tags.length > 0 ||
    Children.toArray(children).length > 0;
  if (!hasItems) return null;

  return (
    <div className={`mt-1 flex ${nowrap ? "flex-nowrap overflow-hidden" : "flex-wrap"} items-center gap-3 text-meta text-ink-3`}>
      {lead}
      {showPriority && <PriorityBadge priority={task.priority} />}
      {blocked && (
        <span data-testid="blocked-item" className={`${ITEM} text-ink-3`}>
          <Icon name="clock" size={13} />
          {blocked}
        </span>
      )}
      {hidden && task.startOn && (
        <span className={ITEM}>
          <Icon name="cal" size={13} />
          From {fmtDay(task.startOn)}
        </span>
      )}
      {project && (
        <span className={ITEM}>
          <span className="size-3.5 rounded-sm" style={{ background: projectColorVar(project.color) }} />
          {project.name}
        </span>
      )}
      {showScheduled && task.scheduled && (
        <span className={ITEM}>
          <Icon name="cal" size={13} />
          {task.isComplex && task.finishDate
            ? `${fmtDate(task.scheduled, todayISO)} to ${fmtDate(task.finishDate, todayISO)}`
            : fmtDate(task.scheduled, todayISO)}
        </span>
      )}
      {showEst && (
        <span className={ITEM}>
          <Icon name="clock" size={13} />
          {fmt(task.minutes)}
        </span>
      )}
      {task.dueTime && (
        <span className={ITEM}>
          <Icon name="cal" size={13} />
          Due {fmtTime(task.dueTime)}
        </span>
      )}
      {task.recurrence && (
        <span className={ITEM}>
          <Icon name="repeat" size={13} />
          {fmtRepeat(task.recurrence)}
        </span>
      )}
      {task.tags.map((tag) => (
        <Pill key={tag}>@{tag}</Pill>
      ))}
      {children}
    </div>
  );
}

export default function TaskRow({
  task,
  todayISO,
  onPushTomorrow,
  showProject = true,
  showDate = false,
  draggable = false,
  dragHandleProps,
  trailing,
  actions,
  showCarried = true,
  hideCheckbox = false,
  meta,
}: {
  task: Task;
  todayISO: string;
  onPushTomorrow?: () => void;
  showProject?: boolean;
  showDate?: boolean;
  /** Kept for callers; no longer changes anything. Every row is the mockup .task: 12px padding. */
  compact?: boolean;
  draggable?: boolean;
  dragHandleProps?: React.LiHTMLAttributes<HTMLLIElement>;
  /** Rendered in the right cell, before the estimate. */
  trailing?: React.ReactNode;
  /** Replaces the default hover/focus action cluster (timer, postpone, subtask, menu). */
  actions?: React.ReactNode;
  /** When false, drops the carried-over fill and meta item (the Carried over section already says so). */
  showCarried?: boolean;
  /** Renders an empty 20px spacer in place of the checkbox (Trash rows), so titles still align. */
  hideCheckbox?: boolean;
  /** Extra meta items, rendered last on the meta line (build them with ITEM). */
  meta?: React.ReactNode;
}) {
  const { openTask, completeTask, reopenTask, trashTask, patchTask } = useTasks();
  const [open, setOpen] = useState(false);

  const done = task.status === "done";
  const carriedOver = showCarried && !done && !!task.scheduled && task.scheduled < todayISO;
  const notToday = !done && task.scheduled !== todayISO;
  const doneSubtasks = task.subtasks.filter((s) => s.done).length;

  const menuItems = [
    ...(notToday
      ? [{ id: "today", label: "Do today", icon: "today" as const, onSelect: () => void patchTask(task.id, { scheduled: todayISO }) }]
      : []),
    { id: "open", label: "Open", icon: "panel" as const, onSelect: () => openTask(task.id) },
    { id: "trash", label: "Move to trash", danger: true, onSelect: () => void trashTask(task.id) },
  ];

  return (
    <li
      data-task-id={task.id}
      {...(draggable ? dragHandleProps : undefined)}
      className={`group relative grid ${
        draggable ? "grid-cols-[auto_minmax(0,1fr)_auto]" : "grid-cols-[20px_minmax(0,1fr)_auto]"
      } items-center gap-3 rounded-row px-3 transition-colors duration-150 ease-out hover:bg-row-hover data-[kbd-selected=true]:bg-row-hover ${
        "py-3"
      } ${carriedOver ? "bg-sunk" : ""} ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <div className="flex items-center gap-2">
        {draggable && (
          <span className="shrink-0 text-ink-dim" aria-hidden>
            <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
              <circle cx="3" cy="3" r="1.3" />
              <circle cx="9" cy="3" r="1.3" />
              <circle cx="3" cy="8" r="1.3" />
              <circle cx="9" cy="8" r="1.3" />
              <circle cx="3" cy="13" r="1.3" />
              <circle cx="9" cy="13" r="1.3" />
            </svg>
          </span>
        )}
        {hideCheckbox ? (
          <span aria-hidden className="size-5" />
        ) : (
          <Checkbox
            checked={done}
            onCheckedChange={(next) => void (next ? completeTask(task.id) : reopenTask(task.id))}
            label={done ? `Reopen ${task.title}` : `Mark done ${task.title}`}
          />
        )}
      </div>

      <div className="min-w-0">
        {/* The title is the way into the full editor, from every list. */}
        <button
          type="button"
          onClick={() => {
            if (hasTextSelection()) return;
            openTask(task.id);
          }}
          className={`select-text block w-full min-w-0 truncate text-left text-body font-medium hover:text-accent ${
            done ? "text-ink-3 line-through" : "text-ink"
          }`}
        >
          {task.title}
        </button>

        <TaskMeta task={task} todayISO={todayISO} showProject={showProject} showDate={showDate} hidePriority={done}>
          {task.subtasks.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={`Subtasks for ${task.title}`}
              className={`${ITEM} hover:text-ink`}
            >
              <Icon name="check" size={13} />
              {doneSubtasks}/{task.subtasks.length}
            </button>
          )}
          {carriedOver && (
            <span className={ITEM}>
              <Icon name="today" size={13} />
              Carried over
            </span>
          )}
          {meta}
        </TaskMeta>

        {open && (
          <div className="mt-3">
            <SubtaskList task={task} variant="inline" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {trailing}
        <span className="font-mono text-meta text-ink-3 group-hover:[opacity:0] group-focus-within:[opacity:0] group-data-[kbd-selected=true]:[opacity:0]">{fmt(task.minutes)}</span>
      </div>

      {/* Out of flow so it reserves no width. Shown on hover and whenever a control in the row has focus; opacity keeps the controls tabbable. */}
      <div
        data-testid="row-hover-cluster"
        className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-2 rounded-row [opacity:0] group-hover:pointer-events-auto group-hover:[opacity:1] group-focus-within:pointer-events-auto group-focus-within:[opacity:1] group-data-[kbd-selected=true]:pointer-events-auto group-data-[kbd-selected=true]:[opacity:1]"
      >
        {actions ?? (
          <>
            {!done && <TimerButton taskId={task.id} title={task.title} />}
            {!done && <FocusButton task={task} />}
            {!done && <PostponeButton task={task} todayISO={todayISO} onTomorrow={onPushTomorrow} />}
            <IconButton
              icon="plus"
              label="Add subtask"
              shape="tile"
              onClick={() => setOpen(true)}
            />
            <Menu
              variant="icon"
              label={<Icon name="more" />}
              ariaLabel={`More actions for ${task.title}`}
              items={menuItems}
              className="shrink-0"
            />
          </>
        )}
      </div>
    </li>
  );
}
