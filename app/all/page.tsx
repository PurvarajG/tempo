"use client";

import { Fragment, useMemo } from "react";
import QuickAdd from "@/components/QuickAdd";
import TaskRow from "@/components/TaskRow";
import Card, { CardHeader } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Icon from "@/components/ui/Icon";
import PageHead from "@/components/ui/PageHead";
import { isHiddenUntil } from "@/lib/next";
import { toISODate } from "@/lib/parse";
import { useTasks } from "@/lib/store-context";
import { useDragReorder } from "@/lib/useDragReorder";
import { useNow } from "@/lib/useNow";

export default function AllPage() {
  const { tasks, ready, reorderTasks } = useTasks();
  const now = useNow();
  const todayISO = now ? toISODate(now) : "";

  const open = useMemo(
    () => tasks.filter((t) => t.status === "open").sort((a, b) => a.sortOrder - b.sortOrder),
    [tasks],
  );

  const { list, dragHandleProps } = useDragReorder(open, reorderTasks);

  const subtitle = !ready
    ? undefined
    : open.length === 0
      ? "Nothing open."
      : `${open.length} open ${open.length === 1 ? "task" : "tasks"}. Drag to set your own order.`;

  return (
    <PageHead title="All tasks" subtitle={subtitle}>
      <div className="flex max-w-3xl flex-col gap-4">
        <QuickAdd id="doem-quick-add" autoFocus={false} />
        <Card aria-labelledby="all-title">
          <CardHeader
            titleId="all-title"
            icon={<Icon name="list" size={16} />}
            title="Open"
            count={ready ? open.length : undefined}
          />
          {ready && list.length > 0 && (
            <ul className="task-list px-2 pb-2">
              {list.map((t) => {
                const row = (
                  <TaskRow
                    task={t}
                    todayISO={todayISO}
                    showDate
                    draggable
                    dragHandleProps={dragHandleProps(t.id)}
                  />
                );
                return isHiddenUntil(t, todayISO) ? (
                  <li key={t.id} className="opacity-60">
                    <ul>{row}</ul>
                  </li>
                ) : (
                  <Fragment key={t.id}>{row}</Fragment>
                );
              })}
            </ul>
          )}
          {ready && list.length === 0 && (
            <EmptyState
              title="Nothing open."
              description="Add a task above, or check Next 7 days."
            />
          )}
        </Card>
      </div>
    </PageHead>
  );
}
