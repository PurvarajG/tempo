"use client";

import { useMemo, useState } from "react";
import Card, { CardHeader } from "@/components/ui/Card";
import Caption from "@/components/ui/Caption";
import Icon from "@/components/ui/Icon";
import Segmented from "@/components/ui/Segmented";
import { mondayOfWeek } from "@/lib/calendar";
import { fmtDate, fmtDay } from "@/lib/format";
import { fmtHours } from "@/lib/tracking-stats";

export type TimeByDayChartProps = {
  days: string[];
  tracked: number[];
  planned: number[];
  todayISO: string;
};

type Mode = "week" | "day";

type Column = {
  key: string;
  label: string;
  axis: string;
  tracked: number;
  planned: number;
  isToday: boolean;
};

const DOTS = 16;
const UNIT = 30;
const LONG_RANGE = 40;

function buildColumns(props: TimeByDayChartProps, mode: Mode): Column[] {
  const { days, tracked, planned, todayISO } = props;
  if (mode === "day") {
    return days.map((day, i) => ({
      key: day,
      label: fmtDate(day),
      axis: fmtDay(day),
      tracked: tracked[i] ?? 0,
      planned: planned[i] ?? 0,
      isToday: day === todayISO,
    }));
  }
  const weeks = new Map<string, Column>();
  const todayWeek = mondayOfWeek(todayISO);
  days.forEach((day, i) => {
    const monday = mondayOfWeek(day);
    let col = weeks.get(monday);
    if (!col) {
      col = {
        key: monday,
        label: `Week of ${fmtDay(monday)}`,
        axis: fmtDay(monday),
        tracked: 0,
        planned: 0,
        isToday: monday === todayWeek,
      };
      weeks.set(monday, col);
    }
    col.tracked += tracked[i] ?? 0;
    col.planned += planned[i] ?? 0;
  });
  return [...weeks.values()];
}

function axisIndexes(n: number): number[] {
  if (n <= 5) return Array.from({ length: n }, (_, i) => i);
  return Array.from({ length: 5 }, (_, i) => Math.round((i * (n - 1)) / 4));
}

export default function TimeByDayChart(props: TimeByDayChartProps) {
  const [mode, setMode] = useState<Mode>("day");
  const [active, setActive] = useState<number | null>(null);

  const columns = useMemo(() => buildColumns(props, mode), [props, mode]);
  const total = props.tracked.reduce((sum, m) => sum + m, 0);

  const peak = columns.reduce((max, c) => Math.max(max, c.tracked), 0);
  const unit = Math.max(UNIT, Math.ceil(peak / DOTS / UNIT) * UNIT);
  const top = unit * DOTS;
  const yLabels = [4, 3, 2, 1, 0].map((k) => (k === 0 ? "0" : fmtHours((top * k) / 4)));
  const n = columns.length;
  const gap = n > LONG_RANGE ? "gap-0.5" : "gap-1";
  const tip = active !== null ? columns[active] : null;
  const tipOnLeft = active !== null && n > 0 && (active + 0.5) / n > 0.5;

  return (
    <Card aria-labelledby="time-by-day-title" className="flex h-full flex-col">
      <CardHeader
        titleId="time-by-day-title"
        icon={<Icon name="chart" size={16} />}
        title="Time by day"
        action={
          <Segmented
            size="sm"
            ariaLabel="Group time by"
            value={mode}
            onChange={(v) => {
              setMode(v);
              setActive(null);
            }}
            options={[
              { value: "week", label: "By week" },
              { value: "day", label: "By day" },
            ]}
          />
        }
      />
      <div className="flex items-baseline gap-4 px-5 pb-2">
        <Caption>Total tracked</Caption>
        <span className="font-mono text-chart-total text-ink">{fmtHours(total)}</span>
        <div className="ml-auto flex items-center gap-4 text-meta text-ink-3">
          <span className="inline-flex items-center gap-1.5">
            <i aria-hidden="true" className="block size-2.5 rounded-sm bg-ink" />
            Tracked
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i aria-hidden="true" className="block size-2.5 rounded-sm bg-accent" />
            Today
          </span>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col pt-2 pr-5 pb-5 pl-15">
        <div className="relative flex min-h-0 flex-1 flex-col pt-2">
          <div
            aria-hidden="true"
            className="absolute top-2 bottom-0 -left-10 flex flex-col justify-between font-mono text-caption text-ink-3"
          >
            {yLabels.map((l, i) => (
              <span key={i}>{l}</span>
            ))}
          </div>
          {tip ? (
            <div
              role="tooltip"
              style={{ left: `${(((active ?? 0) + (tipOnLeft ? 0 : 1)) / n) * 100}%` }}
              className={[
                "pointer-events-none absolute top-0 z-10 min-w-33 rounded-row bg-surface px-3 py-2 text-meta shadow-md ring-1 ring-line-2",
                tipOnLeft ? "-translate-x-full -ml-2" : "ml-2",
              ].join(" ")}
            >
              <div className="flex items-center gap-1.5 font-mono text-caption uppercase text-ink-3">
                <i aria-hidden="true" className="block size-1.5 rounded-sm bg-accent" />
                {tip.label}
              </div>
              <div className="mt-1 flex justify-between gap-3 text-ink-2">
                <span>Tracked</span>
                <b className="font-mono font-medium text-ink">{fmtHours(tip.tracked)}</b>
              </div>
              <div className="mt-1 flex justify-between gap-3 text-ink-2">
                <span>Planned</span>
                <b className="font-mono font-medium text-ink">{fmtHours(tip.planned)}</b>
              </div>
            </div>
          ) : null}
          <div
            className={`grid min-h-0 flex-1 items-stretch ${gap}`}
            style={{ gridTemplateColumns: `repeat(${Math.max(n, 1)}, minmax(0, 1fr))` }}
          >
            {columns.map((c, i) => {
              const filled = Math.min(DOTS, Math.round(c.tracked / unit));
              return (
                <div
                  key={c.key}
                  role="img"
                  tabIndex={0}
                  aria-label={`${c.label}, ${fmtHours(c.tracked)} tracked, ${fmtHours(c.planned)} planned`}
                  data-today={c.isToday ? "true" : undefined}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive((a) => (a === i ? null : a))}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive((a) => (a === i ? null : a))}
                  className="relative flex flex-col-reverse gap-[3px]"
                >
                  {c.isToday ? (
                    <span
                      aria-hidden="true"
                      className="absolute -top-2 bottom-0 left-1/2 border-l border-dashed border-ink-3 opacity-50"
                    />
                  ) : null}
                  {Array.from({ length: DOTS }, (_, r) => (
                    <i
                      key={r}
                      aria-hidden="true"
                      className={[
                        "block min-h-[5px] flex-1 rounded-dot",
                        r < filled ? (c.isToday ? "bg-accent" : "bg-ink") : "bg-off",
                      ].join(" ")}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
        <div
          aria-hidden="true"
          className="mt-2 flex flex-none justify-between font-mono text-caption uppercase text-ink-3"
        >
          {axisIndexes(n).map((i) => (
            <span key={i}>{columns[i].axis}</span>
          ))}
        </div>
      </div>
    </Card>
  );
}
