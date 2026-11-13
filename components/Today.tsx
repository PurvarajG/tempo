"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toISODate } from "@/lib/parse";
import { fmtDayLong, fmtWeekday } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import { useTasks } from "@/lib/store-context";
import { withSettingsDefaults } from "@/lib/store-context/use-tracking-config";
import { capacity, headline, inboxCount, isPastWrap, layoutToday } from "@/lib/today";
import { momentum } from "@/lib/momentum";
import { dayPlan } from "@/lib/day-plan";
import PageHead from "./ui/PageHead";
import Segmented from "./ui/Segmented";
import Icon from "./ui/Icon";
import Button from "./ui/Button";
import RailPanel from "./ui/RailPanel";
import QuickAdd from "./QuickAdd";
import TodayKpis from "./today/TodayKpis";
import MomentumCard from "./today/MomentumCard";
import DaySchedule from "./today/DaySchedule";
import TrackedWeek from "./today/TrackedWeek";
import GeneralNote from "./today/GeneralNote";
import DashboardTimeline from "./today/DashboardTimeline";
import TodayCard from "./today/TodayCard";
import TodayBoard from "./today/TodayBoard";

type View = "list" | "board" | "day";

const NOTEPAD_OPEN = "today-notepad:open";

// The end-of-day wrap (Phase 10B); the button shows after the wrap-up hour.
const wrapUpHref = "/wrap";

const skipKey = (todayISO: string) => `doem.today.skip.${todayISO}`;

function readSkip(todayISO: string): Set<string> {
  if (!todayISO) return new Set();
  try {
    const raw = sessionStorage.getItem(skipKey(todayISO));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function writeSkip(todayISO: string, ids: Set<string>) {
  try {
    sessionStorage.setItem(skipKey(todayISO), JSON.stringify([...ids]));
  } catch {
    // Session storage can be unavailable; the skip then lasts until reload.
  }
}

export default function Today() {
  const { tasks, projects, timeEntries, running, ready, settings, patchSettings } = useTasks();

  // Null until the browser takes over, so the server never renders a date the
  // client would disagree with.
  const now = useNow();
  const todayISO = now ? toISODate(now) : "";

  const searchParams = useSearchParams();
  const initialView = searchParams?.get("view");
  const [view, setViewState] = useState<View>(initialView === "board" || initialView === "day" ? initialView : "list");
  // Keep the tab in the URL without a navigation: Next folds replaceState into useSearchParams.
  const setView = (next: View) => {
    setViewState(next);
    try {
      const url = new URL(window.location.href);
      if (next === "list") url.searchParams.delete("view");
      else url.searchParams.set("view", next);
      window.history.replaceState(window.history.state, "", url);
    } catch {
      // The URL is a convenience only.
    }
  };
  const [skipState, setSkipState] = useState<{ iso: string; ids: Set<string> } | null>(null);
  const skipIds = useMemo(
    () => (skipState && skipState.iso === todayISO ? skipState.ids : readSkip(todayISO)),
    [skipState, todayISO],
  );

  const runningTaskId = running?.taskId ?? null;

  if (!now) {
    return (
      <div className="mx-auto max-w-6xl px-8 py-8">
        <div className="h-10 w-64 rounded-card bg-sunk" />
      </div>
    );
  }

  const layout = layoutToday(tasks, todayISO, now, runningTaskId, skipIds);
  const cap = capacity(tasks, todayISO, now, settings);
  const openTasks = [
    ...(layout.upNext ? [layout.upNext.task] : []),
    ...layout.committed,
    ...layout.couldAlso,
    ...layout.carried,
  ];
  const planOpen = [...(layout.upNext ? [layout.upNext.task] : []), ...layout.committed, ...layout.couldAlso];

  const onSomethingElse = () => {
    const id = layout.upNext?.task.id;
    if (!id) return;
    const ids = new Set(skipIds);
    ids.add(id);
    writeSkip(todayISO, ids);
    setSkipState({ iso: todayISO, ids });
  };

  const collapsedModules = settings?.collapsedModules ?? [];
  // Guarded the same way Tracking's own collapse toggle is (app/tracking/
  // page.tsx): settings loads async, and patchSettings replaces the WHOLE
  // collapsedModules array rather than merging one key into it. Firing this
  // before settings has arrived would persist a single-entry array and wipe
  // out everything already collapsed elsewhere (including Tracking's
  // backfilled records/rollups/signals default).
  const toggleNotepad = () => {
    if (!settings) return;
    patchSettings({
      collapsedModules: collapsedModules.includes(NOTEPAD_OPEN)
        ? collapsedModules.filter((k) => k !== NOTEPAD_OPEN)
        : [...collapsedModules, NOTEPAD_OPEN],
    });
  };

  const showWrapUp = isPastWrap(now, withSettingsDefaults(settings).wrapHour);

  return (
    <PageHead
      workspaceTestId="today-workspace"
      title={fmtWeekday(todayISO)}
      dim={fmtDayLong(todayISO)}
      subtitle={headline(openTasks.length, cap)}
      actions={
        <>
          {showWrapUp && (
            <a href={wrapUpHref}>
              <Button variant="chip" size="sm" tabIndex={-1}>
                Wrap up the day
              </Button>
            </a>
          )}
          <Segmented<View>
            ariaLabel="Today view"
            value={view}
            onChange={setView}
            options={[
              { value: "list", label: "List", icon: <Icon name="list" size={16} /> },
              { value: "board", label: "Board", icon: <Icon name="board" size={16} /> },
              { value: "day", label: "Day", icon: <Icon name="cal" size={16} /> },
            ]}
          />
        </>
      }
      headerExtra={
        ready && <TodayKpis todayISO={todayISO} cap={cap} carriedCount={layout.carried.length} />
      }
      rail={
        <>
          <MomentumCard
            data={momentum({
              done: layout.done,
              open: openTasks,
              upNext: layout.upNext?.task ?? null,
              tasks,
              projects,
              entries: timeEntries,
              todayISO,
              dayDone: cap.dayDone,
            })}
            todayISO={todayISO}
          />
          <DaySchedule plan={dayPlan({ open: planOpen, now, endHour: cap.endHour, runningTaskId })} />
          <TrackedWeek todayISO={todayISO} />
          <RailPanel title="Notepad" collapsed={!collapsedModules.includes(NOTEPAD_OPEN)} onToggleCollapse={toggleNotepad}>
            <GeneralNote compact hideLabel />
          </RailPanel>
        </>
      }
    >
      {/* Below the `shell:` breakpoint (900px) this remains ordinary
          document flow. From `rail:` (1200px) up, the primary column
          scrolls independently within the shell's two-column grid; between
          900 and 1200 it shares one scrolling region with the stacked
          rail, see PageHead.tsx. */}
      <div data-testid="today-primary-pane" data-density="compact" className="flex min-w-0 flex-col gap-4">
        <QuickAdd id="doem-quick-add" autoFocus={false} />

        <div>
          {view === "list" ? (
            <TodayCard
              layout={layout}
              todayISO={todayISO}
              inboxCount={inboxCount(tasks, todayISO)}
              onSomethingElse={onSomethingElse}
            />
          ) : view === "board" ? (
            <TodayBoard layout={layout} todayISO={todayISO} runningTaskId={runningTaskId} />
          ) : (
            <DashboardTimeline todayISO={todayISO} />
          )}
        </div>
      </div>
    </PageHead>
  );
}
