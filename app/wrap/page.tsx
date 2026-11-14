"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import BrainDumpCard from "@/components/wrap/BrainDumpCard";
import DayCheck from "@/components/wrap/DayCheck";
import EstimateMisses from "@/components/wrap/EstimateMisses";
import ExpiredNotice from "@/components/wrap/ExpiredNotice";
import GoneQuiet from "@/components/wrap/GoneQuiet";
import InboxTriage from "@/components/wrap/InboxTriage";
import TomorrowCard from "@/components/wrap/TomorrowCard";
import WeekNumbers from "@/components/wrap/WeekNumbers";
import WrapDone from "@/components/wrap/WrapDone";
import PageHead from "@/components/ui/PageHead";
import { fmtDayLong, fmtWeekday } from "@/lib/format";
import { toISODate } from "@/lib/parse";
import { useTasks } from "@/lib/store-context";
import { withSettingsDefaults } from "@/lib/store-context/use-tracking-config";
import { useNow } from "@/lib/useNow";
import {
  calmLine,
  doneOn,
  estimateMisses,
  focusedMinutes,
  goneQuiet,
  isResetDay,
  tomorrowTasks,
  weekNumbers,
} from "@/lib/wrap";

export default function WrapPage() {
  return (
    <Suspense fallback={null}>
      <Wrap />
    </Suspense>
  );
}

function Wrap() {
  const params = useSearchParams();
  const { tasks, timeEntries, running, ready, settings } = useTasks();
  const now = useNow();

  if (!now || !ready) return null;

  const todayISO = toISODate(now);
  const reset =
    params?.get("reset") === "1" || isResetDay(todayISO, withSettingsDefaults(settings).weeklyResetDay);

  const done = doneOn(tasks, todayISO);
  const focused = focusedMinutes(timeEntries, todayISO, running, now);
  const { planned, carried } = tomorrowTasks(tasks, todayISO);
  const dateDim = `${fmtWeekday(todayISO)} ${fmtDayLong(todayISO)}`;

  return (
    <PageHead
      title="Wrap up"
      dim={dateDim}
      subtitle={calmLine(done.length, focused)}
      headerExtra={reset ? <WeekNumbers numbers={weekNumbers(tasks, timeEntries, todayISO)} /> : undefined}
      rail={
        <>
          <EstimateMisses misses={estimateMisses(tasks, timeEntries, todayISO)} />
          <DayCheck dayISO={todayISO} />
          {reset && <BrainDumpCard />}
        </>
      }
    >
      <div className="flex min-w-0 flex-col gap-4">
        <ExpiredNotice todayISO={todayISO} />
        <WrapDone tasks={done} focusedMinutes={focused} />
        <TomorrowCard planned={planned} carried={carried} todayISO={todayISO} />
        {reset && <InboxTriage todayISO={todayISO} />}
        {reset && <GoneQuiet tasks={goneQuiet(tasks, timeEntries, todayISO)} todayISO={todayISO} />}
      </div>
    </PageHead>
  );
}
