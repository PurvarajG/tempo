"use client";

import Card from "../ui/Card";
import Caption from "../ui/Caption";
import Icon from "../ui/Icon";
import Ticks from "../ui/Ticks";
import { fmtHours } from "@/lib/format";
import type { ProjectSummary } from "@/lib/summary";
import { useTasks } from "@/lib/store-context";
import type { Task } from "@/lib/types";

export interface ProjectSummaryCardProps {
  summary: ProjectSummary;
  leftToPlan: number;
  carriedOver: number;
}

// Hairlines read the same in both forms: left on the right column and top on
// the second row in the 2x2, left on cells 2-4 from the rail breakpoint.
const CELL = "p-5";
const CELL_2 = "border-l border-line";
const CELL_3 = "border-t border-line rail:border-t-0 rail:border-l";
const CELL_4 = "border-t border-l border-line rail:border-t-0 rail:border-l";

export default function ProjectSummaryCard({
  summary,
  leftToPlan,
  carriedOver,
}: ProjectSummaryCardProps) {
  const percent = Math.round(summary.percentComplete);
  const week = summary.recordedWeekMinutes;
  return (
    <Card className="grid grid-cols-2 rail:grid-cols-[1.6fr_1fr_1fr_1fr]">
      <div className={`${CELL}`}>
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="grid size-7 shrink-0 place-items-center rounded-tile ring-1 ring-line text-ink-2"
          >
            <Icon name="folder" size={16} />
          </span>
          <h2 className="text-title font-medium text-ink">Project momentum</h2>
        </div>
        <div className="mt-4 text-big text-ink">
          {percent}%
          <span className="ml-2 text-title font-normal tracking-normal text-ink-2">completed</span>
        </div>
        <Ticks value={percent / 100} label={`${percent}% of tasks done`} className="mt-3" />
        <p className="mt-2 text-secondary text-ink-3">
          {`${summary.completed} of ${summary.total} tasks finished.`}
        </p>
      </div>
      <div className={`${CELL} ${CELL_2}`}>
        <Caption as="div">Tracked</Caption>
        <div className="mt-3 whitespace-nowrap font-mono text-pm-value text-ink">
          {fmtHours(summary.recordedMinutes)}
        </div>
        <div className="mt-2 whitespace-nowrap text-secondary text-ink-3">
          {week > 0 ? `+${fmtHours(week)} this week` : "Nothing this week"}
        </div>
      </div>
      <div className={`${CELL} ${CELL_3}`}>
        <Caption as="div">Left to plan</Caption>
        <div className="mt-3 whitespace-nowrap font-mono text-pm-value text-ink">
          {fmtHours(leftToPlan)}
        </div>
        <div className="mt-2 whitespace-nowrap text-secondary text-ink-3">
          {`Across ${summary.open} open ${summary.open === 1 ? "task" : "tasks"}`}
        </div>
      </div>
      <div className={`${CELL} ${CELL_4}`}>
        <Caption as="div">Open tasks</Caption>
        <div className="mt-3 whitespace-nowrap font-mono text-pm-value text-ink">
          {String(summary.open)}
        </div>
        <div className="mt-2 whitespace-nowrap text-secondary text-ink-3">
          {carriedOver > 0 ? `${carriedOver} carried over` : "None carried over"}
        </div>
      </div>
    </Card>
  );
}

const SHOWN = 5;

export function GoneQuietLine({ tasks }: { tasks: Task[] }) {
  const { openTask } = useTasks();
  if (tasks.length === 0) return null;
  const shown = tasks.slice(0, SHOWN);
  const more = tasks.length - shown.length;
  return (
    <p className="text-meta text-ink-3">
      Gone quiet:{" "}
      {shown.map((t, i) => (
        <span key={t.id}>
          <button
            type="button"
            onClick={() => openTask(t.id)}
            className="text-ink-2 hover:text-ink"
          >
            {t.title}
          </button>
          {i < shown.length - 1 ? ", " : more > 0 ? " " : "."}
        </span>
      ))}
      {more > 0 ? `and ${more} more.` : null}
    </p>
  );
}
