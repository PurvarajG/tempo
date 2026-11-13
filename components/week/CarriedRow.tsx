"use client";

import { useId, useState } from "react";
import { useTasks } from "@/lib/store-context";
import type { Task } from "@/lib/types";
import Button from "@/components/ui/Button";
import Caption from "@/components/ui/Caption";
import Card from "@/components/ui/Card";
import WeekTaskItem from "./WeekTaskItem";

export interface CarriedRowProps {
  tasks: Task[];
  todayISO: string;
}

const SHOWN = 3;

/** The "Carried over" row at the top of Next 7 days, drawn in the day row's form. */
export default function CarriedRow({ tasks, todayISO }: CarriedRowProps) {
  const { rescheduleTasks } = useTasks();
  const [expanded, setExpanded] = useState(false);
  const labelId = useId();

  if (tasks.length === 0) return null;

  const visible = expanded ? tasks : tasks.slice(0, SHOWN);
  const hidden = tasks.length - visible.length;

  return (
    <Card
      as="section"
      aria-labelledby={labelId}
      className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-6 px-5 py-4 rail:grid-cols-[96px_minmax(0,1fr)_240px]"
    >
      <div>
        <div className="text-day-num text-ink">{tasks.length}</div>
        <Caption as="div" id={labelId} className="mt-1">
          Carried over
        </Caption>
      </div>
      <div className="min-w-0">
        <ul className="flex flex-col gap-2">
          {visible.map((task) => (
            <WeekTaskItem key={task.id} task={task} />
          ))}
        </ul>
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mt-2 pl-12 text-meta text-ink-3"
          >
            {`+${hidden} more`}
          </button>
        )}
      </div>
      <div className="col-span-2 rail:col-span-1">
        <Button
          variant="chip"
          size="sm"
          icon="today"
          onClick={() => void rescheduleTasks(tasks.map((t) => t.id), todayISO)}
        >
          Move all to today
        </Button>
      </div>
    </Card>
  );
}
