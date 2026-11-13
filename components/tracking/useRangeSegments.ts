"use client";

import { useEffect, useRef, useState } from "react";
import { useTasks } from "@/lib/store-context";
import { request } from "@/lib/store-context/request";
import { addDays } from "@/lib/parse";
import type { Segment } from "@/lib/types";

/** Local midnight of a YYYY-MM-DD date, as a UTC ISO timestamp. */
function localMidnightISO(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toISOString();
}

/**
 * Read-only: fetches segments for local dates startISO..endISO inclusive from
 * GET /api/segments. Refetches when the dates change and whenever the store's
 * `segments` array or `runningSegment` reference changes, so edits, starts and
 * stops on the page show up. The running segment is appended when the response
 * has it and the list does not. A failed fetch keeps the previous segments, and
 * a response that arrives after a newer request was sent is ignored.
 */
export function useRangeSegments(
  startISO: string | null,
  endISO: string | null,
): { segments: Segment[]; loading: boolean } {
  const { segments: storeSegments, runningSegment } = useTasks();
  // The inputs a fetch was made for travel with its result, so "loading" is
  // derived (current inputs differ from the settled ones), never set in an effect.
  const [settled, setSettled] = useState<{
    start: string | null;
    end: string | null;
    store: Segment[];
    running: unknown;
    segments: Segment[];
  } | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    if (!startISO || !endISO) {
      latest.current += 1; // invalidate anything still in flight
      return;
    }
    const id = ++latest.current;
    const from = localMidnightISO(startISO);
    const to = localMidnightISO(addDays(endISO, 1));
    const done = (segments: Segment[] | null) =>
      setSettled((prev) => ({
        start: startISO,
        end: endISO,
        store: storeSegments,
        running: runningSegment,
        segments: segments ?? prev?.segments ?? [],
      }));
    request<{ segments: Segment[]; running: Segment | null }>(
      `/api/segments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    )
      .then(({ segments: loaded, running }) => {
        if (id !== latest.current) return;
        done(running && !loaded.some((s) => s.id === running.id) ? [...loaded, running] : loaded);
      })
      .catch(() => {
        if (id !== latest.current) return;
        done(null);
      });
  }, [startISO, endISO, storeSegments, runningSegment]);

  const active = !!startISO && !!endISO;
  const loading =
    active &&
    !(
      settled &&
      settled.start === startISO &&
      settled.end === endISO &&
      settled.store === storeSegments &&
      settled.running === runningSegment
    );
  return { segments: active && settled ? settled.segments : [], loading };
}
