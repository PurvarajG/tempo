// Pure idle-split plan for the away prompt (4.2). No React, no fetch.

export type AwayChoice = "keep" | "break" | "discard";

export type AwayPlan =
  | { kind: "none" } // away span does not overlap the running timer
  | { kind: "keep" }
  | { kind: "break"; endAt: string; restFrom: string; restTo: string; resumeAt: string }
  | { kind: "discard"; endAt: string };

function ms(iso: string): number {
  return new Date(iso).getTime();
}

export function planAway(
  choice: AwayChoice,
  runningStartedAt: string,
  awayFrom: string,
  awayTo: string,
): AwayPlan {
  const started = ms(runningStartedAt);
  const from = ms(awayFrom);
  const to = ms(awayTo);
  if (Number.isNaN(started) || Number.isNaN(from) || Number.isNaN(to)) return { kind: "none" };
  const clamped = Math.max(from, started);
  if (clamped >= to) return { kind: "none" };
  const fromIso = new Date(clamped).toISOString();
  const toIso = new Date(to).toISOString();
  if (choice === "keep") return { kind: "keep" };
  if (choice === "discard") return { kind: "discard", endAt: fromIso };
  return { kind: "break", endAt: fromIso, restFrom: fromIso, restTo: toIso, resumeAt: toIso };
}

export function awayMinutes(awayFrom: string, awayTo: string): number {
  const diff = ms(awayTo) - ms(awayFrom);
  if (!Number.isFinite(diff) || diff <= 0) return 0;
  return Math.floor(diff / 60_000);
}
