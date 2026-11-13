"use client";

import { useEffect, useMemo, useState } from "react";
import ByProjectCard from "@/components/tracking/ByProjectCard";
import ModuleCard from "@/components/tracking/ModuleCard";
import NowModule from "@/components/tracking/modules/NowModule";
import RecordsModule from "@/components/tracking/modules/RecordsModule";
import RibbonModule from "@/components/tracking/modules/RibbonModule";
import UnaccountedModule from "@/components/tracking/modules/UnaccountedModule";
import TimeByDayChart from "@/components/tracking/TimeByDayChart";
import TrackingKpis from "@/components/tracking/TrackingKpis";
import { useRangeSegments } from "@/components/tracking/useRangeSegments";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";
import PageHead from "@/components/ui/PageHead";
import Segmented from "@/components/ui/Segmented";
import { fmtDate, fmtRange, MONTHS_LONG } from "@/lib/format";
import { toISODate } from "@/lib/parse";
import { useTasks } from "@/lib/store-context";
import { currentTrackingDayISO, dayWindow, shiftTrackingDay } from "@/lib/tracking-day";
import { BELOW_MODULES, GAPS_MODULE, MODULE_COLUMN, MODULE_TITLE } from "@/lib/tracking-modules";
import {
  accuracyByDay,
  minutesByDay,
  minutesByProject,
  planAccuracy,
  plannedMinutesForProject,
  rangeDays,
  sessionStats,
  sessionsByDay,
  sparkSeries,
  weekdayAverage,
  weekTotals,
} from "@/lib/tracking-stats";
import { plannedByDay, weekDays } from "@/lib/today";
import { useNow } from "@/lib/useNow";

type Range = "7" | "28" | "90";

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: "7", label: "7 days" },
  { value: "28", label: "28 days" },
  { value: "90", label: "90 days" },
];

/** "2026-11-12" -> "November". Fixed English names, never the locale. */
function monthName(iso: string): string {
  return MONTHS_LONG[Number(iso.split("-")[1]) - 1];
}

const WEEKDAY_ONLY_DOW = new Set([1, 2, 3, 4, 5]);

