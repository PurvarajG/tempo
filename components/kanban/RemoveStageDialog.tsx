"use client";

import { useRef, useState } from "react";
import { useTasks } from "@/lib/store-context";
import type { ProjectStage } from "@/lib/types";
import Button from "../ui/Button";
import Dialog from "../ui/Dialog";

/**
 * Removing a column can't proceed until its tasks have somewhere to go. The
 * destination is a required choice, not a default that quietly loses work.
 */
export default function RemoveStageDialog({
  stage,
  siblings,
  taskCount,
  onClose,
  onRemoved,
}: {
  stage: ProjectStage;
  siblings: ProjectStage[];
  taskCount: number;
  onClose: () => void;
  onRemoved: (message: string) => void;
}) {
  const { removeStage } = useTasks();
  const [destination, setDestination] = useState("");
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const noSiblings = siblings.length === 0;
  const needsDestination = taskCount > 0;
  const canRemove = !noSiblings && (!needsDestination || destination !== "");

  const description = noSiblings
    ? "A board needs at least one lane."
    : needsDestination
      ? `${taskCount} ${taskCount === 1 ? "task needs" : "tasks need"} a new column first.`
      : "This column is empty.";

  async function remove() {
    if (!canRemove || busy) return;
    setBusy(true);
    try {
      await removeStage(stage.id, destination || siblings[0].id);
      onRemoved(`${stage.name} column removed.`);
      onClose();
    } catch {
      // The store has already surfaced the server's reason.
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={<>Remove &ldquo;{stage.name}&rdquo;</>}
      description={description}
      initialFocusRef={needsDestination && !noSiblings ? undefined : cancelRef}
      actions={
        <>
          <Button ref={cancelRef} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            tone="danger"
            disabled={!canRemove || busy}
            onClick={remove}
          >
            Remove column
          </Button>
        </>
      }
    >
      {needsDestination && !noSiblings && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="stage-destination" className="text-meta font-medium text-ink-2">
            Move tasks to
          </label>
          <select
            id="stage-destination"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="h-10 w-full rounded-row bg-sunk px-3 text-body text-ink inset-ring-1 inset-ring-line-strong"
          >
            <option value="">Choose a column…</option>
            {siblings.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </Dialog>
  );
}
