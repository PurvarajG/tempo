"use client";

import { useCallback, useMemo, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import ShortcutSheet from "@/components/ShortcutSheet";
import { useTheme, type Theme } from "@/components/ThemeToggle";
import Icon, { type IconName } from "@/components/ui/Icon";
import { usePickerMenu } from "@/lib/usePickerMenu";

const MIN_WIDTH = 200;
const THEME_ORDER: Theme[] = ["system", "light", "dark"];
const THEME_LABEL: Record<Theme, string> = { system: "Auto", light: "Light", dark: "Dark" };

interface Item {
  id: string;
  label: string;
  icon: IconName;
  onSelect: () => void;
}

/**
 * Sidebar foot profile row (soft.html .me) and the menu it opens.
 * The menu is Menu.tsx's portalled panel on usePickerMenu; it opens above
 * the row because the row sits at the window bottom.
 */
export default function ProfileMenu() {
  const router = useRouter();
  const [theme, setTheme] = useTheme();
  const [open, setOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  const items: Item[] = useMemo(
    () => [
      { id: "settings", label: "Settings", icon: "list", onSelect: () => router.push("/settings") },
      { id: "tracking", label: "Tracking settings", icon: "chart", onSelect: () => router.push("/tracking/settings") },
      { id: "sync", label: "Sync and calendars", icon: "cal", onSelect: () => router.push("/settings#calendar") },
      {
        id: "theme",
        label: `Theme: ${THEME_LABEL[theme]}`,
        icon: "sun",
        onSelect: () => setTheme(THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length]),
      },
      { id: "shortcuts", label: "Shortcuts", icon: "today", onSelect: () => setShortcutsOpen(true) },
    ],
    [router, theme, setTheme],
  );

  const select = useCallback(
    (index: number) => {
      const item = items[index];
      if (!item) return;
      setOpen(false);
      item.onSelect();
    },
    [items],
  );

  const { triggerRef, menuRef, position, activeIndex, setActiveIndex, menuId } = usePickerMenu({
    open,
    onClose: close,
    optionCount: items.length,
    onSelect: select,
    minWidth: MIN_WIDTH,
  });

  const activeId = open && activeIndex >= 0 ? `${menuId}-item-${activeIndex}` : undefined;

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setOpen(true);
    }
  };

  return (
    <>
      {/* aria-activedescendant on the trigger is the hook's announce model; the lint rule does not know the menu button pattern. */}
      {/* eslint-disable-next-line jsx-a11y/role-supports-aria-props */}
      <button
        ref={triggerRef}
        type="button"
        data-part="me"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-activedescendant={activeId}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
        className="no-drag flex w-full items-center gap-3 rounded-me p-2 text-left hover:bg-sunk"
      >
        <span
          data-part="avatar"
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-full bg-linear-140 from-avatar-from to-avatar-to text-meta font-semibold text-avatar-ink"
        >
          Y
        </span>
        <span className="min-w-0">
          <b className="block text-secondary font-medium text-ink">You</b>
          <span className="text-meta text-ink-3">Settings &amp; sync</span>
        </span>
        <Icon name="updown" size={16} className="ml-auto shrink-0 text-ink-3" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            data-picker-menu
            id={menuId}
            role="menu"
            aria-label="Profile"
            className="no-drag fixed z-50 max-h-80 overflow-y-auto rounded-row bg-surface p-1 shadow-md ring-1 ring-line"
            style={{
              left: position?.left ?? -9999,
              minWidth: MIN_WIDTH,
              visibility: position ? "visible" : "hidden",
              ...(position?.placement === "above" ? { bottom: position.bottom } : { top: position?.top ?? 0 }),
            }}
          >
            {items.map((item, index) => (
              <button
                key={item.id}
                id={`${menuId}-item-${index}`}
                type="button"
                role="menuitem"
                tabIndex={-1}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => select(index)}
                className={`flex h-9 w-full items-center gap-2 rounded-tab px-3 text-left text-secondary text-ink hover:bg-sunk ${
                  index === activeIndex ? "bg-sunk" : ""
                }`}
              >
                <Icon name={item.icon} size={16} className="shrink-0 text-ink-3" />
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}

      <ShortcutSheet open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  );
}
