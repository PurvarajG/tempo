"use client";

import Icon from "./ui/Icon";
import Button from "./ui/Button";
import { useTasks } from "@/lib/store-context";

/**
 * Starting a timer is a one-click action from wherever a task appears, not
 * something you have to open the panel for. Starting a second one raises the
 * conflict prompt rather than silently doing nothing.
 */
export default function TimerButton({
  taskId,
  title,
  variant = "quiet",
}: {
  taskId: string;
  title: string;
  variant?: "quiet" | "primary";
}) {
  const { running, startTimer, stopTimer } = useTasks();
  const isRunning = running?.taskId === taskId;

  if (variant === "primary") {
    return (
      <Button
        variant="primary"
        onClick={() => (isRunning ? stopTimer() : startTimer(taskId))}
        aria-label={isRunning ? `Stop timer for ${title}` : `Start timer for ${title}`}
      >
        {isRunning ? "Stop" : (
          <>
            <Icon name="play" size={12} />
            Start
          </>
        )}
      </Button>
    );
  }

  return (
    <button
      onClick={() => (isRunning ? stopTimer() : startTimer(taskId))}
      aria-label={isRunning ? `Stop timer for ${title}` : `Start timer for ${title}`}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors ${
        isRunning
          ? "bg-accent-soft text-accent"
          : "text-ink-3 hover:bg-sunk hover:text-ink"
      }`}
    >
      {isRunning ? "Stop" : (
        <>
          <Icon name="play" />
          Start
        </>
      )}
    </button>
  );
}

/**
 * Focus starts the timer and a countdown of the remaining estimate. While a
 * session runs on this task the sidebar timer card owns it, so this renders
 * nothing. "ghost" is the Up next form: a second-weight text action that never
 * outweighs Start. "quiet" is the row hover cluster form.
 */
export function FocusButton({
  task,
  variant = "quiet",
}: {
  task: { id: string; title: string; minutes: number | null | undefined };
  variant?: "quiet" | "ghost";
}) {
  const { focus, startFocus } = useTasks();
  if (focus?.taskId === task.id) return null;

  const label = `Focus on ${task.title}`;
  if (variant === "ghost") {
    return (
      <Button variant="ghost" icon="target" onClick={() => void startFocus(task)} aria-label={label}>
        Focus
      </Button>
    );
  }

  return (
    <button
      onClick={() => void startFocus(task)}
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-ink-3 transition-colors hover:bg-sunk hover:text-ink"
    >
      <Icon name="target" />
      Focus
    </button>
  );
}
