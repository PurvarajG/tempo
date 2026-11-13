"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import IconButton from "@/components/ui/IconButton";
import { withSettingsDefaults } from "@/lib/store-context/use-tracking-config";
import { useTasks } from "@/lib/store-context";
import type { Task } from "@/lib/types";

/**
 * Commits a task to Today's 3. When the day is full it opens "Swap with..."
 * listing the committed tasks, so a full cap never fails silently.
 */
export default function CommitStar({ task, todayISO }: { task: Task; todayISO: string }) {
  const { commitTask, uncommitTask, settings } = useTasks();
  const [full, setFull] = useState<Task[] | null>(null);
  const committed = task.committedOn === todayISO;
  const cap = withSettingsDefaults(settings).todayCap;

  async function toggle() {
    if (committed) {
      await uncommitTask(task.id);
      return;
    }
    const r = await commitTask(task.id, todayISO);
    if (r?.ok === false) setFull(r.committed);
  }

  async function swap(other: Task) {
    setFull(null);
    await uncommitTask(other.id);
    await commitTask(task.id, todayISO);
  }

  return (
    <>
      <IconButton
        icon="target"
        shape="tile"
        label={committed ? "Remove from Today's 3" : "Add to Today's 3"}
        aria-pressed={committed}
        size={14}
        className={committed ? "!text-accent" : "text-ink-3"}
        onClick={toggle}
      />
      <Dialog
        open={full !== null}
        onClose={() => setFull(null)}
        title="Swap with..."
        description={`Today's ${cap} is full. Pick one to swap out.`}
        actions={
          <Button variant="ghost" onClick={() => setFull(null)}>
            Cancel
          </Button>
        }
      >
        <ul className="flex flex-col gap-2">
          {(full ?? []).map((other) => (
            <li key={other.id} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-body text-ink">{other.title}</span>
              <Button size="sm" variant="chip" onClick={() => swap(other)}>
                Swap
              </Button>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}
