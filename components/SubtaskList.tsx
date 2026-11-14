"use client";

import { useState } from "react";
import { useTasks } from "@/lib/store-context";
import type { Task } from "@/lib/types";
import Caption from "./ui/Caption";
import Checkbox from "./ui/Checkbox";
import Input from "./ui/Input";

export interface SubtaskListProps {
  task: Task;
  /** panel: heading with count (task panel). inline: no heading, compact (task row). */
  variant?: "panel" | "inline";
}

export default function SubtaskList({ task, variant = "panel" }: SubtaskListProps) {
  const { addSubtask, toggleSubtask, deleteSubtask } = useTasks();
  const [text, setText] = useState("");
  const inline = variant === "inline";
  const done = task.subtasks.filter((s) => s.done).length;
  // The server assigns max+1, so ascending sortOrder is the order they were typed.
  const ordered = [...task.subtasks].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <section className={inline ? "space-y-1.5" : "space-y-2"}>
      {!inline && (
        <Caption as="h3">
          Subtasks
          {task.subtasks.length > 0 && ` ${done}/${task.subtasks.length}`}
        </Caption>
      )}

      {ordered.length > 0 && (
        <ul className={inline ? "space-y-1" : "space-y-1.5"}>
          {ordered.map((s) => (
            <li key={s.id} className="group flex items-center gap-2.5">
              <Checkbox
                size="sm"
                checked={s.done}
                label={s.done ? `Reopen ${s.title}` : `Complete ${s.title}`}
                onCheckedChange={(next) => toggleSubtask(task.id, s.id, next)}
              />
              <span
                className={`select-text min-w-0 flex-1 text-secondary ${
                  s.done ? "text-ink-3 line-through" : "text-ink"
                }`}
              >
                {s.title}
              </span>
              <button
                type="button"
                onClick={() => deleteSubtask(task.id, s.id)}
                aria-label={`Delete ${s.title}`}
                className="shrink-0 rounded-tile px-1.5 text-secondary text-ink-3 opacity-0 transition-opacity duration-150 ease-out hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <Input
        value={text}
        aria-label="Add subtask"
        placeholder="Add subtask"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && text.trim()) {
            addSubtask(task.id, text.trim());
            setText("");
          }
        }}
      />
    </section>
  );
}
