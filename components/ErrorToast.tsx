"use client";

import { useTasks } from "@/lib/store-context";
import Button from "@/components/ui/Button";

/**
 * Shows the server's own wording, so "That did not save" is the last resort.
 * Not positioned: the feedback stack in the main panel places it.
 */
export default function ErrorToast() {
  const { error, dismissError } = useTasks();
  if (!error) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto flex items-center gap-3 rounded-pill bg-surface px-4 py-3 shadow-md ring-1 ring-line"
    >
      <span className="text-secondary text-ink">{error}</span>
      <Button variant="ghost" size="sm" onClick={dismissError}>
        Dismiss
      </Button>
    </div>
  );
}
