"use client";

import { useState } from "react";
import { useElapsed } from "@/components/TaskTime";
import Button from "@/components/ui/Button";
import Caption from "@/components/ui/Caption";
import { fmt } from "@/lib/format";
import { useTasks } from "@/lib/store-context";
import ActivityPill from "../ActivityPill";
import CategoryDot from "../CategoryDot";
import { presetChips } from "../presets";
import QuickAddActivity from "../QuickAddActivity";
import { segmentLabel } from "../segment-label";
import TaskPicker from "../TaskPicker";

/**
 * The live control: what's running right now, and one tap to switch it.
 * Starting a preset while one runs hands off atomically — never stop, then
 * separately start — so the timeline is never briefly tracking nothing.
 */
export default function NowModule() {
  const { categories, activities, runningSegment, tasks, projects, startSegment, switchSegment, stopSegment } =
    useTasks();
  const [showAll, setShowAll] = useState(false);

  const elapsed = useElapsed(runningSegment?.startedAt);
  const runningCategory = categories.find((c) => c.id === runningSegment?.categoryId);
  const elapsedMinutes = Number.parseInt(elapsed.split(":")[0] ?? "0", 10) || 0;
  const runningLabel = runningSegment ? segmentLabel(runningSegment, categories, activities, tasks) : "";

  const { pinned, rest } = presetChips(activities, categories);
  // The running activity's chip must always be visible even if unpinned.
  const runningChip =
    runningSegment?.activityId && !pinned.some((c) => c.activity.id === runningSegment.activityId)
      ? rest.find((c) => c.activity.id === runningSegment.activityId)
      : undefined;
  const visiblePinned = runningChip ? [...pinned, runningChip] : pinned;
  const hiddenRest = runningChip ? rest.filter((c) => c.activity.id !== runningChip.activity.id) : rest;

  function start(categoryId: string, activityId: string) {
    if (runningSegment?.activityId === activityId) return;
    if (runningSegment) {
      switchSegment({ categoryId, activityId });
    } else {
      startSegment({ categoryId, activityId });
    }
  }

  function startTask(taskId: string) {
    if (runningSegment?.taskId === taskId) return;
    if (runningSegment) {
      switchSegment({ taskId });
    } else {
      startSegment({ taskId });
    }
  }

  const chip = ({ activity, category }: (typeof pinned)[number]) => (
    <ActivityPill
      key={activity.id}
      color={category.color}
      name={activity.name}
      active={runningSegment?.activityId === activity.id}
      onClick={() => start(category.id, activity.id)}
    />
  );

  return (
    <div className="space-y-5">
      {/* The Up next row's form (.task.next): raised, shadow-md, radius 14, padding 16. */}
      <div
        data-testid="now-status"
        className="flex items-center gap-3 rounded-composer bg-raised p-4 shadow-md ring-1 ring-line-2"
      >
        <div className="min-w-0 flex-1">
          {runningSegment ? (
            <>
              <span className="inline-flex items-center gap-2 text-meta text-ink-3">
                <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-ok motion-safe:animate-pulse-dot" />
                Running
              </span>
              <p className="mt-1 flex min-w-0 items-center gap-2 text-upnext text-ink">
                {runningCategory && <CategoryDot color={runningCategory.color} />}
                <span className="truncate">{runningLabel}</span>
              </p>
            </>
          ) : (
            <>
              <p className="text-upnext text-ink">Nothing running</p>
              <p className="mt-1 text-meta text-ink-3">Pick a task or an activity below.</p>
            </>
          )}
        </div>
        {runningSegment && (
          <>
            <span className="shrink-0 font-mono text-secondary tabular-nums text-ink" aria-live="off">
              {fmt(elapsedMinutes)}
            </span>
            <Button variant="primary" onClick={() => stopSegment()}>
              Stop
            </Button>
          </>
        )}
      </div>

      <div className="space-y-2">
        <Caption as="div">Start a task</Caption>
        <TaskPicker
          tasks={tasks}
          projects={projects}
          value={runningSegment?.taskId}
          onChange={startTask}
          placeholder="Start a task…"
          size="lg"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Caption>Quick start</Caption>
          <a href="/tracking/settings" className="text-meta text-accent hover:underline">
            Manage
          </a>
        </div>

        {visiblePinned.length > 0 || hiddenRest.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {visiblePinned.map(chip)}

            <QuickAddActivity />

            {hiddenRest.length > 0 && (
              <Button
                size="sm"
                onClick={() => setShowAll((v) => !v)}
                aria-expanded={showAll}
                icon={showAll ? "chevup" : undefined}
                iconAfter={showAll ? undefined : "chev"}
                className={showAll ? "" : "[&>svg]:rotate-90"}
              >
                {showAll ? "Show fewer" : `Show all (${hiddenRest.length} more)`}
              </Button>
            )}

            {showAll && hiddenRest.map(chip)}
          </div>
        ) : (
          <p className="text-secondary text-ink-3">
            No quick-start presets yet.{" "}
            <a href="/tracking/settings" className="text-accent hover:underline">
              Add some in settings
            </a>
            .
          </p>
        )}
      </div>
    </div>
  );
}
