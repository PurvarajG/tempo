"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import { withSettingsDefaults } from "@/lib/store-context/use-tracking-config";
import { useTasks } from "@/lib/store-context";
import type { Task } from "@/lib/types";

/**
 * Commits a task to tomorrow's 3 (committed_on = dayISO). When tomorrow is
 * full it opens "Swap with..." so a full cap never fails silently.
 */
export default function CommitTomorrow({ task, dayISO }: { task: Task; dayISO: string }): React.ReactElement {
  const { commitTask, uncommitTask, settings } = useTasks();
  const [full, setFull] = useState<Task[] | null>(null);
  const committed = task.committedOn === dayISO;
  const cap = withSettingsDefaults(settings).todayCap;

  async function toggle() {
    if (committed) {
      await uncommitTask(task.id);
      return;
    }
    const r = await commitTask(task.id, dayISO);
    if (r?.ok === false) setFull(r.committed);
  }

  async function swap(other: Task) {
    setFull(null);
    await uncommitTask(other.id);
    await commitTask(task.id, dayISO);
  }

  return (
    <>
      <Button
        variant="chip"
        size="sm"
        aria-pressed={committed}
        icon={committed ? "target" : undefined}
        className={committed ? "[&_svg]:text-accent" : undefined}
        onClick={toggle}
      >
        {committed ? "Committed" : "Commit"}
      </Button>
      <Dialog
        open={full !== null}
        onClose={() => setFull(null)}
        title="Swap with..."
        description={`Tomorrow's ${cap} is full. Pick one to swap out.`}
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
