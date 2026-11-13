"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTasks } from "@/lib/store-context";
import { useNow } from "@/lib/useNow";
import { daysBetween, toISODate } from "@/lib/parse";
import { shiftDays } from "@/lib/summary";
import {
  CALENDAR_VIEWS,
  dayRange,
  monthGrid,
  shift,
  isoWeekNumber,
  viewTitle,
  weekGrid,
  type CalendarView,
} from "@/lib/calendar";
import { fmtDate } from "@/lib/format";
import { groupExternalEventsByDate } from "@/lib/external-events-view";
import { useExternalEvents } from "@/lib/useExternalEvents";
import type { Task } from "@/lib/types";
import { trackedBlocks } from "@/lib/calendar-blocks";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import Segmented from "@/components/ui/Segmented";
import CalendarLegend from "@/components/calendar/CalendarLegend";
import PageHead from "@/components/ui/PageHead";
import Panel from "@/components/ui/Panel";
import MonthGrid from "@/components/calendar/MonthGrid";
import WeekGrid from "@/components/calendar/WeekGrid";
import DayGrid from "@/components/calendar/DayGrid";
import DayPanel, { DayPanelBody } from "@/components/calendar/DayPanel";

const VIEW_LABELS: Record<CalendarView, string> = { day: "Day", week: "Week", month: "Month" };

const KINDS_SENTENCE = "Planned blocks are solid, tracked time is striped.";

export default function CalendarPage() {
  return (
    <Suspense fallback={null}>
      <Calendar />
    </Suspense>
  );
}

