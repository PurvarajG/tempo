"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type UndoAction = { label: string; run: () => void | Promise<void> };
export type UndoOffer = {
  id: number;
  label: string;
  revert: () => void | Promise<void>;
  action?: UndoAction;
};
export type UndoApi = {
  undoOffer: UndoOffer | null;
  offerUndo: (label: string, revert: () => void | Promise<void>, action?: UndoAction) => void;
  /** Runs the current offer's revert once, then clears it; no-op when none. */
  undo: () => Promise<void>;
  /** Clears the offer without reverting. */
  dismissUndo: () => void;
};

export const UNDO_MS = 6000;

export function useUndo(): UndoApi {
  const [undoOffer, setUndoOffer] = useState<UndoOffer | null>(null);
  const offerRef = useRef<UndoOffer | null>(null);
  const idRef = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const clear = useCallback(() => {
    clearTimer();
    offerRef.current = null;
    setUndoOffer(null);
  }, [clearTimer]);

  const offerUndo = useCallback(
    (label: string, revert: () => void | Promise<void>, action?: UndoAction) => {
      clearTimer();
      idRef.current += 1;
      const offer: UndoOffer = { id: idRef.current, label, revert, action };
      offerRef.current = offer;
      setUndoOffer(offer);
      timer.current = setTimeout(() => {
        if (offerRef.current?.id === offer.id) clear();
      }, UNDO_MS);
    },
    [clear, clearTimer],
  );

  const undo = useCallback(async () => {
    const offer = offerRef.current;
    if (!offer) return;
    clear();
    await offer.revert();
  }, [clear]);

  useEffect(() => clearTimer, [clearTimer]);

  return { undoOffer, offerUndo, undo, dismissUndo: clear };
}
