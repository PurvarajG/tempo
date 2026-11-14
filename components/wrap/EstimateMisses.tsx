"use client";

import Card, { CardHeader } from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import Pill from "@/components/ui/Pill";
import { fmt } from "@/lib/format";
import { useTasks } from "@/lib/store-context";
import type { EstimateMiss } from "@/lib/wrap";

/** The three tasks where tracked time landed furthest from the estimate. */
export default function EstimateMisses({ misses }: { misses: EstimateMiss[] }) {
  const { openTask } = useTasks();

  return (
    <Card>
      <CardHeader
        icon={<Icon name="clock" />}
        title="Estimates"
        count={misses.length}
        right="Planned against tracked"
      />
      <div className="flex flex-col gap-2 px-4 pb-4">
        {misses.length === 0 ? (
          <p className="text-body text-ink-3">Nothing tracked against an estimate today.</p>
        ) : (
          misses.map((miss) => {
            const diff =
              miss.actual >= miss.planned
                ? `+${fmt(miss.over)}`
                : `${fmt(miss.planned - miss.actual)} under`;
            return (
              <div
                key={miss.task.id}
                className="flex flex-col gap-1 rounded-tab bg-sunk px-3 py-2 text-secondary text-ink"
              >
                <button
                  type="button"
                  onClick={() => openTask(miss.task.id)}
                  className="min-w-0 truncate text-left hover:underline focus-visible:underline"
                >
                  {miss.task.title}
                </button>
                <div className="flex items-center justify-between gap-2 text-meta text-ink-3">
                  <span>
                    {"planned "}
                    <span className="font-mono">{fmt(miss.planned)}</span>
                    {", took "}
                    <span className="font-mono">{fmt(miss.actual)}</span>
                  </span>
                  <Pill>{diff}</Pill>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
