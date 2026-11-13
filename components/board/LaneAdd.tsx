"use client";

import { useState } from "react";
import { useTasks } from "@/lib/store-context";
import Icon from "@/components/ui/Icon";

export function LaneAddButton({ lane, onClick }: { lane: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Add task to ${lane}`}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-tile text-ink-3 hover:bg-surface"
    >
      <Icon name="plus" />
    </button>
  );
}

export function LaneAddInput({
  lane,
  scheduled,
  onClose,
}: {
  lane: string;
  scheduled: string;
  onClose: () => void;
}) {
  const { addTask } = useTasks();
  const [draft, setDraft] = useState("");

  return (
    <li className="list-none">
      <input
        autoFocus
        value={draft}
        aria-label={`New task for ${lane}`}
        placeholder="What needs doing?"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setDraft("");
          onClose();
        }}
        onKeyDown={async (e) => {
          if (e.key === "Escape") (e.target as HTMLInputElement).blur();
          if (e.key !== "Enter" || !draft.trim()) return;
          const text = draft;
          setDraft("");
          await addTask(text, { scheduled }).catch(() => {});
        }}
        className="h-10 w-full rounded-tab bg-surface px-3 text-body ring-1 ring-line placeholder:text-ink-3"
      />
    </li>
  );
}
