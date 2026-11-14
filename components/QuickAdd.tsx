"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ClipboardEvent, KeyboardEvent } from "react";
import Icon from "@/components/ui/Icon";
import BrainDumpPreview, { chipClass, parsedChips } from "@/components/BrainDumpPreview";
import type { Chip } from "@/components/BrainDumpPreview";
import { fmtDate } from "@/lib/format";
import { parseQuickAdd, toISODate } from "@/lib/parse";
import { useTasks } from "@/lib/store-context";
import { withSettingsDefaults } from "@/lib/store-context/use-tracking-config";

export default function QuickAdd({
  id,
  projectId,
  autoFocus = true,
  defaultScheduled,
  onSaved,
  onEscape,
  saveOnWindowBlur = false,
  dumpPreview = true,
  placeholder,
}: {
  id?: string;
  projectId?: string;
  autoFocus?: boolean;
  /** Placeholder text for the field. Undefined keeps the default. */
  placeholder?: string;
  /** Day for a task typed with no day token. Undefined means today, null means the inbox. */
  defaultScheduled?: string | null;
  /** Called after a task was added. `stay` is true for Shift+Enter. */
  onSaved?: (info: { stay: boolean }) => void;
  /** Called on Esc in the field, and on window blur with nothing typed. */
  onEscape?: () => void;
  /** When the window loses focus: save non-empty text, or call onEscape when empty. */
  saveOnWindowBlur?: boolean;
  /** False keeps a multi-line paste in the field instead of opening the brain dump preview. */
  dumpPreview?: boolean;
}) {
  const { addTask, addTasks, trashTask, offerUndo, dismissUndo, projects, settings } = useTasks();
  const dateOrder = withSettingsDefaults(settings).dateOrder;
  const [text, setText] = useState("");
  const [dropped, setDropped] = useState<string | null>(null);
  const [dump, setDump] = useState<string[] | null>(null);
  const busyRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const today = toISODate(new Date());
  const fallbackDay = defaultScheduled === undefined ? today : defaultScheduled;

  function chipsFor(raw: string): { chips: Chip[]; title: string; newProject: string | null } {
    const p = parseQuickAdd(raw, new Date(), { dateOrder });
    const { chips, unknownProject } = parsedChips(p, projects);
    const newProject = unknownProject && dropped !== unknownProject.toLowerCase() ? unknownProject : null;
    return { chips, title: p.title, newProject };
  }

  const live = useMemo(
    () => (text.trim() ? chipsFor(text) : { chips: [] as Chip[], title: "", newProject: null }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text, projects, dropped, dateOrder],
  );

  const blurRef = useRef<() => void>(() => {});
  useEffect(() => {
    blurRef.current = () => {
      if (text.trim()) void submit(false);
      else onEscape?.();
    };
  });
  useEffect(() => {
    if (!saveOnWindowBlur) return;
    const onBlur = () => blurRef.current();
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [saveOnWindowBlur]);

  function dropNewProject() {
    if (!live.newProject) return;
    setDropped(live.newProject.toLowerCase());
    inputRef.current?.focus();
  }

  async function submit(stay = false) {
    let raw = text.trim();
    if (!raw || busyRef.current) return;
    if (dropped) {
      const tag = `#${dropped}`;
      const words = raw.split(/\s+/);
      const at = words.findIndex((w) => w.toLowerCase() === tag);
      if (at >= 0) words.splice(at, 1);
      raw = words.join(" ");
      if (!raw) return;
    }
    const parsed = parseQuickAdd(raw, new Date(), { dateOrder });
    setText("");
    setDropped(null);
    busyRef.current = true;
    try {
      const created = await addTask(raw, {
        projectId,
        scheduled: parsed.scheduled === undefined ? fallbackDay : undefined,
      });
      if (created && created.scheduled !== today) {
        const where = created.scheduled ? fmtDate(created.scheduled, today) : "Inbox";
        offerUndo(`Added to ${where}`, async () => {
          await trashTask(created.id);
          dismissUndo();
        });
      }
      if (created) onSaved?.({ stay });
    } catch {
      setText(raw);
    } finally {
      busyRef.current = false;
      inputRef.current?.focus();
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void submit(e.shiftKey);
    } else if (e.key === "Escape" && onEscape) {
      e.preventDefault();
      onEscape();
    } else if (
      e.key === "Backspace" &&
      live.newProject &&
      e.currentTarget.selectionStart === 0 &&
      e.currentTarget.selectionEnd === 0
    ) {
      e.preventDefault();
      dropNewProject();
    }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const lines = e.clipboardData
      .getData("text")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2 || !dumpPreview) return;
    e.preventDefault();
    setDump(lines);
  }

  async function addDump() {
    const lines = dump;
    if (!lines || busyRef.current) return;
    busyRef.current = true;
    setDump(null);
    try {
      await addTasks(lines, { defaultScheduled: fallbackDay, projectId });
    } catch {
      setDump(lines);
    } finally {
      busyRef.current = false;
      inputRef.current?.focus();
    }
  }

  function cancelDump() {
    setDump(null);
    inputRef.current?.focus();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="composer-frame flex h-13 items-center gap-3 rounded-composer bg-surface pl-4 pr-2">
        <Icon name="plus" size={18} className="text-ink-3" />
        <input
          ref={inputRef}
          id={id}
          autoFocus={autoFocus}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder={placeholder ?? "Add a task. Try: Call printer 20m tomorrow #MSM26"}
          aria-label="New task"
          className="min-w-0 flex-1 bg-transparent text-body text-ink placeholder:text-ink-3"
        />
        {(live.chips.length > 0 || live.newProject) && (
          <span data-part="live-chips" className="flex min-w-0 shrink items-center justify-end gap-1 overflow-hidden whitespace-nowrap">
            {live.chips.map((c) => (
              <span key={c.key} className={chipClass()}>
                {c.text}
              </span>
            ))}
            {live.newProject && (
              <button
                type="button"
                aria-label="Remove new project name"
                title="Remove new project name"
                onClick={dropNewProject}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" || e.key === "Delete") {
                    e.preventDefault();
                    dropNewProject();
                  }
                }}
                className={`${chipClass("accent")} cursor-pointer`}
              >
                New project: {live.newProject}
              </button>
            )}
          </span>
        )}
        <span data-part="hint-chips" aria-hidden="true" className="flex shrink-0 items-center gap-1 whitespace-nowrap">
          {["20m", "p1", "#project"].map((hint) => (
            <span key={hint} className={chipClass()}>
              {hint}
            </span>
          ))}
        </span>
      </div>

      {dump && <BrainDumpPreview lines={dump} onAdd={() => void addDump()} onCancel={cancelDump} />}
    </form>
  );
}
