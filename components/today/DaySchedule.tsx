"use client";

import Card, { CardHeader } from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import { fmt } from "@/lib/format";
import type { DayPlan } from "@/lib/day-plan";
import { useTasks } from "@/lib/store-context";

/** The derived schedule for the rest of the day: placed tasks and the free gaps between them. */
export default function DaySchedule({ plan }: { plan: DayPlan }) {
  const { openTask } = useTasks();

  return (
    <Card>
      <CardHeader
        icon={<Icon name="clock" />}
        title={plan.label}
        right={<span className="font-mono">{`${plan.from} to ${plan.to}`}</span>}
      />
      <div className="flex flex-col gap-2 px-4 pb-4">
        {plan.blocks.length === 0 ? (
          <p className="text-body text-ink-3">Nothing left to place today.</p>
        ) : (
          plan.blocks.map((block, i) => (
            <div
              key={`${block.kind}-${block.start}-${i}`}
              className="grid grid-cols-[44px_1fr] items-center gap-3 text-meta"
            >
              <span className="font-mono text-ink-3">{block.start}</span>
              {block.kind === "task" ? (
                <div
                  className={`flex items-center justify-between gap-2 rounded-tab px-3 py-2 text-secondary ${
                    block.current
                      ? "bg-accent-soft text-ink shadow-now-edge"
                      : "bg-sunk text-ink"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => openTask(block.task.id)}
                    className="min-w-0 truncate text-left hover:underline focus-visible:underline"
                  >
                    {block.task.title}
                  </button>
                  <span
                    className={`shrink-0 font-mono text-meta ${
                      block.current ? "text-accent" : "text-ink-3"
                    }`}
                  >
                    {fmt(block.minutes)}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 rounded-tab px-3 py-2 text-secondary text-ink-3 inset-ring inset-ring-line-2">
                  <span className="min-w-0 truncate">
                    {block.fits ? `Free, fits ${block.fits.title}` : "Free"}
                  </span>
                  <span className="shrink-0 font-mono text-meta">{fmt(block.minutes)}</span>
                </div>
              )}
            </div>
          ))
        )}
        {plan.leftover.length > 0 ? (
          <p className="text-meta text-ink-3">{`Not placed: ${plan.leftover.length}`}</p>
        ) : null}
      </div>
    </Card>
  );
}
