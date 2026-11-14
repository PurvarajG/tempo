"use client";

import { useMemo, useState } from "react";
import { useTasks } from "@/lib/store-context";
import { fmt, fmtDate, PRIORITY_NAME } from "@/lib/format";
import {
  DURATIONS,
  type Priority,
  type RecurrenceFreq,
  type RecurrenceFrom,
  type Task,
} from "@/lib/types";
import SidePanel from "./ui/SidePanel";
import Caption from "./ui/Caption";
import Button from "./ui/Button";
import Input from "./ui/Input";
import Segmented from "./ui/Segmented";
import Toggle from "./ui/Toggle";
import TaskTime from "./TaskTime";
import SubtaskList from "./SubtaskList";

/** Same surface as ui/Input's "field" variant, for the elements Input cannot wrap. */
const FIELD_SURFACE =
  "w-full rounded-row bg-sunk px-3 text-body text-ink inset-ring-1 inset-ring-line-strong placeholder:text-ink-3";
const SELECT_CLASS = `${FIELD_SURFACE} h-10`;
const TEXTAREA_CLASS = `${FIELD_SURFACE} py-2.5 resize-y`;

function Row({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Caption as="label" htmlFor={htmlFor}>
        {label}
      </Caption>
      {children}
    </div>
  );
}

/**
 * Text that saves on blur (and Enter when single-line), so a slow network never
 * fights the cursor. Local text is authoritative while focused.
 */
