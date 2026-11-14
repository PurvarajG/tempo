"use client";

import { useCallback, useMemo, useState } from "react";
import type { Activity, ActivityInput, Category, CategoryInput, Gap, Segment } from "../types";
import { request, RequestFailed } from "./request";

export type SegmentInput = {
  /** Required unless `taskId` is set — a task-linked segment's category is server-resolved. */
  categoryId?: string;
  activityId?: string;
  taskId?: string;
  note?: string;
};

/** Set when a start/switch was refused because something else is already being timed. */
export type SegmentConflictState = { attempted: SegmentInput; runningTaskId: string };

export type SegmentsApi = {
  segments: Segment[];
  setSegments: React.Dispatch<React.SetStateAction<Segment[]>>;
  runningSegment: Segment | null;
  setRunningSegment: React.Dispatch<React.SetStateAction<Segment | null>>;
  gaps: Gap[];
  setGaps: React.Dispatch<React.SetStateAction<Gap[]>>;
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  activities: Activity[];
  setActivities: React.Dispatch<React.SetStateAction<Activity[]>>;
  segmentConflict: SegmentConflictState | null;
  dismissSegmentConflict: () => void;
  /** Minutes recorded for a category among the currently loaded segments — stopped/manual/backfilled only. */
  recordedMinutesForCategory: (categoryId: string) => number;
  loadSegments: (fromISO: string, toISO: string) => Promise<void>;
  loadGaps: (dayISO: string) => Promise<void>;
  startSegment: (input: SegmentInput) => Promise<void>;
  /** Stops whatever is running and starts `input` in one server-side step. */
  switchSegment: (input: SegmentInput) => Promise<void>;
  stopSegment: () => Promise<void>;
  addManualSegment: (input: SegmentInput & { startedAt: string; endedAt: string }) => Promise<void>;
  fillGap: (input: {
    startedAt: string;
    endedAt: string;
    /** Required unless `taskId` is set — a task-linked fill's category is server-resolved. */
    categoryId?: string;
    activityId?: string;
    taskId?: string;
    note?: string;
  }) => Promise<void>;
  patchSegment: (
    id: string,
    patch: Partial<{
      startedAt: string;
      endedAt: string;
      categoryId: string;
      activityId: string;
      taskId: string;
      note: string;
    }>,
  ) => Promise<void>;
  deleteSegment: (id: string) => Promise<void>;
  /** Splits a segment at `at`; both halves replace it locally. Null when the server refused. */
  splitSegmentAt: (id: string, at: string) => Promise<{ before: Segment; after: Segment } | null>;
  addCategory: (input: CategoryInput) => Promise<void>;
  patchCategory: (id: string, patch: Partial<CategoryInput> & { archived?: boolean }) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  reorderCategories: (ids: string[]) => Promise<void>;
  addActivity: (input: ActivityInput) => Promise<void>;
  patchActivity: (
    id: string,
    patch: Partial<ActivityInput> & { archived?: boolean },
  ) => Promise<void>;
  deleteActivity: (id: string) => Promise<void>;
  reorderActivities: (categoryId: string, ids: string[]) => Promise<void>;
};

