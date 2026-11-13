"use client";

import { useRef, useState } from "react";
import BrainDumpPreview from "@/components/BrainDumpPreview";
import Button from "@/components/ui/Button";
import { parseQuickAdd } from "@/lib/parse";
import { useTasks } from "@/lib/store-context";
import { withSettingsDefaults } from "@/lib/store-context/use-tracking-config";

/** Lines per request. Must not exceed MAX_ITEMS in app/api/tasks/batch/route.ts. Each chunk is its own undo entry. */
export const BRAIN_DUMP_BATCH = 100;

function toLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * Brain dump body (soft.html .dump and .dump-f): a sunk text block and a footer with the live
 * found-count and the primary button. One task per line, the same preview and single undo as
 * the paste flow. With labelledBy the caller's CardHeader is the heading: no label and no context copy.
 */
export default function BrainDump({
  labelledBy,
}: { labelledBy?: string } = {}): React.ReactElement {
  const { addTasks, projects, settings } = useTasks();
  const dateOrder = withSettingsDefaults(settings).dateOrder;
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<string[] | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const busyRef = useRef(false);

  const lines = toLines(text);
  const count = lines.length;
  const withProject = lines.filter((l) => {
    const name = parseQuickAdd(l, new Date(), { dateOrder }).projectName?.toLowerCase();
    return name !== undefined && projects.some((pr) => pr.name.toLowerCase() === name);
  }).length;
  const found =
    count === 0
      ? "Nothing yet"
      : `${count} ${count === 1 ? "task" : "tasks"} found${withProject > 0 ? `, ${withProject} with a project` : ""}`;
  const buttonLabel = count === 0 ? "Add tasks" : count === 1 ? "Add task" : `Add ${count} tasks`;

  async function add() {
    const lines = preview;
    if (!lines || busyRef.current) return;
    busyRef.current = true;
    let sent = 0;
    try {
      for (let i = 0; i < lines.length; i += BRAIN_DUMP_BATCH) {
        const chunk = lines.slice(i, i + BRAIN_DUMP_BATCH);
        await addTasks(chunk, { defaultScheduled: null });
        sent += chunk.length;
      }
      setText("");
      setPreview(null);
    } catch {
      // addTasks already reports the error. Keep only the lines that were not sent,
      // so nothing is lost and nothing is added twice on a retry.
      if (sent > 0) {
        setText(lines.slice(sent).join("\n"));
        setPreview(null);
      }
    } finally {
      busyRef.current = false;
    }
  }

  function cancel() {
    setPreview(null);
    areaRef.current?.focus();
  }

  return (
    <div>
      {labelledBy ? null : (
        <label
          id="brain-dump-label"
          htmlFor="brain-dump-input"
          className="mb-3 block px-4 text-title font-medium text-ink"
        >
          Brain dump
        </label>
      )}
      <div className="composer-frame mx-4 rounded-row bg-sunk">
        <textarea
          id="brain-dump-input"
          ref={areaRef}
          aria-labelledby={labelledBy ?? "brain-dump-label"}
          rows={5}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (preview) setPreview(null);
          }}
          placeholder="Call printer 20m tomorrow"
          className="block min-h-35 w-full resize-none rounded-row bg-transparent px-3.5 py-3 text-body leading-relaxed text-ink placeholder:text-ink-3"
        />
      </div>
      {preview ? (
        <div className="px-4 pb-4">
          <BrainDumpPreview lines={preview} onAdd={() => void add()} onCancel={cancel} />
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 px-4 pb-4 pt-3 text-meta text-ink-3">
          <span aria-live="polite">{found}</span>
          <Button variant="primary" disabled={count === 0} onClick={() => setPreview(lines)}>
            {buttonLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