function SavingText({
  id,
  label,
  value,
  onSave,
  multiline = false,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onSave: (next: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [adopted, setAdopted] = useState(value);
  const [focused, setFocused] = useState(false);

  if (!focused && value !== adopted) {
    setAdopted(value);
    setDraft(value);
  }

  const shared = {
    id,
    value: draft,
    placeholder,
    onFocus: () => setFocused(true),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(e.target.value),
    onBlur: () => {
      setFocused(false);
      if (draft !== value) onSave(draft);
    },
  };

  return (
    <Row label={label} htmlFor={id}>
      {multiline ? (
        <textarea {...shared} rows={4} className={TEXTAREA_CLASS} />
      ) : (
        <Input
          {...shared}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
      )}
    </Row>
  );
}

function BlockedBy({ task }: { task: Task }) {
  const { tasks, linkBlocker, unlinkBlocker } = useTasks();
  const [query, setQuery] = useState("");

  const current = task.blockedBy ?? [];
  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return [];
    return tasks
      .filter(
        (t) =>
          t.status === "open" &&
          !t.deletedAt &&
          t.id !== task.id &&
          !current.includes(t.id) &&
          t.title.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [tasks, task.id, current, q]);

  return (
    <div className="space-y-2">
      <Row label="Blocked by" htmlFor="task-blocked-by">
        <Input
          id="task-blocked-by"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tasks"
        />
      </Row>
      {results.length > 0 && (
        <ul className="space-y-1" aria-label="Matching tasks">
          {results.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => {
                  linkBlocker(task.id, t.id);
                  setQuery("");
                }}
                className="w-full rounded-tab px-3 py-2 text-left text-secondary text-ink hover:bg-sunk"
              >
                {t.title}
              </button>
            </li>
          ))}
        </ul>
      )}
      {current.length > 0 && (
        <ul className="space-y-1" aria-label="Current blockers">
          {current.map((id) => {
            const blocker = tasks.find((t) => t.id === id);
            const name = blocker?.title ?? "Unknown task";
            return (
              <li
                key={id}
                className="flex items-center justify-between gap-2 rounded-tab bg-sunk px-3 py-1.5 text-secondary text-ink"
              >
                <span className="min-w-0 truncate">{name}</span>
                <button
                  type="button"
                  aria-label={`Remove blocker ${name}`}
                  onClick={() => unlinkBlocker(task.id, id)}
                  className="grid size-6 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-surface hover:text-ink"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function PanelBody({ task }: { task: Task }) {
  const { projects, stagesFor, patchTask } = useTasks();
  const stages = task.projectId ? stagesFor(task.projectId) : [];

  const moreSet = Boolean(
    task.recurrence ||
      task.tags.length > 0 ||
      task.isComplex ||
      task.startOn ||
      task.expiresOn ||
      (task.blockedBy?.length ?? 0) > 0,
  );
  const [moreOpen, setMoreOpen] = useState(moreSet);

  return (
    <div className="space-y-5">
      <SavingText
        id="task-title"
        label="Title"
        value={task.title}
        onSave={(title) => title.trim() && patchTask(task.id, { title: title.trim() })}
      />

      <TaskTime task={task} />

      <div className="grid grid-cols-2 gap-4">
        <Row label="Date" htmlFor="task-date">
          <Input
            id="task-date"
            type="date"
            value={task.scheduled ?? ""}
            onChange={(e) => patchTask(task.id, { scheduled: e.target.value || null })}
            />
        </Row>

        {task.isComplex ? (
          <Row label="Finish" htmlFor="task-finish">
            <Input
              id="task-finish"
              type="date"
              min={task.scheduled ?? undefined}
              value={task.finishDate ?? task.scheduled ?? ""}
              onChange={(e) => e.target.value && patchTask(task.id, { finishDate: e.target.value })}
                />
          </Row>
        ) : (
          <Row label="Time" htmlFor="task-time">
            <Input
              id="task-time"
              type="time"
              value={task.dueTime ?? ""}
              onChange={(e) => patchTask(task.id, { dueTime: e.target.value })}
                />
          </Row>
        )}
      </div>

      <Row label="Estimate" htmlFor="task-estimate">
        <div className="flex items-center gap-3">
          <Input
            id="task-estimate"
            type="number"
            min={1}
            step={5}
            value={task.minutes}
            onChange={(e) => {
              const n = Math.round(Number(e.target.value));
              if (Number.isFinite(n) && n >= 1) patchTask(task.id, { minutes: n });
            }}
            wrapperClassName="w-28"
          />
          <span className="font-mono text-meta text-ink-3">{fmt(task.minutes)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {DURATIONS.map((d) => {
            const current = task.minutes === d;
            return (
              <Button
                key={d}
                variant="chip"
                size="sm"
                aria-pressed={current}
                onClick={() => patchTask(task.id, { minutes: d })}
              >
                {fmt(d)}
              </Button>
            );
          })}
        </div>
      </Row>

      <Row label="Priority">
        <Segmented
          ariaLabel="Priority"
          size="sm"
          value={String(task.priority)}
          onChange={(v) => patchTask(task.id, { priority: Number(v) as Priority })}
          options={PRIORITY_NAME.map((name, i) => ({ value: String(i), label: name }))}
        />
      </Row>

      <div className="grid grid-cols-2 gap-4">
        <Row label="Project" htmlFor="task-project">
          <select
            id="task-project"
            value={task.projectId ?? ""}
            onChange={(e) => patchTask(task.id, { projectId: e.target.value })}
            className={SELECT_CLASS}
          >
            <option value="">No project</option>
            {projects
              .filter((p) => !p.archived || p.id === task.projectId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </Row>

        {task.projectId && (
          <Row label="Column" htmlFor="task-stage">
            <select
              id="task-stage"
              value={task.stageId ?? ""}
              onChange={(e) => patchTask(task.id, { stageId: e.target.value })}
              className={SELECT_CLASS}
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Row>
        )}
      </div>

      <SavingText
        id="task-notes"
        label="Notes"
        value={task.notes ?? ""}
        multiline
        placeholder="Anything worth remembering"
        onSave={(notes) => patchTask(task.id, { notes })}
      />

      <SubtaskList task={task} />

      <section className="border-t border-line pt-4">
        <button
          type="button"
          aria-expanded={moreOpen}
          aria-controls="task-more"
          onClick={() => setMoreOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-tab py-1 text-secondary font-medium text-ink-2 hover:text-ink"
        >
          More
          <span aria-hidden className="text-ink-3">
            {moreOpen ? "−" : "+"}
          </span>
        </button>

        {moreOpen && (
          <div id="task-more" className="mt-4 space-y-5">
            <Row label="Repeat" htmlFor="task-recurrence">
              <select
                id="task-recurrence"
                value={task.recurrence?.freq ?? ""}
                onChange={(e) =>
                  patchTask(task.id, {
                    recurrence: e.target.value
                      ? {
                          freq: e.target.value as RecurrenceFreq,
                          interval: 1,
                          ...(task.recurrence?.from ? { from: task.recurrence.from } : {}),
                        }
                      : undefined,
                  })
                }
                className={SELECT_CLASS}
              >
                <option value="">Never</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </Row>

            {task.recurrence && (
              <Row label="Repeat from">
                <Segmented<RecurrenceFrom>
                  ariaLabel="Repeat from"
                  size="sm"
                  value={task.recurrence.from ?? "schedule"}
                  onChange={(from) =>
                    patchTask(task.id, { recurrence: { ...task.recurrence!, from } })
                  }
                  options={[
                    { value: "schedule", label: "the schedule" },
                    { value: "done", label: "when I finish it" },
                  ]}
                />
              </Row>
            )}

            <SavingText
              id="task-tags"
              label="Tags"
              value={task.tags.join(", ")}
              placeholder="errands, deep-work"
              onSave={(raw) =>
                patchTask(task.id, {
                  tags: raw
                    .split(",")
                    .map((t) => t.trim().replace(/^@/, ""))
                    .filter(Boolean),
                })
              }
            />

            <div className="flex items-center justify-between gap-3">
              <span className="text-secondary text-ink-2">Spans multiple days</span>
              <Toggle
                label="Spans multiple days"
                on={task.isComplex}
                onChange={() => {
                  const isComplex = !task.isComplex;
                  patchTask(task.id, {
                    isComplex,
                    finishDate: isComplex ? (task.finishDate ?? task.scheduled ?? undefined) : undefined,
                  });
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Row label="Hide until" htmlFor="task-start-on">
                <Input
                  id="task-start-on"
                  type="date"
                  value={task.startOn ?? ""}
                  onChange={(e) => patchTask(task.id, { startOn: e.target.value || null })}
                        />
              </Row>
              <Row label="Expires" htmlFor="task-expires-on">
                <Input
                  id="task-expires-on"
                  type="date"
                  value={task.expiresOn ?? ""}
                  onChange={(e) => patchTask(task.id, { expiresOn: e.target.value || null })}
                        />
              </Row>
            </div>
            {(task.startOn || task.expiresOn) && (
              <p className="text-meta text-ink-3">
                {task.startOn ? `Hidden until ${fmtDate(task.startOn)}. ` : ""}
                {task.expiresOn ? `Expires ${fmtDate(task.expiresOn)}.` : ""}
              </p>
            )}

            <BlockedBy task={task} />
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * The one editing surface. Today, Kanban, Calendar, search, and the smart
 * lists all open this same panel, so a field only has to be right once.
 */
export default function TaskPanel() {
  const { tasks, openTaskId, closeTask, completeTask, reopenTask, trashTask } = useTasks();

  const task = useMemo(() => tasks.find((t) => t.id === openTaskId) ?? null, [tasks, openTaskId]);
  if (!task) return null;
  const done = task.status === "done";

  return (
    <SidePanel
      open
      onClose={closeTask}
      title="Task"
      footer={
        <div className="flex items-center justify-between">
          <Button
            variant="primary"
            onClick={() => (done ? reopenTask(task.id) : completeTask(task.id))}
          >
            {done ? "Reopen" : "Mark done"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              trashTask(task.id);
              closeTask();
            }}
          >
            Move to trash
          </Button>
        </div>
      }
    >
      <PanelBody key={task.id} task={task} />
    </SidePanel>
  );
}
