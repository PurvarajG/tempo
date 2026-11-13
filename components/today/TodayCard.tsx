"use client";

import Link from "next/link";
import TaskRow from "@/components/TaskRow";
import CarriedOver from "@/components/today/CarriedOver";
import CommitStar from "@/components/today/CommitStar";
import DoneToday from "@/components/today/DoneToday";
import UpNextRow from "@/components/today/UpNextRow";
import Card, { CardHeader } from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import { fmt } from "@/lib/format";
import { useTasks } from "@/lib/store-context";
import { trackedByDay, type TodayLayout } from "@/lib/today";
import type { Task } from "@/lib/types";

const SUB = "flex items-center justify-between px-3 pb-1 pt-4 text-meta text-ink-3";

function Rows({ tasks, todayISO }: { tasks: Task[]; todayISO: string }) {
  return (
    <ul className="task-list">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} todayISO={todayISO} trailing={<CommitStar task={task} todayISO={todayISO} />} />
      ))}
    </ul>
  );
}

export default function TodayCard({
  layout,
  todayISO,
  inboxCount,
  onSomethingElse,
}: {
  layout: TodayLayout;
  todayISO: string;
  inboxCount: number;
  onSomethingElse: () => void;
}) {
  const { timeEntries } = useTasks();

  const { upNext, committed, couldAlso, carried, done } = layout;
  const openCount = (upNext ? 1 : 0) + committed.length + couldAlso.length + carried.length;
  const nothingOpen = openCount === 0;
  const nothingPlanned = !upNext && committed.length === 0 && couldAlso.length === 0 && done.length === 0;
  const allDone = nothingOpen && done.length > 0;
  const trackedToday = trackedByDay(timeEntries, todayISO, 1).at(-1) ?? 0;

  return (
    <Card aria-labelledby="today-card-title" className="flex flex-col">
      <CardHeader
        titleId="today-card-title"
        title="Today"
        icon={<Icon name="target" size={16} />}
        count={openCount}
        right="Sorted by priority"
      />

      <div className="flex flex-col px-2 pb-2">
        {upNext ? (
          <UpNextRow
            suggestion={upNext}
            todayISO={todayISO}
            onSomethingElse={onSomethingElse}
            canSkip={layout.alternatives.length > 0}
          />
        ) : null}

        {nothingPlanned ? (
          <div className="px-3 py-2">
            <p className="text-body text-ink-2">Nothing planned for today.</p>
            {carried.length > 0 ? (
              <a href="#carried-over" className="text-secondary text-accent hover:underline">
                See carried over
              </a>
            ) : null}
          </div>
        ) : null}

        {allDone ? (
          <div className="px-3 py-2">
            <p className="text-body text-ink-2">All done for today.</p>
            <p className="text-meta text-ink-3">{`${done.length} done, ${fmt(trackedToday)} tracked.`}</p>
          </div>
        ) : null}

        {!nothingPlanned && !allDone && committed.length > 0 ? (
          <>
            <h3 className={SUB}>Today&apos;s 3</h3>
            <Rows tasks={committed} todayISO={todayISO} />
          </>
        ) : null}

        {!nothingPlanned && !allDone && couldAlso.length > 0 ? (
          <>
            {committed.length > 0 ? <h3 className={SUB}>{`Also today, ${couldAlso.length}`}</h3> : null}
            <Rows tasks={couldAlso} todayISO={todayISO} />
          </>
        ) : null}

        <CarriedOver tasks={carried} todayISO={todayISO} />

        {inboxCount > 0 ? (
          <Link
            href="/inbox"
            className="inline-flex h-9 items-center self-start rounded-full px-3 text-secondary text-ink-2 hover:bg-sunk"
          >
            {`Inbox, ${inboxCount}`}
          </Link>
        ) : null}

        <DoneToday tasks={done} />
      </div>
    </Card>
  );
}