function Calendar() {
  const { tasks, timeEntries, running } = useTasks();
  const router = useRouter();
  const params = useSearchParams();
  const now = useNow();

  // ?date= means exactly one thing, unchanged from before this phase: open
  // that day's panel on load (Today's timeline links here). It is read once,
  // at mount, and never rewritten by paging — otherwise reloading after
  // clicking ‹ / › would pop the day panel back open over wherever you'd
  // paged to. ?view= is the one param this phase adds to the URL, kept
  // separate from ?date= for exactly that reason.
  const requestedDate = params.get("date");
  const requestedView = params.get("view");
  const view: CalendarView = CALENDAR_VIEWS.includes(requestedView as CalendarView)
    ? (requestedView as CalendarView)
    : "month";

  // The paging cursor. Local state, same as it was before this phase — only
  // now it's an anchor ISO date instead of a {year, month} pair, so day/week
  // views can share it with month view.
  const [cursor, setCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(requestedDate);
  const [announcement, setAnnouncement] = useState("");

  const todayISO = now ? toISODate(now) : "";
  const anchorISO = cursor ?? requestedDate ?? todayISO;

  // Switching the segmented control is the one navigation that touches the
  // URL, so a day/week/month choice survives a reload — the plan's ask.
  // Paging (arrows/Today) stays local state, exactly as `cursor` was before.
  const setView = useCallback(
    (nextView: CalendarView) => {
      const query = new URLSearchParams(params.toString());
      if (nextView === "month") query.delete("view");
      else query.set("view", nextView);
      const qs = query.toString();
      router.replace(qs ? `/calendar?${qs}` : "/calendar", { scroll: false });
    },
    [params, router],
  );

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    const add = (iso: string, task: Task) => {
      const list = map.get(iso) ?? [];
      list.push(task);
      map.set(iso, list);
    };
    for (const task of tasks) {
      if (task.status === "trashed" || task.scheduled === null) continue;
      if (task.isComplex && task.finishDate) {
        const span = daysBetween(task.scheduled, task.finishDate);
        for (let offset = 0; offset <= span; offset++) add(shiftDays(task.scheduled, offset), task);
      } else {
        add(task.scheduled, task);
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.dueTime ?? "99:99").localeCompare(b.dueTime ?? "99:99"));
    }
    return map;
  }, [tasks]);

  // Computed before the loading bail-out below, so the hook order never varies.
  const days = useMemo(() => {
    if (!anchorISO) return [];
    if (view === "day") return dayRange(anchorISO);
    if (view === "week") return weekGrid(anchorISO);
    const [y, m] = anchorISO.split("-").map(Number);
    return monthGrid(y, m - 1);
  }, [view, anchorISO]);

  // Distinct project ids shown in the visible range, first seen first. Tracked
  // time counts in week and day view, where it is drawn.
  const projectIds = useMemo(() => {
    const ids: string[] = [];
    const add = (id: string | null | undefined) => {
      if (id && !ids.includes(id)) ids.push(id);
    };
    const byId = new Map(tasks.map((t) => [t.id, t]));
    for (const d of days) {
      for (const t of tasksByDate.get(d.iso) ?? []) add(t.projectId);
      if (view !== "month" && now) {
        for (const b of trackedBlocks(d.iso, timeEntries, running, tasks, now)) {
          add(b.projectId ?? (b.taskId ? byId.get(b.taskId)?.projectId : undefined));
        }
      }
    }
    return ids;
  }, [days, tasksByDate, view, tasks, timeEntries, running, now]);

  // The active view's own visible range, rather than a fixed 42-day window.
  const { events, ok } = useExternalEvents(days[0]?.iso ?? "", days[days.length - 1]?.iso ?? "");
  const externalByDate = useMemo(
    () => (ok ? groupExternalEventsByDate(events) : new Map()),
    [events, ok],
  );

  if (!anchorISO) {
    return (
      <div className="mx-auto max-w-5xl px-8 py-8">
        <div className="h-10 w-64 rounded-tile bg-sunk" />
      </div>
    );
  }

  const heading = viewTitle(view, anchorISO);
  const subtitle =
    view === "week"
      ? `Week ${isoWeekNumber(days[0].iso)}. ${KINDS_SENTENCE}`
      : view === "day"
        ? `${fmtDate(anchorISO, todayISO)}. ${KINDS_SENTENCE}`
        : "Click a day to see it or add to it.";
  const tip =
    view === "week"
      ? "Drag a block to another day to move it."
      : view === "month"
        ? "Drag a task to another day to move it."
        : undefined;

  return (
    // `contents` keeps PageHead's frame layout untouched. The two descendant rules
    // belong to the head row: the H1 never breaks, and when the sentence plus the
    // nav buttons and view control no longer fit, the controls drop under the title
    // instead of squeezing it.
    <div
      data-part="calendar-frame"
      className="contents [&_[data-part=head]]:flex-wrap [&_[data-part=head]_h1]:whitespace-nowrap"
    >
    <PageHead
      title={heading.title}
      dim={heading.dim}
      subtitle={subtitle}
      rail={
        view === "day" ? (
          <Panel title={fmtDate(anchorISO)} collapsible={false}>
            <DayPanelBody
              iso={anchorISO}
              tasks={tasksByDate.get(anchorISO) ?? []}
              externalEvents={externalByDate.get(anchorISO) ?? []}
            />
          </Panel>
        ) : undefined
      }
      actions={
        <>
          <IconButton
            icon="chev"
            shape="round"
            className="-scale-x-100"
            label={`Previous ${view}`}
            onClick={() => setCursor(shift(view, anchorISO, -1))}
          />
          <Button variant="chip" onClick={() => setCursor(todayISO)}>
            Today
          </Button>
          <IconButton
            icon="chev"
            shape="round"
            label={`Next ${view}`}
            onClick={() => setCursor(shift(view, anchorISO, 1))}
          />
          <Segmented
            ariaLabel="Calendar view"
            value={view}
            onChange={setView}
            options={CALENDAR_VIEWS.map((v) => ({ value: v, label: VIEW_LABELS[v] }))}
          />
        </>
      }
    >
      {/* PageHead's body is an auto-row grid, so a bare shell:h-full never resolves and the
          card grows to its content, never scrolling its own body. h-0 plus min-h-full takes the
          stretched row's height instead, for every view: the grid card (flex-1, min-h-0) closes on
          all four sides, the legend sits under it inside the pane, and overflow scrolls inside the
          card body, never the page. Week and Day open at the waking hour. In Day view the rail stacks
          below 1200px, so the row is auto and h-0 would collapse the card; a fixed scale height
          keeps it readable and the rail follows below. */}
      <div
        className={
          view === "day"
            ? "flex min-h-0 flex-col gap-6 h-120 rail:h-0 rail:min-h-full"
            : "flex min-h-0 flex-col gap-6 shell:h-0 shell:min-h-full"
        }
      >
        {view === "month" && (
          <MonthGrid
            days={days}
            todayISO={todayISO}
            tasksByDate={tasksByDate}
            externalByDate={externalByDate}
            onSelectDay={setSelected}
            onAnnounce={setAnnouncement}
          />
        )}
        {view === "week" && (
          <WeekGrid
            days={days}
            todayISO={todayISO}
            tasksByDate={tasksByDate}
            externalByDate={externalByDate}
            onSelectDay={setSelected}
            onAnnounce={setAnnouncement}
          />
        )}
        {view === "day" && (
          <DayGrid
            day={days[0]}
            todayISO={todayISO}
            tasksByDate={tasksByDate}
            externalByDate={externalByDate}
            onSelectDay={setSelected}
          />
        )}
        <CalendarLegend projectIds={projectIds} tip={tip} showKinds={view !== "month"} />
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {/* In day view the rail above already renders DayPanelBody for
          `anchorISO`, so opening the modal here too would mount a second
          copy of that day's add input behind it. Suppress it in day view;
          the rail is the one surface for the day on screen.

          Note `selected` is NOT cleared when the view changes, so it can
          still hold a day picked in week or month view. That is precisely
          why this gate is on `view`, not on comparing `selected` to
          `anchorISO`: whatever `selected` holds, day view's own surface is
          the rail. */}
      {selected && view !== "day" && (
        <DayPanel
          iso={selected}
          tasks={tasksByDate.get(selected) ?? []}
          externalEvents={externalByDate.get(selected) ?? []}
          onClose={() => setSelected(null)}
        />
      )}
    </PageHead>
    </div>
  );
}
