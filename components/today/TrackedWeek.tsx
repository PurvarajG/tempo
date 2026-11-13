"use client";

import Card, { CardHeader } from "@/components/ui/Card";
import Caption from "@/components/ui/Caption";
import Icon from "@/components/ui/Icon";
import { fmt, fmtDate } from "@/lib/format";
import { useTasks } from "@/lib/store-context";
import { plannedByDay, trackedByDay, weekDays } from "@/lib/today";

const TICK_MINUTES = 30;
const MAX_TICKS = 16;
const LETTERS = ["M", "T", "W", "T", "F", "S", "S"] as const;

export default function TrackedWeek({ todayISO }: { todayISO: string }) {
  const { tasks, timeEntries } = useTasks();

  const days = weekDays(todayISO);
  const series = trackedByDay(timeEntries, days[6], 7);
  const total = series.reduce((sum, m) => sum + m, 0);

  const todayIndex = days.indexOf(todayISO);
  const trackedToday = todayIndex >= 0 ? series[todayIndex] ?? 0 : 0;
  const plannedToday = plannedByDay(tasks, todayISO, 1)[0] ?? 0;

  return (
    <Card aria-labelledby="tracked-week-title">
      <CardHeader
        titleId="tracked-week-title"
        icon={<Icon name="chart" size={16} />}
        title="Tracked this week"
        right={<span className="font-mono text-ink">{fmt(total)}</span>}
      />
      <div className="px-4 pt-2 pb-4">
        <div className="relative rounded-tile bg-sunk px-3 py-2 mb-3">
          <Caption as="div">{fmtDate(todayISO)}</Caption>
          <div className="mt-1 flex justify-between gap-3 text-meta text-ink-2">
            <span>Tracked</span>
            <span className="font-mono text-ink">{fmt(trackedToday)}</span>
          </div>
          <div className="flex justify-between gap-3 text-meta text-ink-2">
            <span>Planned</span>
            <span className="font-mono text-ink">{fmt(plannedToday)}</span>
          </div>
        </div>
        <div className="grid grid-cols-7 items-end gap-2 pt-2">
          {days.map((day, i) => {
            const minutes = series[i] ?? 0;
            const isToday = day === todayISO;
            const filled = Math.min(MAX_TICKS, Math.round(minutes / TICK_MINUTES));
            return (
              <div
                key={day}
                role="img"
                aria-label={`${fmtDate(day)}, ${fmt(minutes)} tracked`}
                data-today={isToday ? "true" : undefined}
                aria-current={isToday ? "date" : undefined}
                className="flex flex-col-reverse items-center gap-0.5"
              >
                {Array.from({ length: MAX_TICKS }, (_, t) => (
                  <i
                    key={t}
                    aria-hidden="true"
                    className={[
                      "block h-1.5 w-full max-w-7 rounded-sm",
                      t < filled ? (isToday ? "bg-accent" : "bg-ink") : "bg-off",
                    ].join(" ")}
                  />
                ))}
              </div>
            );
          })}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-2 text-center font-mono text-meta text-ink-3" aria-hidden="true">
          {days.map((day, i) => (
            <span key={day} className={day === todayISO ? "font-medium text-ink" : undefined}>
              {LETTERS[i]}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}
