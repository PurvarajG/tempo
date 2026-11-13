import { fmt } from "./format";

export const FOCUS_MIN_MINUTES = 5;
export const FOCUS_EXTEND_MINUTES = 15;

export type FocusSession = {
  taskId: string;
  title: string;
  /** Length of the countdown as started or last extended. */
  minutes: number;
  /** ISO timestamp. */
  endsAt: string;
  /** True after the user pressed Keep going. */
  acknowledged: boolean;
};

export type FocusPhase = "counting" | "timesUp" | "over";

const MIN_MS = 60_000;

/** The countdown is the remaining estimate, never under the minimum. */
export function focusMinutes(estimate: number | null | undefined, recorded: number): number {
  if (estimate == null || !Number.isFinite(estimate) || estimate <= 0) return FOCUS_MIN_MINUTES;
  const spent = Number.isFinite(recorded) ? recorded : 0;
  return Math.max(FOCUS_MIN_MINUTES, Math.round(estimate - spent));
}

export function startFocusSession(
  task: { id: string; title: string; minutes: number | null | undefined },
  recorded: number,
  now: Date,
): FocusSession {
  const minutes = focusMinutes(task.minutes, recorded);
  return {
    taskId: task.id,
    title: task.title,
    minutes,
    endsAt: new Date(now.getTime() + minutes * MIN_MS).toISOString(),
    acknowledged: false,
  };
}

/** endsAt minus now; negative once the time is up. */
export function focusRemainingMs(session: FocusSession, now: Date): number {
  return new Date(session.endsAt).getTime() - now.getTime();
}

export function focusPhase(session: FocusSession, now: Date): FocusPhase {
  if (focusRemainingMs(session, now) > 0) return "counting";
  return session.acknowledged ? "over" : "timesUp";
}

export function extendFocusSession(
  session: FocusSession,
  now: Date,
  minutes: number = FOCUS_EXTEND_MINUTES,
): FocusSession {
  const base = Math.max(new Date(session.endsAt).getTime(), now.getTime());
  return {
    ...session,
    minutes,
    endsAt: new Date(base + minutes * MIN_MS).toISOString(),
    acknowledged: false,
  };
}

export function acknowledgeFocusSession(session: FocusSession): FocusSession {
  return { ...session, acknowledged: true };
}

export function focusOverLine(session: FocusSession, now: Date): string {
  const m = Math.max(1, Math.floor(-focusRemainingMs(session, now) / MIN_MS));
  return `Over the estimate by ${fmt(m)}.`;
}
