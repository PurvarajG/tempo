"use client";

import { useState } from "react";
import { useTasks } from "@/lib/store-context";
import type { ProjectStage, Task } from "@/lib/types";
import Icon from "@/components/ui/Icon";
import Card from "./Card";
import { laneCountLabel, laneGlyph, openInStage } from "./lanes";

const DONE_VISIBLE = 2;

export default function Column({
  stage,
  stages,
  tasks,
  todayISO,
  projectId,
  dragTaskId,
  dropIndex,
  cardProps,
  columnProps,
  onMove,
}: {
  stage: ProjectStage;
  stages: ProjectStage[];
  tasks: Task[];
  todayISO: string;
  projectId: string;
  dragTaskId: string | null;
  dropIndex: number | null;
  cardProps: (taskId: string, stageId: string, index: number) => React.HTMLAttributes<HTMLElement> & {
    draggable: boolean;
  };
  columnProps: (stageId: string, count: number) => React.HTMLAttributes<HTMLElement>;
  onMove: (taskId: string, stageId: string, index: number) => void;
}) {
  const { addTask } = useTasks();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(false);

  const isDone = stage.kind === "done";
  const glyph = laneGlyph(stage.kind);
  const count = laneCountLabel(tasks.length, openInStage(tasks, stage.id), stage.wipLimit);
  const collapsed = isDone && !expanded && tasks.length > DONE_VISIBLE;
  const shown = collapsed ? tasks.slice(0, DONE_VISIBLE) : tasks;
  const hidden = tasks.length - DONE_VISIBLE;
  const addLabel = `Add a task to ${stage.name}`;

  return (
    <section
      {...columnProps(stage.id, tasks.length)}
      aria-label={`${stage.name}, ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`}
      className="flex min-w-0 flex-col rounded-card bg-sunk p-2"
    >
      <h2 className="flex min-h-12 items-center gap-2 px-2 pt-2 pb-3 text-title text-ink">
        {glyph === "live" ? (
          <span aria-hidden className="mx-1 size-1.5 rounded-full bg-ok shadow-live" />
        ) : (
          <span className="text-ink-2">
            <Icon name={glyph} />
          </span>
        )}
        {stage.name}
        <span className={`font-normal ${count.over ? "text-med" : "text-ink-3"}`}>{count.text}</span>
        <span className="ml-auto flex items-center gap-1">
          {!isDone && (
            <button
              type="button"
              aria-label={addLabel}
              onClick={() => setAdding(true)}
              className="grid size-7 place-items-center rounded-tile text-ink-3 hover:bg-surface"
            >
              <Icon name="plus" />
            </button>
          )}
        </span>
      </h2>

      <ul className="flex flex-col gap-2">
        {shown.map((task, index) => (
          <div key={task.id} className="contents">
            {dropIndex === index && <DropLine />}
            <Card
              task={task}
              stages={stages}
              todayISO={todayISO}
              dragging={dragTaskId === task.id}
              dragProps={cardProps(task.id, stage.id, index)}
              onMoveToStage={(id) => onMove(task.id, id, 0)}
              laneKind={stage.kind}
            />
          </div>
        ))}
        {dropIndex !== null && dropIndex >= shown.length && <DropLine />}

        {tasks.length === 0 && dropIndex === null && (
          <p className="px-2 py-3 text-meta text-ink-3">Nothing here yet.</p>
        )}
      </ul>

      {isDone && tasks.length > DONE_VISIBLE && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className={`${GHOST} mt-2`}>
          {expanded ? "Show less" : `Show ${hidden} more`}
        </button>
      )}

      {adding && (
        <input
          autoFocus
          value={draft}
          aria-label={addLabel}
          placeholder="What needs doing?"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setAdding(false);
            setDraft("");
          }}
          onKeyDown={async (e) => {
            if (e.key === "Escape") (e.target as HTMLInputElement).blur();
            if (e.key !== "Enter" || !draft.trim()) return;
            const text = draft;
            setDraft("");
            await addTask(text, { projectId, stageId: stage.id }).catch(() => {});
          }}
          className="mt-2 h-10 w-full rounded-tab bg-surface px-3 text-body ring-1 ring-line placeholder:text-ink-3"
        />
      )}

      {stage.kind === "backlog" && !adding && (
        <button type="button" onClick={() => setAdding(true)} className={`${GHOST} mt-2`}>
          <Icon name="plus" />
          Add task
        </button>
      )}
    </section>
  );
}

const GHOST =
  "flex h-10 w-full items-center justify-center gap-2 rounded-tab text-secondary text-ink-3 inset-ring-1 inset-ring-line-2";

function DropLine() {
  return <li aria-hidden className="h-0.5 rounded-full bg-accent" />;
}
