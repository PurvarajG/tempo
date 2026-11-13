"use client";

import { useEffect, useState } from "react";
import type { SaveState } from "@/lib/store-context";
import Icon from "./Icon";

/**
 * SavedCue: quiet status text for autosave fields. The live region is always
 * mounted so screen readers hear every change. "Saved" fades out after 2s.
 */
export interface SavedCueProps {
  state: SaveState;
  onRetry?: () => void;
  className?: string;
}

const SAVED_VISIBLE_MS = 2000;

export default function SavedCue({ state, onRetry, className }: SavedCueProps) {
  const [savedGone, setSavedGone] = useState(false);

  useEffect(() => {
    if (state !== "saved") return;
    const id = setTimeout(() => setSavedGone(true), SAVED_VISIBLE_MS);
    return () => {
      clearTimeout(id);
      setSavedGone(false);
    };
  }, [state]);

  const classes = [
    "inline-flex min-h-4 items-center gap-1 text-meta transition-opacity duration-150 ease-out",
    state === "error" ? "text-hi" : "text-ink-3",
    state === "saved" && savedGone ? "opacity-0" : "opacity-100",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  let content = null;
  if (state === "saving") {
    content = "Saving";
  } else if (state === "saved") {
    content = (
      <>
        <Icon name="check" size={12} />
        Saved
      </>
    );
  } else if (state === "error") {
    content = (
      <>
        Couldn&apos;t save
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full px-1 font-medium underline underline-offset-2 hover:text-ink"
          >
            Retry
          </button>
        ) : null}
      </>
    );
  }

  return (
    <span role="status" aria-live="polite" className={classes}>
      {content}
    </span>
  );
}
