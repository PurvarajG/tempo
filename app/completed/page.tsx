"use client";

import { useMemo } from "react";
import TaskRow from "@/components/TaskRow";
import Button from "@/components/ui/Button";
import Card, { CardHeader } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Icon from "@/components/ui/Icon";
import PageHead from "@/components/ui/PageHead";
import { fmt, fmtDate } from "@/lib/format";
import { toISODate } from "@/lib/parse";
import { useTasks } from "@/lib/store-context";
import type { Task } from "@/lib/types";
import { useNow } from "@/lib/useNow";

export default function CompletedPage() {
  const { tasks, ready, reopenTask } = useTasks();
  const now = useNow();
  const todayISO = now ? toISODate(now) : "";

  const { done, groups } = useMemo(() => {
    const done = tasks
      .filter((t) => t.status === "done" && t.completedAt)
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
    const byDay = new Map<string, Task[]>();
    for (const t of done) {
      const day = toISODate(new Date(t.completedAt as string));
      const list = byDay.get(day) ?? [];
      list.push(t);
      byDay.set(day, list);
    }
    const groups = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    return { done, groups };
  }, [tasks]);

  const subtitle = !ready
    ? undefined
    : done.length === 0
      ? "Nothing done yet."
      : `${done.length} ${done.length === 1 ? "task" : "tasks"} done.`;

  return (
    <PageHead title="Completed" subtitle={subtitle}>
      <div className="max-w-3xl">
      <Card aria-labelledby="completed-title">
        <CardHeader
          titleId="completed-title"
          icon={<Icon name="check" size={16} />}
          title="Done"
          count={ready ? done.length : undefined}
        />
        {ready && done.length === 0 && <EmptyState title="Nothing done yet." live />}
        {ready &&
          groups.map(([day, dayTasks]) => (
            <section key={day} aria-label={day === todayISO ? "Today" : fmtDate(day, todayISO)}>
              <div className="flex items-center justify-between px-3 pb-1 pt-4 text-meta text-ink-3">
                <span>{day === todayISO ? "Today" : fmtDate(day, todayISO)}</span>
                <span className="font-mono">{fmt(dayTasks.reduce((sum, t) => sum + t.minutes, 0))}</span>
              </div>
              <ul className="task-list px-2 pb-2">
                {dayTasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    todayISO={todayISO}
                    actions={
                      <Button variant="ghost" size="sm" onClick={() => void reopenTask(t.id)}>
                        Reopen
                      </Button>
                    }
                  />
                ))}
              </ul>
            </section>
          ))}
      </Card>
      </div>
    </PageHead>
  );
}
