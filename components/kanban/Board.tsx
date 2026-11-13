"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTasks } from "@/lib/store-context";
import { useBoardDrag } from "@/lib/useBoardDrag";
import type { Project } from "@/lib/types";
import Icon from "../ui/Icon";
import Column from "./Column";
import { AddStageDialog } from "./StageDialogs";

type Fade = "start" | "end" | "both" | undefined;

export default function Board({
  project,
  todayISO,
}: {
  project: Project;
  todayISO: string;
}) {
  const { tasks, stagesFor, moveTask, addStage } = useTasks();
  const [addingLane, setAddingLane] = useState(false);
  /** Announced politely after a move, whether it came from drag or keyboard. */
  const [announcement, setAnnouncement] = useState("");
  const [fade, setFade] = useState<Fade>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  const stages = stagesFor(project.id);

  const byStage = useMemo(() => {
    const map = new Map<string, typeof tasks>();
    for (const stage of stages) map.set(stage.id, []);
    for (const task of tasks) {
      if (
        task.status === "trashed" ||
        task.projectId !== project.id ||
        !task.stageId
      )
        continue;
      map.get(task.stageId)?.push(task);
    }
    for (const list of map.values())
      list.sort((a, b) => a.boardOrder - b.boardOrder);
    return map;
  }, [tasks, stages, project.id]);

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const hiddenStart = el.scrollLeft > 1;
    const hiddenEnd = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setFade(
      hiddenStart && hiddenEnd
        ? "both"
        : hiddenStart
          ? "start"
          : hiddenEnd
            ? "end"
            : undefined,
    );
  }, []);

  useEffect(() => {
    measure();
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, stages.length]);

  const announceMove = useCallback(
    (taskId: string, stageId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      const stage = stages.find((s) => s.id === stageId);
      if (task && stage)
        setAnnouncement(`${task.title} moved to ${stage.name}.`);
    },
    [tasks, stages],
  );

  const onMove = useCallback(
    (taskId: string, stageId: string, index: number) => {
      moveTask(taskId, stageId, index);
      announceMove(taskId, stageId);
    },
    [moveTask, announceMove],
  );

  const { dragTaskId, target, cardProps, columnProps } = useBoardDrag(onMove);

  return (
    <>
      {/* The only horizontal scroller on the page. The p-1 -m-1 gutter keeps lane edges and card shadows from being clipped. */}
      <div
        ref={scrollRef}
        onScroll={measure}
        data-fade={fade}
        className="board-scroll -m-1 p-1"
      >
        <div className="flex min-w-full items-start gap-4">
          <div className="grid flex-1 auto-cols-[minmax(14rem,1fr)] grid-flow-col items-start gap-4">
            {stages.map((stage) => (
              <Column
                key={stage.id}
                stage={stage}
                stages={stages}
                tasks={byStage.get(stage.id) ?? []}
                todayISO={todayISO}
                projectId={project.id}
                dragTaskId={dragTaskId}
                dropIndex={target?.stageId === stage.id ? target.index : null}
                cardProps={cardProps}
                columnProps={columnProps}
                onMove={onMove}
              />
            ))}
          </div>

          <button
            type="button"
            aria-label="Add lane"
            title="Add lane"
            onClick={() => setAddingLane(true)}
            className="grid size-10 shrink-0 place-items-center rounded-tab text-ink-3 inset-ring-1 inset-ring-line-2 hover:bg-sunk"
          >
            <Icon name="plus" />
          </button>
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <AddStageDialog
        open={addingLane}
        onClose={() => setAddingLane(false)}
        onAdd={async (name, kind) => {
          await addStage(project.id, { name, kind });
          setAnnouncement(`${name} column added.`);
        }}
      />
    </>
  );
}
