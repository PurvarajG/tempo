"use client";

import { useId, useState } from "react";
import Button from "@/components/ui/Button";
import Caption from "@/components/ui/Caption";
import Card from "@/components/ui/Card";
import DayCapacity from "@/components/week/DayCapacity";
import WeekTaskItem from "@/components/week/WeekTaskItem";
import { fmt, fmtWeekday } from "@/lib/format";
import type { Task } from "@/lib/types";
import type { WeekRow } from "@/lib/week-capacity";

export interface DayRowProps {
  row: WeekRow;
  /** Suggestion for an empty day. */
  planIt?: Task | null;
  onPlanIt?: (task: Task) => void;
}

const VISIBLE = 3;

/** One day card: numeral and weekday, plain task lines, capacity. */
export default function DayRow({ row, planIt, onPlanIt }: DayRowProps) {
  const [expanded, setExpanded] = useState(false);
  const labelId = useId();
  const weekday = fmtWeekday(row.date);
  const dayNumber = Number(row.date.split("-")[2]);
  const shown = expanded ? row.tasks : row.tasks.slice(0, VISIBLE);
  const hidden = row.tasks.length - shown.length;

  return (
    <Card as="section" aria-labelledby={labelId} className="px-5 py-4">
      <span id={labelId} className="sr-only">
        {weekday} {dayNumber}
      </span>
      <div
        data-over={row.over ? "true" : undefined}
        className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-6 rail:grid-cols-[96px_minmax(0,1fr)_240px]"
      >
        <div aria-hidden="true">
          <div className="text-day-num">{dayNumber}</div>
          <Caption as="div" className="mt-1">
            {row.isToday ? "Today" : fmtWeekday(row.date, "short")}
          </Caption>
        </div>

        <div className="min-w-0">
          {row.tasks.length === 0 ? (
            <div className="flex flex-wrap items-center gap-4 text-body text-ink-3">
              <span>
                Nothing planned yet.
                {planIt ? ` ${planIt.title} (${fmt(planIt.minutes)}) fits here.` : null}
              </span>
              {planIt ? (
                <Button variant="chip" size="sm" icon="plus" onClick={() => onPlanIt?.(planIt)}>
                  {row.isToday ? "Plan it for today" : `Plan it for ${weekday}`}
                </Button>
              ) : null}
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {shown.map((task) => (
                <WeekTaskItem key={task.id} task={task} />
              ))}
              {hidden > 0 ? (
                <li className="list-none">
                  <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    className="pl-12 text-meta text-ink-3"
                  >
                    +{hidden} more
                  </button>
                </li>
              ) : null}
            </ul>
          )}
        </div>

        <div className="col-span-2 rail:col-span-1">
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
      </div>
    </Card>
  );
}
