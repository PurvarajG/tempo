"use client";

import { useState } from "react";
import { useTasks } from "@/lib/store-context";
import { daysBetween, toISODate } from "@/lib/parse";
import { fmtDate } from "@/lib/format";
import { shiftDays } from "@/lib/summary";
import type { Task } from "@/lib/types";

/**
 * HTML5 drag-to-reschedule, shared by the month/week/day grids so dropping a
 * marker on a date behaves identically everywhere — one hook instead of a
 * `drop()` copy-pasted per view. `tasksByDate` only needs to be searchable by
 * id, so callers pass whatever map they already built for rendering.
 */
export function useDragReschedule(tasksByDate: Map<string, Task[]>, onAnnounce: (message: string) => void) {
  const { patchTask } = useTasks();
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [overDate, setOverDate] = useState<string | null>(null);

  function startDrag(e: React.DragEvent, taskId: string) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", taskId);
    setDragTaskId(taskId);
  }

  function endDrag() {
    setDragTaskId(null);
    setOverDate(null);
  }

  function dragOver(e: React.DragEvent, iso: string) {
    if (!dragTaskId) return;
    e.preventDefault();
    setOverDate(iso);
  }

  function dragLeave(iso: string) {
    setOverDate((prev) => (prev === iso ? null : prev));
  }

  function drop(e: React.DragEvent, iso: string) {
    e.preventDefault();
    if (!dragTaskId) return;
    const task = [...tasksByDate.values()].flat().find((t) => t.id === dragTaskId);
    setDragTaskId(null);
    setOverDate(null);
    if (!task || task.scheduled === null || task.scheduled === iso) return;
    if (task.isComplex && task.finishDate) {
      const delta = daysBetween(task.scheduled, iso);
      patchTask(task.id, { scheduled: iso, finishDate: shiftDays(task.finishDate, delta) });
    } else {
      patchTask(task.id, { scheduled: iso });
    }
    onAnnounce(`${task.title} moved to ${fmtDate(iso, toISODate(new Date()))}.`);
  }

  return { dragTaskId, overDate, startDrag, endDrag, dragOver, dragLeave, drop };
}
