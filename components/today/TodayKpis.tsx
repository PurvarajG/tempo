"use client";

import Kpi from "@/components/ui/Kpi";
import Spark from "@/components/ui/Spark";
import { fmt, fmtWeekday } from "@/lib/format";
import { addDays, daysBetween } from "@/lib/parse";
import { useTasks } from "@/lib/store-context";
import {
  overBy,
  plannedByDay,
  trackedByDay,
  weekDays,
  type Capacity,
} from "@/lib/today";

function weekdayName(iso: string): string {
  return fmtWeekday(iso, "short");
}

function signed(diff: number): string {
  if (diff === 0) return "Same";
  return `${diff > 0 ? "+" : "-"}${fmt(Math.abs(diff))}`;
}

export default function TodayKpis({
  todayISO,
  cap,
  carriedCount,
}: {
  todayISO: string;
  cap: Capacity;
  carriedCount: number;
}) {
  const { tasks, timeEntries } = useTasks();

  const planned = plannedByDay(tasks, todayISO, 12);
  const tracked = trackedByDay(timeEntries, todayISO, 12);
  const trackedToday = tracked[tracked.length - 1] ?? 0;

  const lastWeekISO = addDays(todayISO, -7);
  const lastWeekPlanned = plannedByDay(tasks, lastWeekISO, 1)[0] ?? 0;
  const diff = cap.plannedMinutes - lastWeekPlanned;

  const week = weekDays(todayISO).filter((d) => d <= todayISO);
  const weekSum = week.reduce((sum, d) => {
    const idx = tracked.length - 1 - daysBetween(d, todayISO);
    return sum + (tracked[idx] ?? 0);
  }, 0);

  return (
    <div className="grid grid-cols-2 gap-4 rail:grid-cols-4">
      <Kpi
        label="Planned"
        value={<span className="whitespace-nowrap">{fmt(cap.plannedMinutes)}</span>}
        visual={<Spark values={planned} label="Planned time, last 12 days" />}
        foot={{
          label: (
            <span className="whitespace-nowrap">{`vs last ${weekdayName(lastWeekISO)}`}</span>
          ),
          value: <span className="whitespace-nowrap">{signed(diff)}</span>,
          tone: diff > 0 ? "up" : "neutral",
        }}
      />
      <Kpi
        label="Tracked"
        value={<span className="whitespace-nowrap">{fmt(trackedToday)}</span>}
        visual={<Spark values={tracked} label="Tracked time, last 12 days" />}
        foot={{
          label: <span className="whitespace-nowrap">Week so far</span>,
          value: <span className="whitespace-nowrap">{fmt(weekSum)}</span>,
        }}
      />
      <Kpi
        label="Free today"
        value={
          <span
            className={`whitespace-nowrap${cap.over && !cap.dayDone ? " text-hi" : ""}`}
          >
            {cap.dayDone
              ? "Day's done"
              : cap.over
                ? `Over by ${fmt(overBy(cap))}`
                : fmt(cap.freeMinutes)}
          </span>
        }
        foot={{
          label: <span className="whitespace-nowrap">Until</span>,
          value: <span className="whitespace-nowrap">{cap.endLabel}</span>,
        }}
      />
      <Kpi
        label="Carried over"
        value={carriedCount}
        unit={carriedCount === 1 ? "task" : "tasks"}
        foot={{
          label: (
            <a
              href="#carried-over"
              className="font-medium text-ink-2 hover:text-ink"
            >
              Reschedule
            </a>
          ),
          value: "",
        }}
      />
    </div>
  );
}
