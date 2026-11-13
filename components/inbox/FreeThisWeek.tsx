"use client";

import Card, { CardHeader } from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import { fmt, fmtHours, fmtWeekday } from "@/lib/format";
import { useTasks } from "@/lib/store-context";
import type { Task } from "@/lib/types";
import { freeThisWeek } from "./inbox-data";

/**
 * Inbox right column: up to three free windows this week. Each row is a mono
 * weekday, then one outlined block: "16:15 to 18:00, fits <task>" on the left
 * (truncating) and the window length in mono on the right. Header right is the
 * sum of the shown windows.
 */
export default function FreeThisWeek({ todayISO, inbox }: { todayISO: string; inbox: Task[] }) {
  const { tasks, settings } = useTasks();
  const { slots, totalMinutes, provisional } = freeThisWeek(tasks, inbox, todayISO, new Date(), settings);

  return (
    <Card>
      <CardHeader
        icon={<Icon name="clock" />}
        title="Free this week"
        right={provisional ? null : <span className="font-mono">{fmtHours(totalMinutes)}</span>}
      />
      <div className="flex flex-col gap-2 px-4 pb-4">
        {provisional ? (
          <p className="text-body text-ink-3">Working out your week.</p>
        ) : slots.length === 0 ? (
          <p className="text-body text-ink-3">No free time left this week.</p>
        ) : (
          slots.map((slot) => (
            <div
              key={slot.date}
              className="grid grid-cols-[44px_1fr] items-center gap-3 text-meta"
            >
              <span className="font-mono text-ink-3">{fmtWeekday(slot.date, "short")}</span>
              <div className="flex items-center justify-between gap-2 rounded-tab px-3 py-2 text-secondary text-ink-3 inset-ring inset-ring-line-2">
                <span className="min-w-0 truncate">
                  {slot.fits ? `${slot.start} to ${slot.end}, fits ${slot.fits.title}` : `${slot.start} to ${slot.end}`}
                </span>
                <span className="shrink-0 font-mono text-meta">{fmt(slot.minutes)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
