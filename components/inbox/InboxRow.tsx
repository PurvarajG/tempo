"use client";

import { useTasks } from "@/lib/store-context";
import type { Task } from "@/lib/types";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import IconButton from "../ui/IconButton";
import PostponeButton from "../ui/PostponeButton";
import TaskRow, { ITEM } from "../TaskRow";
import { ageLabel } from "./inbox-data";

/**
 * One Inbox task (soft.html .task): the plain task row with an age meta item,
 * and Today (ghost), Pick a day (chip) and Move to trash (32px circle) on hover/focus.
 */
export default function InboxRow({ task, todayISO }: { task: Task; todayISO: string }) {
  const { rescheduleTasks, trashTask } = useTasks();
  return (
    <TaskRow
      task={task}
      todayISO={todayISO}
      meta={
        <span className={ITEM}>
          <Icon name="clock" size={13} />
          {ageLabel(task, todayISO)}
        </span>
      }
      actions={
        <>
          <Button variant="ghost" size="md" onClick={() => void rescheduleTasks([task.id], todayISO)}>
            Today
          </Button>
          <PostponeButton task={task} todayISO={todayISO} variant="pick" />
          <IconButton
            icon="trash"
            shape="round"
            compact
            size={14}
            label="Move to trash"
            onClick={() => void trashTask(task.id)}
          />
        </>
      }
    />
  );
}
