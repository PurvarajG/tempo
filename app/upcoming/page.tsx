"use client";

import { Suspense, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTasks } from "@/lib/store-context";
import { useNow } from "@/lib/useNow";
import { addDays, toISODate } from "@/lib/parse";
import { fmtRange } from "@/lib/format";
import { carriedTasks, planItFor, weekHeadline, weekRows } from "@/lib/week-capacity";
import type { Task } from "@/lib/types";
import PageHead from "@/components/ui/PageHead";
import Icon from "@/components/ui/Icon";
import Segmented from "@/components/ui/Segmented";
import WeekBoard from "@/components/week/WeekBoard";
import CarriedRow from "@/components/week/CarriedRow";
import DayRow from "@/components/week/DayRow";

type WeekView = "list" | "board" | "calendar";

export default function UpcomingPage() {
  return (
    <Suspense fallback={null}>
      <Upcoming />
    </Suspense>
  );
}

function Upcoming() {
  const { tasks, settings, ready, running, rescheduleTasks } = useTasks();
  const router = useRouter();
  const params = useSearchParams();
  const tab: "list" | "board" = params.get("view") === "board" ? "board" : "list";
  const now = useNow();
  const todayISO = now ? toISODate(now) : "";
  const runningTaskId = running?.taskId ?? null;

  const view = useMemo(() => {
    if (!now) return null;
    const rows = weekRows(tasks, todayISO, now, settings);
    const carried = carriedTasks(tasks, todayISO);
    const used = new Set<string>();
    const planIts = rows.map((row) => {
      const pick = planItFor(tasks, row, todayISO, now, runningTaskId, used);
      if (pick) used.add(pick.id);
      return pick;
    });
    return { rows, carried, planIts };
  }, [tasks, settings, now, todayISO, runningTaskId]);

  const onChange = useCallback(
    (next: WeekView) => {
      if (next === "calendar") {
        router.push("/calendar?view=week");
        return;
      }
      router.replace(next === "board" ? "/upcoming?view=board" : "/upcoming", { scroll: false });
    },
    [router],
  );

  const actions = (
    <Segmented<WeekView>
      ariaLabel="Next 7 days view"
      value={tab}
      onChange={onChange}
      options={[
        { value: "list", label: "List", icon: <Icon name="list" size={16} /> },
        { value: "board", label: "Board", icon: <Icon name="board" size={16} /> },
        { value: "calendar", label: "Calendar", icon: <Icon name="cal" size={16} /> },
      ]}
    />
  );

  return (
    <PageHead
      title="Next 7 days"
      dim={now ? fmtRange(todayISO, addDays(todayISO, 6)) : undefined}
      subtitle={view ? weekHeadline(view.rows, view.carried.length) : undefined}
      actions={actions}
    >
      {ready && view ? (
        tab === "board" ? (
          <WeekBoard
            rows={view.rows}
            carried={view.carried}
            planIts={view.planIts}
            todayISO={todayISO}
            onPlanIt={(task: Task, date: string) => void rescheduleTasks([task.id], date)}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <CarriedRow tasks={view.carried} todayISO={todayISO} />
            {view.rows.map((row, i) => (
              <DayRow
                key={row.date}
                row={row}
                planIt={view.planIts[i]}
                onPlanIt={(task: Task) => void rescheduleTasks([task.id], row.date)}
              />
            ))}
          </div>
        )
      ) : null}
    </PageHead>
  );
}
