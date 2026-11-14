"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { selectClass } from "@/components/ui/Field";
import Icon from "@/components/ui/Icon";
import Input from "@/components/ui/Input";
import { useTasks } from "@/lib/store-context";

/**
 * The "New" chip beside the quick-start chips: a small popover that creates a
 * preset, pinned activity in one step so it appears as a chip immediately.
 */
export default function QuickAddActivity() {
  const { categories, addActivity } = useTasks();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [lastCategoryId, setLastCategoryId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeCategories = [...categories].filter((c) => !c.archived).sort((a, b) => a.sortOrder - b.sortOrder);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function openPopover() {
    const fallback = activeCategories.find((c) => c.kind !== "unclassified") ?? activeCategories[0];
    setCategoryId(lastCategoryId ?? fallback?.id ?? "");
    setName("");
    setOpen(true);
  }

  function submit() {
    const trimmed = name.trim();
    if (!trimmed || !categoryId) return;
    addActivity({ categoryId, name: trimmed, isPreset: true, pinned: true });
    setLastCategoryId(categoryId);
    setOpen(false);
    setName("");
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPopover())}
        aria-expanded={open}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-meta font-medium text-ink-3 transition-colors hover:bg-sunk hover:text-ink"
      >
        <Icon name="plus" size={13} />
        New
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-2 w-64 space-y-2 rounded-row bg-raised p-3 shadow-md ring-1 ring-line-2">
          <Input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder="Activity name"
            aria-label="New activity name"
          />
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            aria-label="Category"
            className={selectClass}
          >
            {activeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={submit} disabled={!name.trim()}>
              Add
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
