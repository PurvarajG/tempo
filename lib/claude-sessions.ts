import type { ClaudeSession } from "@/lib/desktop-bridge";
import type { Category, Segment } from "./types";

export type ClaudeSuggestion = {
  key: string;
  sessionId: string;
  startedAt: string;
  endedAt: string;
  label: string;
  note: string;
};

export const MIN_SUGGESTION_MINUTES = 5;

const MIN_MS = 60_000;

/** Remove every [s, e) interval in `cuts` from [start, end). */
function subtract(start: number, end: number, cuts: [number, number][]): [number, number][] {
  let pieces: [number, number][] = [[start, end]];
  for (const [cs, ce] of cuts) {
    const next: [number, number][] = [];
    for (const [ps, pe] of pieces) {
      if (ce <= ps || cs >= pe) {
        next.push([ps, pe]);
        continue;
      }
      if (cs > ps) next.push([ps, cs]);
      if (ce < pe) next.push([ce, pe]);
    }
    pieces = next;
  }
  return pieces;
}

export function suggestedClaudeBlocks(
  sessions: ClaudeSession[],
  window: { start: Date; end: Date },
  segments: Pick<Segment, "startedAt" | "endedAt">[],
  now: Date,
): ClaudeSuggestion[] {
  const lo = window.start.getTime();
  const hi = Math.min(window.end.getTime(), now.getTime());
  const cuts: [number, number][] = [];
  for (const seg of segments) {
    const s = new Date(seg.startedAt).getTime();
    const e = seg.endedAt ? new Date(seg.endedAt).getTime() : now.getTime();
    if (Number.isFinite(s) && Number.isFinite(e) && e > s) cuts.push([s, e]);
  }
  const out: ClaudeSuggestion[] = [];
  for (const session of sessions) {
    const first = new Date(session.firstMessageAt).getTime();
    const last = session.active ? now.getTime() : new Date(session.lastMessageAt).getTime();
    if (!Number.isFinite(first) || !Number.isFinite(last)) continue;
    const start = Math.max(first, lo);
    const end = Math.min(last, hi);
    if (end <= start) continue;
    const note =
      `Claude Code in ${session.projectName}${session.branch ? ` on ${session.branch}` : ""}` +
      (session.lastPrompt ? `. ${session.lastPrompt}` : "");
    for (const [ps, pe] of subtract(start, end, cuts)) {
      if (pe - ps < MIN_SUGGESTION_MINUTES * MIN_MS) continue;
      const startedAt = new Date(ps).toISOString();
      out.push({
        key: `${session.id}|${startedAt}`,
        sessionId: session.id,
        startedAt,
        endedAt: new Date(pe).toISOString(),
        label: `Claude Code: ${session.projectName}`,
        note,
      });
    }
  }
  return out.sort((a, b) => (a.startedAt < b.startedAt ? -1 : a.startedAt > b.startedAt ? 1 : 0));
}

export function pickClaudeCategory(categories: Category[]): string | undefined {
  const live = categories.filter((c) => !c.archived);
  return (live.find((c) => /code|dev|work|build|engineer/i.test(c.name)) ?? live[0])?.id;
}
