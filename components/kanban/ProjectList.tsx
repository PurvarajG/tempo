"use client";

import { Fragment, useMemo, useState } from "react";
import TaskRow from "@/components/TaskRow";
import Button from "@/components/ui/Button";
import Card, { CardHeader } from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import { isHiddenUntil } from "@/lib/next";
import { useTasks } from "@/lib/store-context";
import type { Project, ProjectStage, Task } from "@/lib/types";
import { laneGlyph } from "./lanes";

const DONE_CAP = 2;

function StageCard({ stage, tasks, todayISO }: { stage: ProjectStage; tasks: Task[]; todayISO: string }) {
  const [showAll, setShowAll] = useState(false);
  const capped = stage.kind === "done" && !showAll && tasks.length > DONE_CAP;
  const visible = capped ? tasks.slice(0, DONE_CAP) : tasks;
  const glyph = laneGlyph(stage.kind);

  return (
    <Card aria-labelledby={`list-stage-${stage.id}`}>
      <CardHeader
        titleId={`list-stage-${stage.id}`}
        title={stage.name}
        count={tasks.length}
        icon={<Icon name={glyph === "live" ? "play" : glyph} size={16} />}
      />
      <div className="px-2 pb-2">
        {tasks.length === 0 ? (
          <p className="px-2 py-3 text-meta text-ink-3">Nothing here yet.</p>
        ) : (
          <ul className="task-list">
            {visible.map((task) => {
              const row = <TaskRow task={task} todayISO={todayISO} showProject={false} showDate />;
              return isHiddenUntil(task, todayISO) ? (
                <li key={task.id} className="opacity-60">
                  <ul>{row}</ul>
                </li>
              ) : (
                <Fragment key={task.id}>{row}</Fragment>
              );
            })}
          </ul>
        )}
        {capped && (
          <div className="px-1 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setShowAll(true)}>
              Show {tasks.length - DONE_CAP} more
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function ProjectList({ project, todayISO }: { project: Project; todayISO: string }) {
  const { tasks, stagesFor } = useTasks();
  const stages = stagesFor(project.id);

  const byStage = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const stage of stages) map.set(stage.id, []);
    for (const task of tasks) {
      if (task.status === "trashed" || task.projectId !== project.id || !task.stageId) continue;
      map.get(task.stageId)?.push(task);
    }
    for (const list of map.values()) list.sort((a, b) => a.boardOrder - b.boardOrder);
    return map;
  }, [tasks, stages, project.id]);

  return (
    <div className="flex flex-col gap-6">
      {stages.map((stage) => (
        <StageCard key={stage.id} stage={stage} tasks={byStage.get(stage.id) ?? []} todayISO={todayISO} />
      ))}
    </div>
  );
}
