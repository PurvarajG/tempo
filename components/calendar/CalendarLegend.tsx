"use client";

import { useTasks } from "@/lib/store-context";
import { projectColorVar } from "@/lib/types";

/** The legend under the calendar card: plain text items with a small swatch. */
export default function CalendarLegend({
  projectIds,
  tip,
  showKinds = true,
}: {
  projectIds: string[];
  tip?: string;
  showKinds?: boolean;
}) {
  const { projects } = useTasks();
  const items = projectIds
    .map((id) => projects.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p);

  return (
    <div aria-label="Calendar legend" className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-meta text-ink-3">
      {items.map((p) => (
        <span key={p.id} className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <i aria-hidden="true" className="legend-swatch" style={{ background: projectColorVar(p.color) }} />
          {p.name}
        </span>
      ))}
      {showKinds && (
        <>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <i aria-hidden="true" className="legend-swatch is-solid" />
            Planned
          </span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <i aria-hidden="true" className="legend-swatch is-stripe" />
            Tracked
          </span>
        </>
      )}
      {tip && <span className="ml-auto whitespace-nowrap">{tip}</span>}
    </div>
  );
}
