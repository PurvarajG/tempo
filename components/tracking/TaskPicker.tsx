"use client";

import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePickerMenu } from "@/lib/usePickerMenu";
import { toISODate } from "@/lib/parse";
import { projectColorVar, type Project, type Task } from "@/lib/types";

const MIN_WIDTH = 288;

/**
 * A searchable picker over open tasks — scheduled today first, then most
 * recently scheduled. Used anywhere a segment can be pointed at a task: the
 * dashboard's "start a task" lane, retro-linking a segment, and gap fill.
 */
export default function TaskPicker({
  tasks,
  projects,
  value,
  onChange,
  label = "Task",
  placeholder = "Pick a task",
  /** Adds a "No task" entry that calls onChange("") — for retro-linking, where unlinking is a real choice. */
  clearable = false,
  /** "lg" is the emphasized trigger NOW uses for its input-surface prominence. */
  size = "md",
}: {
  tasks: Task[];
  projects: Project[];
  value: string | undefined;
  onChange: (taskId: string) => void;
  label?: string;
  placeholder?: string;
  clearable?: boolean;
  size?: "md" | "lg";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const selected = tasks.find((t) => t.id === value);

  const today = toISODate(new Date());
  const open_ = useMemo(
    () =>
      tasks
        .filter((t) => t.status === "open")
        .sort((a, b) => {
          const aToday = a.scheduled === today;
          const bToday = b.scheduled === today;
          if (aToday !== bToday) return aToday ? -1 : 1;
          return (b.scheduled ?? "").localeCompare(a.scheduled ?? "");
        }),
    [tasks, today],
  );

  const filtered = query.trim()
    ? open_.filter((t) => t.title.toLowerCase().includes(query.trim().toLowerCase()))
    : open_;

  const showClear = clearable && !!value;
  // Flat option list for arrow-key nav: the optional "No task" clear entry
  // first, then the filtered tasks.
  const optionCount = filtered.length + (showClear ? 1 : 0);

  const close = useCallback(() => setOpen(false), []);
  const select = useCallback(
    (index: number) => {
      if (showClear && index === 0) {
        onChange("");
        setOpen(false);
        setQuery("");
        return;
      }
      const task = filtered[showClear ? index - 1 : index];
      // Keyboard Enter must agree with the pointer path: the current task's
      // option is `disabled` and doesn't respond to a click.
      if (!task || task.id === value) return;
      onChange(task.id);
      setOpen(false);
      setQuery("");
    },
    [showClear, filtered, onChange, value],
  );

  const { triggerRef, menuRef, position, activeIndex, setActiveIndex, menuId } = usePickerMenu({
    open,
    onClose: close,
    optionCount,
    onSelect: select,
    minWidth: MIN_WIDTH,
  });

  const activeOptionId = activeIndex >= 0 ? `${menuId}-option-${activeIndex}` : undefined;

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        // No aria-controls/aria-activedescendant here: while open, the search
        // input below is the live combobox (it owns the text cursor and is
        // what aria-activedescendant should be read relative to) — wiring
        // both it and this button would announce two "Task" comboboxes
        // controlling the same listbox at once.
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 truncate transition-colors ${
          size === "lg"
            ? "h-12 w-full max-w-none rounded-row bg-sunk px-4 text-body text-ink inset-ring-1 inset-ring-line-strong"
            : "h-9 max-w-64 rounded-full px-3.5 text-secondary text-ink-2 inset-ring-1 inset-ring-line-2 hover:bg-sunk"
        }`}
      >
        {selected ? (
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            {selected.projectId && projectById.get(selected.projectId) && (
              <span
                aria-hidden
                className="size-1.5 shrink-0 rounded-full"
                style={{ background: projectColorVar(projectById.get(selected.projectId)!.color) }}
              />
            )}
            <span className="truncate">{selected.title}</span>
          </span>
        ) : (
          <span className="text-ink-3">{placeholder}</span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            data-picker-menu
            className="no-drag fixed z-50 rounded-row bg-surface p-1 shadow-md ring-1 ring-line"
            style={{
              left: position?.left ?? -9999,
              width: position?.width ?? MIN_WIDTH,
              visibility: position ? "visible" : "hidden",
              ...(position?.placement === "above" ? { bottom: position.bottom } : { top: position?.top ?? 0 }),
            }}
          >
            <div className="composer-frame mb-1 flex h-9 items-center rounded-tab bg-sunk px-3">
            <input
              autoFocus
              role="combobox"
              aria-label={label}
              aria-expanded={open}
              aria-controls={menuId}
              aria-activedescendant={activeOptionId}
              aria-autocomplete="list"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks…"
              className="w-full min-w-0 border-0 bg-transparent p-0 text-secondary text-ink placeholder:text-ink-3"
            />
            </div>
            <div id={menuId} role="listbox" aria-label={label} className="max-h-64 overflow-y-auto">
              {showClear && (
                <button
                  type="button"
                  id={`${menuId}-option-0`}
                  role="option"
                  tabIndex={-1}
                  aria-selected={false}
                  onMouseEnter={() => setActiveIndex(0)}
                  onClick={() => select(0)}
                  className={`flex h-9 w-full items-center rounded-tab px-3 text-left text-secondary text-ink-2 hover:bg-sunk hover:text-ink ${
                    activeIndex === 0 ? "bg-sunk text-ink" : ""
                  }`}
                >
                  No task
                </button>
              )}
              {filtered.length === 0 && (
                <p className="flex h-9 items-center px-3 text-secondary text-ink-3">No open tasks match.</p>
              )}
              {filtered.map((task, i) => {
                const index = showClear ? i + 1 : i;
                const project = task.projectId ? projectById.get(task.projectId) : undefined;
                const isCurrent = task.id === value;
                return (
                  <button
                    key={task.id}
                    id={`${menuId}-option-${index}`}
                    type="button"
                    role="option"
                    tabIndex={-1}
                    aria-selected={isCurrent}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => select(index)}
                    disabled={isCurrent}
                    className={`flex h-9 w-full items-center gap-2 rounded-tab px-3 text-left text-secondary text-ink hover:bg-sunk disabled:opacity-40 ${
                      index === activeIndex ? "bg-sunk" : ""
                    }`}
                  >
                    {project && (
                      <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: projectColorVar(project.color) }} />
                    )}
                    <span className="min-w-0 flex-1 truncate">{task.title}</span>
                    {task.scheduled === today && (
                      <span className="shrink-0 text-meta text-ink-3">Today</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
