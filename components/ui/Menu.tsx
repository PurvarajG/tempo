"use client";

import { useCallback, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePickerMenu } from "@/lib/usePickerMenu";
import Icon, { type IconName } from "./Icon";

export interface MenuItem {
  id: string;
  label: string;
  icon?: IconName;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export interface MenuProps {
  /** Trigger content. */
  label: ReactNode;
  /** Accessible name for the trigger when `label` is not plain text. */
  ariaLabel?: string;
  items: MenuItem[];
  variant?: "chip" | "ghost" | "icon";
  disabled?: boolean;
  className?: string;
  minWidth?: number;
}

const DEFAULT_MIN_WIDTH = 180;

const TRIGGER_BASE =
  "inline-flex h-9 shrink-0 items-center gap-2 text-secondary hover:bg-sunk disabled:text-ink-3 disabled:hover:bg-transparent";
const TRIGGER_VARIANT = {
  chip: "rounded-full px-3.5 text-ink-2 inset-ring-1 inset-ring-line-2",
  ghost: "rounded-full px-3 text-ink-2",
} as const;
// Icon-only trigger (soft.html .lane-h .add): 28px square, radius 8, ink-3, surface on hover.
const TRIGGER_ICON =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-tile text-ink-3 hover:bg-surface hover:text-ink disabled:hover:bg-transparent disabled:hover:text-ink-3";

/**
 * Action menu: a trigger button plus a portalled list of actions, on top of
 * usePickerMenu (positioning, dismissal, arrow-key navigation).
 *
 * ARIA: role="menu" / "menuitem" with aria-haspopup="menu" on the trigger.
 * The hook keeps real focus on the trigger and announces the highlighted
 * option through aria-activedescendant, which is valid on a menu button
 * pattern too, and these are actions rather than a selected value, so menu
 * fits better than listbox/option (no aria-selected state exists here).
 * Items are tabIndex -1; keyboard users use arrows and Enter.
 *
 * Disabled items stay visible but are excluded from the hook's option list,
 * so arrow keys and Enter never land on them.
 */
export default function Menu({
  label,
  ariaLabel,
  items,
  variant = "chip",
  disabled = false,
  className = "",
  minWidth = DEFAULT_MIN_WIDTH,
}: MenuProps) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  const enabled = useMemo(() => items.filter((item) => !item.disabled), [items]);

  const select = useCallback(
    (index: number) => {
      const item = enabled[index];
      if (!item) return;
      setOpen(false);
      item.onSelect();
    },
    [enabled],
  );

  const { triggerRef, menuRef, position, activeIndex, setActiveIndex, menuId } = usePickerMenu({
    open,
    onClose: close,
    optionCount: enabled.length,
    onSelect: select,
    minWidth,
  });

  const activeId = open && activeIndex >= 0 ? `${menuId}-item-${activeIndex}` : undefined;

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!open && !disabled && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setOpen(true);
    }
  };

  // Position of each enabled item within `enabled` (disabled items get -1).
  const enabledIndex = items.map((item) => (item.disabled ? -1 : enabled.indexOf(item)));

  return (
    <div className={`relative inline-flex ${className}`}>
      {/* aria-activedescendant on the trigger is the hook's announce model; the lint rule does not know the menu button pattern. */}
      {/* eslint-disable-next-line jsx-a11y/role-supports-aria-props */}
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-activedescendant={activeId}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
        className={variant === "icon" ? TRIGGER_ICON : `${TRIGGER_BASE} ${TRIGGER_VARIANT[variant]}`}
      >
        {label}
        {variant === "icon" ? null : <Icon name="chev" size={16} className="rotate-90 text-ink-3" />}
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            data-picker-menu
            id={menuId}
            role="menu"
            aria-label={ariaLabel}
            className="no-drag fixed z-50 max-h-80 overflow-y-auto rounded-row bg-surface p-1 shadow-md ring-1 ring-line"
            style={{
              left: position?.left ?? -9999,
              minWidth,
              visibility: position ? "visible" : "hidden",
              ...(position?.placement === "above" ? { bottom: position.bottom } : { top: position?.top ?? 0 }),
            }}
          >
            {items.map((item, itemPos) => {
              const isDisabled = !!item.disabled;
              const index = enabledIndex[itemPos];
              const active = !isDisabled && index === activeIndex;
              const tone = isDisabled ? "text-ink-3" : item.danger ? "text-hi" : "text-ink";
              return (
                <button
                  key={item.id}
                  id={isDisabled ? undefined : `${menuId}-item-${index}`}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  aria-disabled={isDisabled || undefined}
                  onMouseEnter={isDisabled ? undefined : () => setActiveIndex(index)}
                  onClick={isDisabled ? undefined : () => select(index)}
                  className={`flex h-9 w-full items-center gap-2 rounded-tab px-3 text-left text-secondary ${tone} ${
                    active ? "bg-sunk" : ""
                  } ${isDisabled ? "cursor-default" : "hover:bg-sunk"}`}
                >
                  {item.icon ? <Icon name={item.icon} size={16} className="shrink-0 text-ink-3" /> : null}
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
