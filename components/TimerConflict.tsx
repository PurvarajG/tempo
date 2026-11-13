"use client";

import { useRef } from "react";
import Dialog from "@/components/ui/Dialog";
import Button from "@/components/ui/Button";
import { useTasks } from "@/lib/store-context";

/**
 * A second timer isn't an error to apologise for, it's a choice. This names
 * the task already running and offers one hand-off or keeping things as they are.
 */
export default function TimerConflict() {
  const { timerConflict, dismissTimerConflict, switchTimer, tasks } = useTasks();
  const switchRef = useRef<HTMLButtonElement>(null);

  const runningTask = timerConflict
    ? tasks.find((t) => t.id === timerConflict.runningTaskId)
    : undefined;
  const target = timerConflict ? tasks.find((t) => t.id === timerConflict.taskId) : undefined;

  const running = runningTask ? `"${runningTask.title}"` : "another task";
  const next = target ? `"${target.title}"` : "this one";

  return (
    <Dialog
      open={Boolean(timerConflict)}
      onClose={dismissTimerConflict}
      role="alertdialog"
      title="A timer is already running"
      description={`${running} is running. Switch to ${next}?`}
      initialFocusRef={switchRef}
      actions={
        <>
          <Button variant="ghost" onClick={dismissTimerConflict}>
            Keep current
          </Button>
          <Button
            ref={switchRef}
            variant="primary"
            onClick={() => timerConflict && switchTimer(timerConflict.taskId)}
          >
            Switch
          </Button>
        </>
      }
    />
  );
}
