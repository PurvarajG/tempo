"use client";

import { useState } from "react";
import { useTasks } from "@/lib/store-context";
import type { Gap } from "@/lib/types";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import CategoryPicker from "./CategoryPicker";
import TaskPicker from "./TaskPicker";

/**
 * A backfill is either a category (its own category picker) or a task (its
 * category comes from the task's project, server-side), never both, same
 * one-subject rule a live segment follows. Shared by the gaps module and the ribbon.
 * Renders as a sunk inline block so it reads as a nested editor.
 */
export default function GapFillForm({ gap, onFilled }: { gap: Gap; onFilled: () => void }) {
  const { categories, tasks, projects, fillGap } = useTasks();
  const [categoryId, setCategoryId] = useState<string | undefined>(categories[0]?.id);
  const [taskId, setTaskId] = useState<string | undefined>(undefined);
  const [note, setNote] = useState("");

  const canFill = !!taskId || !!categoryId;

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-row bg-sunk p-3">
      <div className="flex flex-wrap items-center gap-2">
        {taskId ? (
          <TaskPicker tasks={tasks} projects={projects} value={taskId} onChange={setTaskId} clearable />
        ) : (
          <>
            <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />
            <span className="text-meta text-ink-3">or</span>
            <TaskPicker
              tasks={tasks}
              projects={projects}
              value={taskId}
              onChange={setTaskId}
              placeholder="Link a task"
            />
          </>
        )}
      </div>
      <Input
        aria-label="Note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
        wrapperClassName="bg-surface"
      />
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onFilled}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={!canFill}
          onClick={() => {
            if (!canFill) return;
            fillGap({
              startedAt: gap.startedAt,
              endedAt: gap.endedAt,
              ...(taskId ? { taskId } : { categoryId }),
              note: note || undefined,
            });
            onFilled();
          }}
        >
          Fill
        </Button>
      </div>
    </div>
  );
}