export default function TrackingPage() {
  const { settings, categories, tasks, projects, gaps, segments, ready, loadSegments, loadGaps, patchSettings } =
    useTasks();
  const now = useNow();
  const [dayISO, setDayISO] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("28");

  // Default to the current tracking day once we know the day-start hour,
  // never before, since a 4am boundary can put "today" as yesterday's date.
  // Adjusted during render (not an effect) so there is no extra pass with a
  // stale null day.
  if (dayISO === null && now && settings) {
    setDayISO(currentTrackingDayISO(now, settings.dayStartHour));
  }

  const rangeN = Number(range);
  const todayISO = now && settings ? currentTrackingDayISO(now, settings.dayStartHour) : null;
  const fetchDays = Math.max(rangeN, 14);
  const { segments: fetched } = useRangeSegments(
    todayISO ? rangeDays(todayISO, fetchDays)[0] : null,
    todayISO,
  );

  useEffect(() => {
    if (!dayISO || !settings) return;
    const { start, end } = dayWindow(dayISO, settings);
    loadSegments(start.toISOString(), end.toISOString());
    loadGaps(dayISO);
  }, [dayISO, settings, loadSegments, loadGaps]);

  // Gaps are a server-side computation, not something the optimistic segment
  // update can adjust locally. Every store mutation replaces the segments
  // array, so this re-derives gaps on any change to the array reference.
  useEffect(() => {
    if (dayISO) loadGaps(dayISO);
  }, [segments, dayISO, loadGaps]);

  const stats = useMemo(() => {
    if (!now || !todayISO) return null;
    const days = rangeDays(todayISO, rangeN);
    const rangeSegs = fetched.filter((s) => toISODate(new Date(s.startedAt)) >= days[0]);
    const tracked = minutesByDay(rangeSegs, todayISO, rangeN, now);
    const { average, weekdays } = weekdayAverage(tracked, todayISO);
    const weekdaySeries = days.map((d, i) => ({ d, m: tracked[i] })).filter(({ d, m }) => {
      const [y, mo, da] = d.split("-").map(Number);
      return m > 0 && WEEKDAY_ONLY_DOW.has(new Date(y, mo - 1, da).getDay());
    }).map(({ m }) => m);
    const accuracy = planAccuracy(tasks, rangeSegs, now);
    const session = sessionStats(rangeSegs, now);
    const week = weekDays(todayISO);
    const weekSegs = fetched.filter((s) => toISODate(new Date(s.startedAt)) >= week[0]);
    const trackedThisWeek = new Map(
      minutesByProject(weekSegs, tasks, projects, now).map((r) => [r.project?.id ?? null, r.minutes]),
    );
    let insight: { projectName: string; tracked: number; planned: number } | null = null;
    let best = 0;
    for (const p of projects) {
      const planned = plannedMinutesForProject(tasks, p.id, week[0], week[6]);
      if (planned <= 0) continue;
      const done = trackedThisWeek.get(p.id) ?? 0;
      if (planned - done > best) {
        best = planned - done;
        insight = { projectName: p.name, tracked: done, planned };
      }
    }
    return {
      days,
      tracked,
      planned: plannedByDay(tasks, todayISO, rangeN),
      totals: weekTotals(fetched, todayISO, now),
      average,
      weekdays,
      accuracy,
      session,
      rows: minutesByProject(rangeSegs, tasks, projects, now),
      insight,
      sparks: {
        week: sparkSeries(tracked),
        average: sparkSeries(weekdaySeries),
        accuracy: sparkSeries(accuracyByDay(tasks, rangeSegs, todayISO, rangeN, now)),
        sessions: sparkSeries(sessionsByDay(rangeSegs, todayISO, rangeN)),
      },
    };
  }, [fetched, now, todayISO, rangeN, tasks, projects]);

  if (!now || !settings || !dayISO || !todayISO || !stats) {
    return (
      <div className="mx-auto w-full max-w-none px-8 py-8">
        <div className="h-10 w-64 rounded-tile bg-sunk" />
      </div>
    );
  }

  if (ready && categories.length === 0) {
    return (
      <div className="mx-auto w-full max-w-none px-8 py-8">
        <h1 className="text-h1 text-ink">Tracking</h1>
        <p className="mt-6 text-body text-ink-3">
          No categories yet.{" "}
          <a href="/tracking/settings" className="text-accent hover:underline">
            Set some up
          </a>{" "}
          before tracking time.
        </p>
      </div>
    );
  }

  const isToday = dayISO === todayISO;
  const dayLabel = isToday ? "Today" : fmtDate(dayISO, todayISO);
  const rangeStart = stats.days[0];

  const order = settings.moduleOrder.filter(
    (key) =>
      (BELOW_MODULES as readonly string[]).includes(key) && !settings.hiddenModules.includes(key),
  );
  const main = order.filter((k) => MODULE_COLUMN[k] !== "side");
  const side = order.filter((k) => MODULE_COLUMN[k] === "side");

  const toggle = (key: string) =>
    patchSettings({
      collapsedModules: settings.collapsedModules.includes(key)
        ? settings.collapsedModules.filter((k) => k !== key)
        : [...settings.collapsedModules, key],
    });

  const renderModule = (key: string) => {
    const common = {
      collapsed: settings.collapsedModules.includes(key),
      onToggleCollapse: () => toggle(key),
    };
    if (key === "now") {
      return (
        <ModuleCard key={key} {...common} title="Now" icon="play">
          <NowModule />
        </ModuleCard>
      );
    }
    if (key === GAPS_MODULE) {
      return (
        <ModuleCard key={key} {...common} title={MODULE_TITLE.unaccounted} icon="clock" count={gaps.length}>
          <UnaccountedModule dayISO={dayISO} />
        </ModuleCard>
      );
    }
    return (
      <ModuleCard key={key} {...common} title="Day ribbon" icon="cal">
        <RibbonModule dayISO={dayISO} isToday={isToday} />
      </ModuleCard>
    );
  };

  return (
    <PageHead
      title="Tracking"
      dim={monthName(todayISO)}
      subtitle="Where your time went, next to what you planned."
      actions={
        <>
          <span className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-secondary text-ink-2 inset-ring inset-ring-line-2">
            <Icon name="cal" size={16} />
            {fmtRange(rangeStart, todayISO)}
          </span>
          <Segmented
            ariaLabel="Range"
            value={range}
            onChange={setRange}
            options={RANGE_OPTIONS}
          />
          <a
            href="/tracking/settings"
            aria-label="Tracking settings"
            className="inline-flex h-[30px] shrink-0 items-center whitespace-nowrap rounded-full px-3 text-meta font-medium text-ink-2 hover:bg-sunk"
          >
            Settings
          </a>
        </>
      }
    >
      <div className="flex w-full min-w-0 flex-col gap-6">
        <TrackingKpis
          thisWeek={stats.totals.thisWeek}
          lastWeek={stats.totals.lastWeek}
          dailyAverage={stats.average}
          weekdays={stats.weekdays}
          accuracy={stats.accuracy.percent}
          overByAvg={stats.accuracy.overByAvg}
          sessions={stats.session.count}
          longest={stats.session.longest}
          sparks={stats.sparks}
        />

        <div className="grid w-full min-w-0 gap-6 rail:grid-cols-[minmax(0,1fr)_360px]">
          <TimeByDayChart
            days={stats.days}
            tracked={stats.tracked}
            planned={stats.planned}
            todayISO={todayISO}
          />
          <ByProjectCard rows={stats.rows} rightLabel={`Last ${rangeN} days`} insight={stats.insight} />
        </div>

        <RecordsModule now={now} dayISO={dayISO} todayISO={todayISO} />

        <div className="flex items-center gap-2">
          <h2 className="text-title text-ink">{dayLabel}</h2>
          {isToday ? (
            <span
              role="img"
              aria-label="Tracking now"
              className="size-2 animate-pulse rounded-full bg-ok"
            />
          ) : null}
          <div className="ml-auto flex items-center gap-1">
            <IconButton
              icon="chev"
              shape="tile"
              className="-scale-x-100"
              label="Previous day"
              onClick={() => setDayISO(shiftTrackingDay(dayISO, -1))}
            />
            <IconButton
              icon="chev"
              shape="tile"
              label="Next day"
              onClick={() => setDayISO(shiftTrackingDay(dayISO, 1))}
            />
            <Button size="sm" onClick={() => setDayISO(todayISO)} disabled={isToday}>
              Today
            </Button>
          </div>
        </div>

        <div className="grid w-full min-w-0 items-start gap-6 rail:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-6">{main.map(renderModule)}</div>
          <div className="flex min-w-0 flex-col gap-6">{side.map(renderModule)}</div>
        </div>
      </div>
    </PageHead>
  );
}
