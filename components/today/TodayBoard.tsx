"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { layoutToday } from "@/lib/today";
import Lane from "../board/Lane";
import BoardCard from "../board/BoardCard";
import { LaneAddButton, LaneAddInput } from "../board/LaneAdd";
import TimerButton from "../TimerButton";

type Fade = "start" | "end" | "both" | undefined;

const DONE_VISIBLE = 2;
const GHOST =
  "flex h-10 w-full items-center justify-center gap-2 rounded-tab text-secondary text-ink-3 inset-ring-1 inset-ring-line-2";

/** Today as a board (soft.html .board): Carried over, To do, In progress, Done. */
export default function TodayBoard({
  layout,
  todayISO,
  runningTaskId,
}: {
  layout: ReturnType<typeof layoutToday>;
  todayISO: string;
  runningTaskId: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [fade, setFade] = useState<Fade>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const hiddenStart = el.scrollLeft > 1;
    const hiddenEnd = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setFade(hiddenStart && hiddenEnd ? "both" : hiddenStart ? "start" : hiddenEnd ? "end" : undefined);
  }, []);

  useEffect(() => {
    measure();
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  const pool = [...(layout.upNext ? [layout.upNext.task] : []), ...layout.carried, ...layout.committed, ...layout.couldAlso];
  const running = runningTaskId ? (pool.find((t) => t.id === runningTaskId) ?? null) : null;
  const notRunning = (t: { id: string }) => t.id !== runningTaskId;

  const carried = layout.carried.filter(notRunning);
  const todo = [...(layout.upNext ? [layout.upNext.task] : []), ...layout.committed, ...layout.couldAlso].filter(
    notRunning,
  );
  const done = layout.done;
  const shownDone = expanded ? done : done.slice(0, DONE_VISIBLE);
  const hidden = done.length - DONE_VISIBLE;

  const start = (t: { id: string; title: string }) => <TimerButton taskId={t.id} title={t.title} />;

  return (
    <div ref={scrollRef} onScroll={measure} data-fade={fade} className="board-scroll -m-1 p-1">
      <div className="flex min-w-full items-start gap-4">
        <div
          data-testid="today-board"
          className="grid flex-1 auto-cols-[minmax(15rem,1fr)] grid-flow-col items-start gap-4"
        >
          <Lane title="Carried over" count={carried.length} glyph="today" emptyText="Nothing carried over.">
            {carried.map((t) => (
              <BoardCard key={t.id} task={t} todayISO={todayISO} actions={start(t)} />
            ))}
          </Lane>
          <Lane
            title="To do"
            count={todo.length}
            glyph="target"
            emptyText="Nothing left to do today."
            headerRight={<LaneAddButton lane="To do" onClick={() => setAdding(true)} />}
          >
            {todo.map((t) => (
              <BoardCard key={t.id} task={t} todayISO={todayISO} actions={start(t)} />
            ))}
            {adding && <LaneAddInput lane="To do" scheduled={todayISO} onClose={() => setAdding(false)} />}
          </Lane>
          <Lane title="In progress" count={running ? 1 : 0} glyph="live" emptyText="Nothing running.">
            {running && <BoardCard task={running} todayISO={todayISO} actions={start(running)} />}
          </Lane>
          <Lane title="Done" count={done.length} glyph="check" emptyText="Nothing done yet.">
            {shownDone.map((t) => (
              <BoardCard key={t.id} task={t} todayISO={todayISO} />
            ))}
            {done.length > DONE_VISIBLE && (
              <li>
                <button type="button" onClick={() => setExpanded((v) => !v)} className={GHOST}>
                  {expanded ? "Show less" : `Show ${hidden} more`}
                </button>
              </li>
            )}
          </Lane>
        </div>
      </div>
    </div>
  );
}
