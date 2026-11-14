"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTasks } from "@/lib/store-context";
import { toISODate } from "@/lib/parse";
import { projectSummary } from "@/lib/summary";
import { projectColorVar } from "@/lib/types";
import PageHead from "@/components/ui/PageHead";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Segmented from "@/components/ui/Segmented";
import ProjectSettings from "@/components/ProjectSettings";
import Board from "@/components/kanban/Board";
import ProjectList from "@/components/kanban/ProjectList";
import ProjectSummaryCard, { GoneQuietLine } from "@/components/kanban/ProjectSummaryCard";
import { carriedOver, goneQuiet, leftToPlanMinutes } from "@/components/kanban/lanes";

type ProjectView = "board" | "list";

export default function ProjectPage() {
  return (
    <Suspense fallback={null}>
      <Project />
    </Suspense>
  );
}

function Project() {
  const { id } = useParams<{ id: string }>();
  const { tasks, projects, stages, timeEntries, ready } = useTasks();
  const router = useRouter();
  const params = useSearchParams();
  const todayISO = toISODate(new Date());
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ?view=list is the only value written; absent means the board.
  const view: ProjectView = params.get("view") === "list" ? "list" : "board";

  const setView = useCallback(
    (next: ProjectView) => {
      const query = new URLSearchParams(params.toString());
      if (next === "board") query.delete("view");
      else query.set("view", next);
      const qs = query.toString();
      const base = `/projects/${id}`;
      router.replace(qs ? `${base}?${qs}` : base, { scroll: false });
    },
    [params, router, id],
  );

  const project = projects.find((p) => p.id === id);

  const summary = useMemo(
    () => projectSummary(id, tasks, stages, timeEntries, todayISO),
    [id, tasks, stages, timeEntries, todayISO],
  );
  const quiet = useMemo(
    () => goneQuiet(tasks, stages, id, todayISO),
    [tasks, stages, id, todayISO],
  );
  const leftToPlan = useMemo(() => leftToPlanMinutes(tasks, id), [tasks, id]);
  const carried = useMemo(() => carriedOver(tasks, id, todayISO).length, [tasks, id, todayISO]);

  if (ready && !project) {
    return <div className="mx-auto max-w-3xl px-6 py-16 text-center text-body text-ink-3">Project not found.</div>;
  }
  if (!project) return null;

  const lanes = stages.filter((s) => s.projectId === project.id).length;

  return (
    <PageHead
      leading={
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-row text-logo text-project-foreground shadow-logo"
          style={{ background: projectColorVar(project.color) }}
        >
          {project.name.trim().charAt(0).toUpperCase()}
        </span>
      }
      title={<span className="select-text">{project.name}</span>}
      subtitle={`${summary.open} open ${summary.open === 1 ? "task" : "tasks"} across ${lanes} ${lanes === 1 ? "lane" : "lanes"}.`}
      actions={
        <>
          <Button variant="ghost" onClick={() => setSettingsOpen(true)}>
            Settings
          </Button>
          <Segmented<ProjectView>
            ariaLabel="Project view"
            value={view}
            onChange={setView}
            options={[
              { value: "board", label: "Board", icon: <Icon name="board" size={16} /> },
              { value: "list", label: "List", icon: <Icon name="list" size={16} /> },
            ]}
          />
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <ProjectSummaryCard summary={summary} leftToPlan={leftToPlan} carriedOver={carried} />
        <GoneQuietLine tasks={quiet} />
        {view === "list" ? (
          <ProjectList project={project} todayISO={todayISO} />
        ) : (
          <Board project={project} todayISO={todayISO} />
        )}
      </div>

      {settingsOpen && <ProjectSettings project={project} onClose={() => setSettingsOpen(false)} />}
    </PageHead>
  );
}
