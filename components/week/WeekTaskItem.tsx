"use client";

import { fmt } from "@/lib/format";
import { useTasks } from "@/lib/store-context";
import { projectColorVar, type Task } from "@/lib/types";
import Checkbox from "@/components/ui/Checkbox";

export interface WeekTaskItemProps {
  task: Task;
}

/** The compact task line inside a day row: checkbox, project dot, title, estimate. */
export default function WeekTaskItem({ task }: WeekTaskItemProps) {
  const { projects, completeTask, reopenTask, openTask } = useTasks();
  const project = task.projectId ? projects.find((p) => p.id === task.projectId) : undefined;
  const done = task.status === "done";

  return (
    <li className="flex items-center gap-3 text-body">
      <Checkbox
        size="sm"
        label={`Mark done: ${task.title}`}
        checked={done}
        onCheckedChange={(next) => void (next ? completeTask(task.id) : reopenTask(task.id))}
      />
      <span
        aria-hidden="true"
        data-testid="week-task-dot"
        className="size-2 flex-none rounded-pdot"
        style={project ? { background: projectColorVar(project.color) } : undefined}
      />
      <button
        type="button"
        onClick={() => openTask(task.id)}
        className={`min-w-0 flex-1 truncate text-left ${done ? "text-ink-3 line-through" : "text-ink"}`}
      >
        {task.title}
      </button>
      {task.minutes > 0 && <span className="flex-none font-mono text-meta text-ink-3">{fmt(task.minutes)}</span>}
    </li>
  );
}
