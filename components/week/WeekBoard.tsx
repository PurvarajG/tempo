"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LaneAddButton, LaneAddInput } from "@/components/board/LaneAdd";
import BoardCard from "@/components/board/BoardCard";
import Lane from "@/components/board/Lane";
import TimerButton from "@/components/TimerButton";
import Button from "@/components/ui/Button";
import DayCapacity from "@/components/week/DayCapacity";
import { fmtWeekday } from "@/lib/format";
import type { Task } from "@/lib/types";
import type { WeekRow } from "@/lib/week-capacity";

type Fade = "start" | "end" | "both" | undefined;

export interface WeekBoardProps {
  rows: WeekRow[];
  carried: Task[];
  planIts: (Task | null)[];
  todayISO: string;
  onPlanIt: (task: Task, date: string) => void;
}

/** Next 7 days as a board: Carried over, then one lane per day with its capacity. */
export default function WeekBoard({ rows, carried, planIts, todayISO, onPlanIt }: WeekBoardProps) {
  const [fade, setFade] = useState<Fade>(undefined);
  const [addingDate, setAddingDate] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const hiddenStart = el.scrollLeft > 1;
    const hiddenEnd = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setFade(
      hiddenStart && hiddenEnd ? "both" : hiddenStart ? "start" : hiddenEnd ? "end" : undefined,
    );
  }, []);

  useEffect(() => {
    measure();
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, rows.length, carried.length]);

  const actionsFor = (task: Task) => <TimerButton taskId={task.id} title={task.title} />;

  return (
    <div
      ref={scrollRef}
      onScroll={measure}
      data-fade={fade}
      className="board-scroll -m-1 p-1"
    >
      <div className="flex min-w-full items-start gap-4">
        <div className="grid flex-1 auto-cols-[minmax(15rem,1fr)] grid-flow-col items-start gap-4">
          {carried.length > 0 && (
            <Lane title="Carried over" count={carried.length} glyph="today">
              {carried.map((task) => (
                <BoardCard key={task.id} task={task} todayISO={todayISO} actions={actionsFor(task)} />
              ))}
            </Lane>
          )}
          {rows.map((row, i) => {
            const weekday = fmtWeekday(row.date);
            const dayNumber = Number(row.date.split("-")[2]);
            const title = row.isToday ? "Today" : `${fmtWeekday(row.date, "short")} ${dayNumber}`;
            const planIt = planIts[i];
            return (
              <Lane
                key={row.date}
                title={title}
                count={row.tasks.length}
                glyph="cal"
                headerRight={<LaneAddButton lane={title} onClick={() => setAddingDate(row.date)} />}
                emptyText="Nothing planned yet."
                footer={
                  <div className="px-2 pb-3">
                    <DayCapacity
                      plannedMinutes={row.plannedMinutes}
                      ceilingMinutes={row.ceilingMinutes}
                      freeMinutes={row.freeMinutes}
                      overByMinutes={row.overByMinutes}
                      over={row.over}
                      ratio={row.ratio}
                      provisional={row.provisional}
                      dayLabel={weekday}
                    />
                  </div>
                }
              >
                {row.tasks.map((task) => (
                  <BoardCard
                    key={task.id}
                    task={task}
                    todayISO={todayISO}
                    actions={actionsFor(task)}
                  />
                ))}
                {addingDate === row.date ? (
                  <LaneAddInput lane={title} scheduled={row.date} onClose={() => setAddingDate(null)} />
                ) : null}
                {row.tasks.length === 0 && planIt ? (
                  <li className="list-none px-2 pb-2">
                    <Button
                      variant="chip"
                      size="sm"
                      icon="plus"
                      onClick={() => onPlanIt(planIt, row.date)}
                    >
                      {row.isToday ? "Plan it for today" : `Plan it for ${weekday}`}
                    </Button>
                  </li>
                ) : null}
              </Lane>
            );
          })}
        </div>
      </div>
    </div>
  );
}