export function useSegments(onError: (message: string) => void): SegmentsApi {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [runningSegment, setRunningSegment] = useState<Segment | null>(null);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [segmentConflict, setSegmentConflict] = useState<SegmentConflictState | null>(null);

  /** Stopped, manual, and backfilled segments only — the live one is shown separately. */
  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of segments) {
      if (!s.endedAt) continue;
      const minutes = Math.round(
        (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60_000,
      );
      map.set(s.categoryId, (map.get(s.categoryId) ?? 0) + minutes);
    }
    return map;
  }, [segments]);

  const recordedMinutesForCategory = useCallback(
    (categoryId: string) => totals.get(categoryId) ?? 0,
    [totals],
  );

  const loadSegments = useCallback(
    async (fromISO: string, toISO: string) => {
      try {
        const { segments: loaded, running } = await request<{ segments: Segment[]; running: Segment | null }>(
          `/api/segments?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`,
        );
        setSegments(loaded);
        setRunningSegment(running);
      } catch (error) {
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const loadGaps = useCallback(
    async (dayISO: string) => {
      try {
        setGaps(await request<Gap[]>(`/api/segments/gaps?date=${dayISO}`));
      } catch (error) {
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const startSegment = useCallback(
    async (input: SegmentInput) => {
      try {
        const segment = await request<Segment>("/api/segments", {
          method: "POST",
          body: JSON.stringify(input),
        });
        setRunningSegment(segment);
        setSegments((prev) => [segment, ...prev]);
      } catch (error) {
        // 409 isn't a failure to report and forget — it's a decision to offer.
        if (error instanceof RequestFailed && error.status === 409) {
          setSegmentConflict({ attempted: input, runningTaskId: error.runningTaskId ?? "" });
          return;
        }
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const switchSegment = useCallback(
    async (input: SegmentInput) => {
      try {
        const { stopped, started } = await request<{ stopped: Segment | null; started: Segment }>(
          "/api/segments",
          { method: "POST", body: JSON.stringify({ ...input, replaceRunning: true }) },
        );
        setRunningSegment(started);
        setSegments((prev) => [started, ...prev.map((s) => (stopped && s.id === stopped.id ? stopped : s))]);
        setSegmentConflict(null);
      } catch (error) {
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const stopSegment = useCallback(async () => {
    try {
      const stopped = await request<Segment | { stopped: null }>("/api/segments/stop", { method: "POST" });
      setRunningSegment(null);
      if ("id" in stopped) {
        setSegments((prev) => prev.map((s) => (s.id === stopped.id ? stopped : s)));
      }
    } catch (error) {
      onError((error as Error).message);
    }
  }, [onError]);

  const addManualSegment = useCallback<SegmentsApi["addManualSegment"]>(
    async (input) => {
      try {
        const segment = await request<Segment>("/api/segments", {
          method: "POST",
          body: JSON.stringify(input),
        });
        setSegments((prev) => [segment, ...prev]);
      } catch (error) {
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const fillGap = useCallback<SegmentsApi["fillGap"]>(
    async (input) => {
      try {
        const segment = await request<Segment>("/api/segments/fill", {
          method: "POST",
          body: JSON.stringify(input),
        });
        setSegments((prev) => [segment, ...prev]);
        setGaps((prev) =>
          prev.filter((g) => !(g.startedAt === input.startedAt && g.endedAt === input.endedAt)),
        );
      } catch (error) {
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const patchSegment = useCallback<SegmentsApi["patchSegment"]>(
    async (id, patch) => {
      let before: Segment[] = [];
      setSegments((prev) => {
        before = prev;
        return prev.map((s) => (s.id === id ? { ...s, ...patch } : s));
      });
      try {
        const saved = await request<Segment>(`/api/segments/${id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
        setSegments((prev) => prev.map((s) => (s.id === id ? saved : s)));
      } catch (error) {
        setSegments(before);
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const deleteSegment = useCallback(
    async (id: string) => {
      let before: Segment[] = [];
      setSegments((prev) => {
        before = prev;
        return prev.filter((s) => s.id !== id);
      });
      try {
        await request(`/api/segments/${id}`, { method: "DELETE" });
      } catch (error) {
        setSegments(before);
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const splitSegmentAt = useCallback<SegmentsApi["splitSegmentAt"]>(
    async (id, at) => {
      try {
        const halves = await request<{ before: Segment; after: Segment }>(`/api/segments/${id}/split`, {
          method: "POST",
          body: JSON.stringify({ at }),
        });
        setSegments((prev) => {
          const without = prev.filter((s) => s.id !== id && s.id !== halves.before.id && s.id !== halves.after.id);
          return [halves.after, halves.before, ...without];
        });
        // Splitting the live segment leaves the open half (after) running.
        setRunningSegment((prev) =>
          prev && prev.id === id ? (halves.after.endedAt ? null : halves.after) : prev,
        );
        return halves;
      } catch (error) {
        onError((error as Error).message);
        return null;
      }
    },
    [onError],
  );

  const addCategory = useCallback(
    async (input: CategoryInput) => {
      try {
        const created = await request<Category>("/api/categories", {
          method: "POST",
          body: JSON.stringify(input),
        });
        setCategories((prev) => [...prev, created]);
      } catch (error) {
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const patchCategory = useCallback<SegmentsApi["patchCategory"]>(
    async (id, patch) => {
      let before: Category[] = [];
      setCategories((prev) => {
        before = prev;
        return prev.map((c) => (c.id === id ? { ...c, ...patch } : c));
      });
      try {
        const saved = await request<Category>(`/api/categories/${id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
        setCategories((prev) => prev.map((c) => (c.id === id ? saved : c)));
      } catch (error) {
        setCategories(before);
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      try {
        await request(`/api/categories/${id}`, { method: "DELETE" });
        setCategories((prev) => prev.filter((c) => c.id !== id));
      } catch (error) {
        onError((error as Error).message);
        throw error;
      }
    },
    [onError],
  );

  const reorderCategories = useCallback(
    async (ids: string[]) => {
      let before: Category[] = [];
      const order = new Map(ids.map((id, i) => [id, i]));
      setCategories((prev) => {
        before = prev;
        return prev
          .map((c) => (order.has(c.id) ? { ...c, sortOrder: order.get(c.id)! } : c))
          .sort((a, b) => a.sortOrder - b.sortOrder);
      });
      try {
        await request("/api/categories/reorder", { method: "POST", body: JSON.stringify({ ids }) });
      } catch (error) {
        setCategories(before);
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const addActivity = useCallback(
    async (input: ActivityInput) => {
      try {
        const created = await request<Activity>("/api/activities", {
          method: "POST",
          body: JSON.stringify(input),
        });
        setActivities((prev) => [...prev, created]);
      } catch (error) {
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const patchActivity = useCallback<SegmentsApi["patchActivity"]>(
    async (id, patch) => {
      let before: Activity[] = [];
      setActivities((prev) => {
        before = prev;
        return prev.map((a) => (a.id === id ? { ...a, ...patch } : a));
      });
      try {
        const saved = await request<Activity>(`/api/activities/${id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
        setActivities((prev) => prev.map((a) => (a.id === id ? saved : a)));
      } catch (error) {
        setActivities(before);
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const deleteActivity = useCallback(
    async (id: string) => {
      let before: Activity[] = [];
      setActivities((prev) => {
        before = prev;
        return prev.filter((a) => a.id !== id);
      });
      try {
        await request(`/api/activities/${id}`, { method: "DELETE" });
      } catch (error) {
        setActivities(before);
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const reorderActivities = useCallback(
    async (categoryId: string, ids: string[]) => {
      let before: Activity[] = [];
      const order = new Map(ids.map((id, i) => [id, i]));
      setActivities((prev) => {
        before = prev;
        return prev
          .map((a) => (order.has(a.id) ? { ...a, sortOrder: order.get(a.id)! } : a))
          .sort((a, b) => a.sortOrder - b.sortOrder);
      });
      try {
        await request("/api/activities/reorder", {
          method: "POST",
          body: JSON.stringify({ categoryId, ids }),
        });
      } catch (error) {
        setActivities(before);
        onError((error as Error).message);
      }
    },
    [onError],
  );

  return {
    segments,
    setSegments,
    runningSegment,
    setRunningSegment,
    gaps,
    setGaps,
    categories,
    setCategories,
    activities,
    setActivities,
    segmentConflict,
    dismissSegmentConflict: useCallback(() => setSegmentConflict(null), []),
    recordedMinutesForCategory,
    loadSegments,
    loadGaps,
    startSegment,
    switchSegment,
    stopSegment,
    addManualSegment,
    fillGap,
    patchSegment,
    deleteSegment,
    splitSegmentAt,
    addCategory,
    patchCategory,
    deleteCategory,
    reorderCategories,
    addActivity,
    patchActivity,
    deleteActivity,
    reorderActivities,
  };
}
