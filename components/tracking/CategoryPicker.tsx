"use client";

import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { usePickerMenu } from "@/lib/usePickerMenu";
import type { Category } from "@/lib/types";
import CategoryDot from "./CategoryDot";

const MIN_WIDTH = 192;

/** A dot + name button that opens a list of every non-archived category. */
export default function CategoryPicker({
  categories,
  value,
  onChange,
  label = "Category",
}: {
  categories: Category[];
  value: string | undefined;
  onChange: (categoryId: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = categories.find((c) => c.id === value);
  const options = categories.filter((c) => !c.archived || c.id === value);

  const close = useCallback(() => setOpen(false), []);
  const select = useCallback(
    (index: number) => {
      const category = options[index];
      // Keyboard Enter must agree with the pointer path: the current
      // category's option is `disabled` and doesn't respond to a click, so
      // Enter on it is a no-op too rather than silently re-firing onChange.
      if (!category || category.id === value) return;
      onChange(category.id);
      setOpen(false);
    },
    [options, onChange, value],
  );

  const { triggerRef, menuRef, position, activeIndex, setActiveIndex, menuId } = usePickerMenu({
    open,
    onClose: close,
    optionCount: options.length,
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
        aria-controls={open ? menuId : undefined}
        aria-activedescendant={open ? activeOptionId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-2 rounded-full px-3.5 text-secondary text-ink-2 inset-ring-1 inset-ring-line-2 transition-colors hover:bg-sunk"
      >
        {selected ? <CategoryDot color={selected.color} /> : <span className="size-2 shrink-0 rounded-full bg-sunk" />}
        <span className={selected ? "" : "text-ink-3"}>{selected?.name ?? "Pick a category"}</span>
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            data-picker-menu
            id={menuId}
            role="listbox"
            aria-label={label}
            className="no-drag fixed z-50 max-h-64 overflow-y-auto rounded-row bg-surface p-1 shadow-md ring-1 ring-line"
            style={{
              left: position?.left ?? -9999,
              width: position?.width ?? MIN_WIDTH,
              visibility: position ? "visible" : "hidden",
              ...(position?.placement === "above" ? { bottom: position.bottom } : { top: position?.top ?? 0 }),
            }}
          >
            {options.map((category, index) => {
              const isCurrent = category.id === value;
              return (
                <button
                  key={category.id}
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
                  <CategoryDot color={category.color} />
                  <span className="truncate">{category.name}</span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
