"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import TaskRow from "@/components/TaskRow";
import Card, { CardHeader } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Icon from "@/components/ui/Icon";
import PageHead from "@/components/ui/PageHead";
import { searchProjects, searchTasks } from "@/lib/search";
import { toISODate } from "@/lib/parse";
import { useTasks } from "@/lib/store-context";
import { projectColorVar } from "@/lib/types";
import { useNow } from "@/lib/useNow";

function SearchResults() {
  const params = useSearchParams();
  const router = useRouter();
  const { tasks, projects } = useTasks();
  const now = useNow();
  const todayISO = now ? toISODate(now) : "";

  // The field owns the live value; the URL follows it, never the other way round.
  const [q, setQ] = useState(params.get("q") ?? "");
  const query = q.trim();

  const taskHits = searchTasks(tasks, query);
  const projectHits = searchProjects(projects, query);
  const total = taskHits.length + projectHits.length;

  const onChange = (value: string) => {
    setQ(value);
    const next = value.trim();
    router.replace(next ? `/search?q=${encodeURIComponent(next)}` : "/search");
  };

  const subtitle = query
    ? `${total} ${total === 1 ? "result" : "results"} for “${query}”.`
    : undefined;

  return (
    <PageHead title="Search" subtitle={subtitle}>
      <div className="flex max-w-3xl flex-col gap-4">
        <div className="composer-frame flex h-13 items-center gap-3 rounded-composer bg-surface pl-4 pr-2">
          <Icon name="search" size={18} className="text-ink-3" />
          <input
            type="text"
            value={q}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Search tasks and projects"
            aria-label="Search"
            autoFocus
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-body text-ink placeholder:text-ink-3"
          />
        </div>

        {!query && (
          <Card>
            <EmptyState
              live
              icon={<Icon name="search" size={18} />}
              title="Search your tasks and projects"
              description={"Titles, notes and tags all count. Press ⌘K to search from anywhere."}
            />
          </Card>
        )}

        {query && total === 0 && (
          <Card>
            <EmptyState
              live
              icon={<Icon name="search" size={18} />}
              title={`Nothing matches “${query}”.`}
              description="Try fewer words, or part of a project name."
            />
          </Card>
        )}

        {taskHits.length > 0 && (
          <Card aria-labelledby="search-tasks-title">
            <CardHeader
              titleId="search-tasks-title"
              icon={<Icon name="search" size={16} />}
              title="Tasks"
              count={taskHits.length}
            />
            <ul className="task-list px-2 pb-2">
              {taskHits.map((t) => (
                <TaskRow key={t.id} task={t} todayISO={todayISO} showDate />
              ))}
            </ul>
          </Card>
        )}

        {projectHits.length > 0 && (
          <Card aria-labelledby="search-projects-title">
            <CardHeader
              titleId="search-projects-title"
              icon={<Icon name="search" size={16} />}
              title="Projects"
              count={projectHits.length}
            />
            <ul className="task-list px-2 pb-2">
              {projectHits.map((p) => {
                const open = tasks.filter((t) => t.projectId === p.id && t.status === "open").length;
                return (
                  <li key={p.id}>
                    <Link
                      href={`/projects/${p.id}`}
                      className="flex items-center gap-3 rounded-row p-3 transition-colors duration-150 ease-out hover:bg-sunk/60"
                    >
                      <span
                        aria-hidden="true"
                        className="size-3.5 shrink-0 rounded-sm"
                        style={{ background: projectColorVar(p.color) }}
                      />
                      <span className="min-w-0 flex-1 truncate text-body font-medium text-ink">{p.name}</span>
                      <span className="shrink-0 font-mono text-meta text-ink-3">{open} open</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>
    </PageHead>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchResults />
    </Suspense>
  );
}
