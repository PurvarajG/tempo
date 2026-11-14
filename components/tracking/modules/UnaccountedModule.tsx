"use client";

import { useState } from "react";
import { fmt, fmtClock } from "@/lib/format";
import { useTasks } from "@/lib/store-context";
import { wakingWindow } from "@/lib/tracking-day";
import type { Gap, TrackingSettings } from "@/lib/types";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import ActivityPill from "../ActivityPill";
import GapFillForm from "../GapFillForm";
import { presetChips } from "../presets";

const ITEM = "inline-flex items-center gap-1 whitespace-nowrap";

/** A gap right at the edge of the waking window reads as an overnight boundary, not a mid-day hole. */
function edgeLabel(gap: Gap, settings: TrackingSettings, dayISO: string): string | null {
  const { start: wakeStart, end: wakeEnd } = wakingWindow(dayISO, settings);
  if (new Date(gap.startedAt).getTime() === wakeStart.getTime()) return "Since waking";
  if (new Date(gap.endedAt).getTime() >= wakeEnd.getTime()) return "Into the night";
  return null;
}

/** Gaps today: what is missing from the day, and one tap to fill it. Renders the body only. */
export default function GapsTodayModule({ dayISO }: { dayISO: string }) {
  const { gaps, categories, activities, settings, fillGap } = useTasks();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { pinned } = presetChips(activities, categories);

  if (gaps.length === 0) {
    return <p className="px-3 py-3 text-body text-ink-3">No gaps today.</p>;
  }

  return (
    <ul className="flex flex-col">
      {gaps.map((gap) => {
        const key = `${gap.startedAt}-${gap.endedAt}`;
        const label = settings ? edgeLabel(gap, settings, dayISO) : null;
        return (
          <li key={key} className="rounded-row border-t border-line px-3 py-3 first:border-t-0">
            <div className="text-body font-medium text-ink">
              {fmtClock(new Date(gap.startedAt))} to {fmtClock(new Date(gap.endedAt))}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-meta text-ink-3">
              <span className={ITEM}>
                <Icon name="clock" size={13} />
                {fmt(gap.minutes)}
              </span>
              <span className={ITEM}>{label ?? "Choose what you were doing"}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {pinned.slice(0, 4).map(({ activity, category }) => (
                <ActivityPill
                  key={activity.id}
                  color={category.color}
                  name={activity.name}
                  onClick={() =>
                    fillGap({ startedAt: gap.startedAt, endedAt: gap.endedAt, categoryId: category.id, activityId: activity.id })
                  }
                />
              ))}
              <Button
                variant="ghost"
                size="sm"
                aria-expanded={expanded === key}
                onClick={() => setExpanded(expanded === key ? null : key)}
              >
                Something else…
              </Button>
            </div>

            {expanded === key && <GapFillForm gap={gap} onFilled={() => setExpanded(null)} />}
          </li>
        );
      })}
    </ul>
  );
}
