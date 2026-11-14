"use client";

import { useCallback, useMemo } from "react";
import type { DayEnergy, DayReview } from "../types";
import { request, RequestFailed } from "./request";

export type DayReviewsApi = {
  /** Null when that day has no review yet (a 404 is not an error). */
  getDayReview: (day: string) => Promise<DayReview | null>;
  saveDayReview: (
    day: string,
    input: { energy: DayEnergy | null; note: string | null },
  ) => Promise<DayReview | null>;
};

export function useDayReviews(onError: (message: string) => void): DayReviewsApi {
  const getDayReview = useCallback(
    async (day: string) => {
      try {
        return await request<DayReview>(`/api/day-reviews?day=${encodeURIComponent(day)}`);
      } catch (error) {
        if (error instanceof RequestFailed && error.status === 404) return null;
        onError((error as Error).message);
        return null;
      }
    },
    [onError],
  );

  const saveDayReview = useCallback<DayReviewsApi["saveDayReview"]>(
    async (day, input) => {
      try {
        return await request<DayReview>("/api/day-reviews", {
          method: "PUT",
          body: JSON.stringify({ day, ...input }),
        });
      } catch (error) {
        onError((error as Error).message);
        return null;
      }
    },
    [onError],
  );

  return useMemo(() => ({ getDayReview, saveDayReview }), [getDayReview, saveDayReview]);
}
