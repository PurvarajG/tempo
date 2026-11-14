"use client";

import { useTasks } from "@/lib/store-context";
import Caption from "../ui/Caption";
import SavedCue from "../ui/SavedCue";

/**
 * One note, autosaved. On failure the text stays exactly where the user left
 * it — nothing typed is discarded — and Retry sends what is currently on
 * screen rather than the attempt that failed.
 */
export default function GeneralNote({
  compact = false,
  hideLabel = false,
}: {
  compact?: boolean;
  /** Omits the internal "Notepad" caption — for use inside a rail panel whose
   *  disclosure header already shows the title. */
  hideLabel?: boolean;
}) {
  const { note, noteState, setNote, retryNote } = useTasks();

  return (
    <section>
      <div className="flex items-center justify-between">
        {!hideLabel && <Caption>Notepad</Caption>}
        <SavedCue
          state={noteState}
          onRetry={retryNote}
          className={hideLabel ? "ml-auto" : undefined}
        />
      </div>

      <textarea
        value={note}
        aria-label="General notepad"
        onChange={(e) => setNote(e.target.value)}
        placeholder="Anything you don't want to lose."
        rows={compact ? 4 : 7}
        className={`${compact ? "min-h-24" : ""} mt-2 w-full resize-y rounded-row bg-sunk px-3 py-2 text-body text-ink ring-1 ring-line transition-colors duration-150 ease-out placeholder:text-ink-3 focus-visible:bg-surface focus-visible:ring-line-2`}
      />
    </section>
  );
}
