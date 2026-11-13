"use client";

import { inboxStats } from "@/components/inbox/inbox-data";
import Kpi from "@/components/ui/Kpi";
import Spark from "@/components/ui/Spark";
import { fmtDay, fmtHours, fmtWeekday } from "@/lib/format";
import { useTasks } from "@/lib/store-context";

const nowrap = (v: string | number) => (
  <span className="whitespace-nowrap">{v}</span>
);

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** "2026-11-01" -> "Sun 1 Nov", the mockup's date form. */
function since(iso: string): string {
  return `${fmtWeekday(iso, "short")} ${fmtDay(iso)}`;
}

export default function InboxKpis({ todayISO }: { todayISO: string }) {
  const { tasks } = useTasks();
  const s = inboxStats(tasks, todayISO);
  const oldest = s.oldestDays ?? 0;

  return (
    <div className="grid grid-cols-2 gap-4 rail:grid-cols-4">
      <Kpi
        label="In inbox"
        value={nowrap(s.count)}
        unit={plural(s.count, "task", "tasks")}
        visual={
          <Spark values={s.addedByDay} label="Added to the inbox, last 12 days" />
        }
        foot={{
          label: nowrap("Added this week"),
          value: nowrap(s.addedThisWeek),
        }}
      />
      <Kpi
        label="Oldest"
        value={nowrap(oldest)}
        unit={plural(oldest, "day", "days")}
        visual={
          <Spark
            values={s.addedByDay}
            label="Added to the inbox, last 12 days"
          />
        }
        foot={{
          label: nowrap(s.oldestSince ? "Since" : "Nothing waiting"),
          value: nowrap(s.oldestSince ? since(s.oldestSince) : ""),
        }}
      />
      <Kpi
        label="Estimated"
        value={nowrap(fmtHours(s.estimatedMinutes))}
        visual={
          <Spark
            values={s.minutesByDay}
            label="Estimated time added, last 12 days"
          />
        }
        foot={{
          label: nowrap("No estimate"),
          value: nowrap(
            `${s.noEstimate} ${plural(s.noEstimate, "task", "tasks")}`,
          ),
        }}
      />
      <Kpi
        label="Cleared"
        value={nowrap(s.clearedThisWeek)}
        unit="this week"
        visual={
          <Spark
            values={s.clearedByDay}
            label="Cleared from the inbox, last 12 days"
          />
        }
        foot={{
          label: nowrap("Done today"),
          value: nowrap(s.clearedToday),
        }}
      />
    </div>
  );
}
