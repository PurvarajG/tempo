"use client";

import Checkbox from "@/components/ui/Checkbox";
import Menu from "@/components/ui/Menu";
import PostponeButton from "@/components/ui/PostponeButton";
import TimerButton, { FocusButton } from "@/components/TimerButton";
import { TaskMeta } from "@/components/TaskRow";
import Icon, { type IconName } from "@/components/ui/Icon";
import type { Suggestion } from "@/lib/next";
import { useTasks } from "@/lib/store-context";

/** The glyph for a suggest() reason, chosen by kind. */
function reasonIcon(reason: string): IconName {
  if (reason.startsWith("Unblocks")) return "up";
  if (reason.startsWith("Committed")) return "target";
  if (reason.startsWith("Carried over")) return "today";
  if (reason.startsWith("Fits before") || reason.includes("free")) return "clock";
  return "check";
}

/**
 * The first, raised row of the Today card (.task.next). Chosen by suggest();
 * shows at most two reasons and never a score.
 */
export default function UpNextRow({
  suggestion,
  todayISO,
  onSomethingElse,
  canSkip,
}: {
  suggestion: Suggestion;
  todayISO: string;
  onSomethingElse: () => void;
  canSkip: boolean;
}) {
  const { completeTask, openTask } = useTasks();
  const { task } = suggestion;
  // The meta draws the priority pill and the due chip itself, so reasons that
  // repeat those facts are dropped by kind.
  const reasons = suggestion.reasons
    .filter((r) => !r.startsWith("Due ") && !r.toLowerCase().includes("priority"))
    .slice(0, 2);

  const menuItems = [
    ...(canSkip
      ? [{ id: "something-else", label: "Something else", onSelect: onSomethingElse }]
      : []),
    { id: "open", label: "Open", icon: "panel" as const, onSelect: () => openTask(task.id) },
  ];

  return (
    <div
      data-testid="up-next"
      className="-mx-1 mb-2 grid grid-cols-[20px_minmax(0,1fr)] items-center rail:grid-cols-[20px_minmax(0,1fr)_auto] gap-3 rounded-composer bg-raised p-4 shadow-md ring-1 ring-line-2"
    >
      <Checkbox
        checked={false}
        onCheckedChange={() => void completeTask(task.id)}
        label={`Mark done ${task.title}`}
      />
      <div className="min-w-0">
        <span className="inline-flex rounded-full bg-accent-soft px-2 py-0.5 text-caption font-medium text-accent">
          Up next
        </span>
        <div className="mt-2 flex">
          <button
            type="button"
            onClick={() => openTask(task.id)}
            className="min-w-0 truncate text-left text-upnext text-ink"
          >
            {task.title}
          </button>
        </div>
        <TaskMeta task={task} todayISO={todayISO} showEstimate nowrap>
          {reasons.map((reason) => (
            <span key={reason} className="inline-flex items-center gap-1 whitespace-nowrap">
              <Icon name={reasonIcon(reason)} size={13} />
              {reason}
            </span>
          ))}
        </TaskMeta>
      </div>
      <div
        data-testid="up-next-actions"
        className="col-start-2 flex flex-wrap items-center justify-start gap-2 rail:col-start-auto rail:shrink-0 rail:flex-nowrap rail:justify-end"
      >
        <PostponeButton task={task} todayISO={todayISO} variant="ghost" />
        <FocusButton task={task} variant="ghost" />
        <TimerButton taskId={task.id} title={task.title} variant="primary" />
        <Menu
          variant="icon"
          label={<Icon name="more" />}
          ariaLabel={`More actions for ${task.title}`}
          items={menuItems}
          className="shrink-0"
        />
      </div>
    </div>
  );
}
