"use client";

import { useTasks } from "@/lib/store-context";
import { FOCUS_EXTEND_MINUTES, focusOverLine, focusPhase, focusRemainingMs } from "@/lib/focus-session";
import { fmtCountdown } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import Button from "./ui/Button";
import Icon from "./ui/Icon";
import Menu from "./ui/Menu";
import { useElapsed } from "./TaskTime";

/**
 * The running timer lives in the sidebar as a card. When the sidebar is
 * collapsed, the compact variant sits in the top bar. Nothing floats over
 * page content, and the one thing you always need, stopping it, stays in
 * reach from wherever you ended up.
 */
export default function TimerStrip({ variant = "card" }: { variant?: "card" | "compact" }) {
  const { running, tasks, stopTimer, completeTask, openTask, focus, extendFocus, keepGoing } = useTasks();
  const elapsed = useElapsed(running?.startedAt);
  const now = useNow(1000);

  if (!running) return null;

  const task = tasks.find((t) => t.id === running.taskId);
  const title = task?.title ?? "Untitled task";
  const open = () => task && openTask(task.id);
  // One set of Time's up actions, used by the card buttons and the compact menu.
  const finish = async () => {
    await stopTimer();
    await completeTask(running.taskId);
  };

  // The clock updates every second, so it is announced once rather than
  // sixty times a minute.
  const phase = focus && now ? focusPhase(focus, now) : null;
  const countdown = focus && now && phase === "counting" ? fmtCountdown(focusRemainingMs(focus, now)) : null;
  const live = (
    <span className="sr-only" aria-live="polite">
      {phase === "timesUp" ? `Time's up for ${title}` : `Tracking ${title}`}
    </span>
  );

  if (variant === "compact") {
    return (
      <div className="no-drag flex h-9 min-w-0 max-w-72 items-center gap-2 rounded-full bg-sunk pl-3 pr-1.5">
        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-ok motion-safe:animate-pulse-dot" />
        <button
          onClick={open}
          className="min-w-0 truncate text-left text-secondary font-medium text-ink hover:text-ink-2"
        >
          {title}
        </button>
        <span className="shrink-0 font-mono text-secondary tabular-nums text-ink" aria-live="off">
          {phase === "timesUp" ? <span className="font-sans">{"Time's up"}</span> : (countdown ?? elapsed)}
        </span>
        {live}
        {phase === "timesUp" ? (
          <Menu
            variant="icon"
            ariaLabel="Time's up actions"
            label={<Icon name="more" size={16} />}
            minWidth={160}
            items={[
              { id: "done", label: "Done", icon: "check", onSelect: finish },
              { id: "extend", label: `+${FOCUS_EXTEND_MINUTES}m`, onSelect: () => extendFocus() },
              { id: "keep", label: "Keep going", onSelect: () => keepGoing() },
            ]}
          />
        ) : null}
        <button
          onClick={() => stopTimer()}
          aria-label="Stop"
          className="grid size-6 shrink-0 place-items-center rounded-full bg-surface hover:bg-line-2"
        >
          <span aria-hidden className="size-2 rounded-sm bg-ink" />
        </button>
      </div>
    );
  }

  return (
    <div data-part="timer" className="rounded-timer bg-surface p-4 shadow-sm ring-1 ring-line">
      <div className="flex items-center gap-2 text-meta text-ink-3">
        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-ok shadow-live motion-safe:animate-pulse-dot" />
        {focus && phase !== "over" ? (phase === "timesUp" ? "Time's up" : "Focus") : "Tracking now"}
      </div>
      <button
        onClick={open}
        className="mt-2 block w-full truncate text-left text-secondary font-medium text-ink hover:text-ink-2"
      >
        {title}
      </button>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span
          data-part="clock"
          className="font-mono text-clock tabular-nums text-ink"
          aria-live="off"
          aria-label={countdown ? `${countdown} left` : undefined}
        >
          {countdown ?? elapsed}
        </span>
        {live}
        <button
          onClick={() => stopTimer()}
          aria-label="Stop"
          className="grid size-8 shrink-0 place-items-center rounded-tab bg-sunk hover:bg-line-2"
        >
          <span aria-hidden className="size-2.5 rounded-stop bg-ink" />
        </button>
      </div>
      {phase === "timesUp" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            icon="check"
            onClick={finish}
          >
            Done
          </Button>
          <Button size="sm" variant="chip" onClick={() => extendFocus()}>
            +{FOCUS_EXTEND_MINUTES}m
          </Button>
          <Button size="sm" variant="ghost" onClick={() => keepGoing()}>
            Keep going
          </Button>
        </div>
      ) : null}
      {phase === "over" && focus && now ? (
        <p className="mt-2 text-meta text-ink-3">{focusOverLine(focus, now)}</p>
      ) : null}
    </div>
  );
}
