"use client";

import { useTasks } from "@/lib/store-context";
import Button from "@/components/ui/Button";
import Kbd from "@/components/ui/Kbd";

/**
 * One-line undo offer at the bottom of the main panel. The 6s expiry lives in
 * the store; this only renders the current offer. The live region stays
 * mounted so a new label is announced.
 */
export default function UndoBar() {
  const { undoOffer, undo, dismissUndo } = useTasks();

  return (
    <div role="status" aria-live="polite" className="pointer-events-auto">
      {undoOffer ? (
        <div
          key={undoOffer.id}
          className="flex transition-[opacity,transform] duration-150 ease-out starting:translate-y-1 starting:opacity-0 items-center gap-3 rounded-pill bg-surface py-2 pl-4 pr-2 shadow-md ring-1 ring-line"
        >
          <span className="text-secondary text-ink">{undoOffer.label}</span>
          <Button variant="ghost" size="sm" onClick={() => void undo()}>
            Undo
          </Button>
          {undoOffer.action ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                const action = undoOffer.action;
                if (!action) return;
                await action.run();
                dismissUndo();
              }}
            >
              {undoOffer.action.label}
            </Button>
          ) : null}
          <Kbd keys={["⌘", "Z"]} />
        </div>
      ) : null}
    </div>
  );
}
