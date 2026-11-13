"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useTasks } from "@/lib/store-context";
import { fmtDate } from "@/lib/format";
import { addDays, parseDateToken } from "@/lib/parse";
import { usePickerMenu } from "@/lib/usePickerMenu";
import type { Task } from "@/lib/types";
import Button from "./Button";
import Icon from "./Icon";
import IconButton from "./IconButton";

const LONG_PRESS_MS = 500;
const MENU_MIN_WIDTH = 180;
const TOOLTIP = "Not today. Right-click for more days";

interface Choice {
  id: string;
  label: string;
  day: string | null;
}

export default function PostponeButton({
  task,
  todayISO,
  onTomorrow,
  variant = "icon",
}: {
  task: Task;
  todayISO: string;
  onTomorrow?: () => void;
  variant?: "icon" | "ghost" | "pick";
}) {
  const { rescheduleTasks } = useTasks();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  const pick = variant === "pick";
  const undated = task.scheduled == null;

  const choices = useMemo<Choice[]>(() => {
    const days: Choice[] = [];
    if (pick) days.push({ id: "tomorrow", label: "Tomorrow", day: addDays(todayISO, 1) });
    for (let n = 2; n <= 7; n++) {
      const iso = addDays(todayISO, n);
      days.push({ id: iso, label: fmtDate(iso), day: iso });
    }
    days.push({ id: "next-week", label: "Next week", day: parseDateToken("nextweek", todayISO) ?? addDays(todayISO, 7) });
    if (!(pick && undated)) days.push({ id: "no-date", label: "No date", day: null });
    return days;
  }, [todayISO, pick, undated]);

  const select = useCallback(
    (index: number) => {
      const choice = choices[index];
      if (!choice) return;
      setOpen(false);
      void rescheduleTasks([task.id], choice.day);
    },
    [choices, rescheduleTasks, task.id],
  );

  const { triggerRef, menuRef, position, activeIndex, setActiveIndex, menuId } = usePickerMenu({
    open,
    onClose: close,
    optionCount: choices.length,
    onSelect: select,
    minWidth: MENU_MIN_WIDTH,
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressedRef = useRef(false);
  const cancelPress = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  useEffect(() => cancelPress, [cancelPress]);

  const onPointerDown = (e: { button: number }) => {
    if (e.button !== 0) return;
    longPressedRef.current = false;
    cancelPress();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      longPressedRef.current = true;
      setOpen(true);
    }, LONG_PRESS_MS);
  };

  const onClick = () => {
    if (longPressedRef.current) {
      longPressedRef.current = false;
      return;
    }
    if (pick) {
      setOpen((o) => !o);
      return;
    }
    setOpen(false);
    if (onTomorrow) onTomorrow();
    else void rescheduleTasks([task.id], addDays(todayISO, 1));
  };

  const onContextMenu = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    cancelPress();
    setOpen(true);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (open) return;
    if (e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey) || e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
    }
  };

  const activeId = open && activeIndex >= 0 ? `${menuId}-item-${activeIndex}` : undefined;

  const triggerProps = {
    ref: triggerRef,
    "aria-haspopup": "menu" as const,
    "aria-expanded": open,
    "aria-controls": open ? menuId : undefined,
    "aria-activedescendant": activeId,
    onClick,
    onContextMenu,
    onKeyDown,
    onPointerDown,
    onPointerUp: cancelPress,
    onPointerMove: cancelPress,
    onPointerLeave: cancelPress,
    onPointerCancel: cancelPress,
  };

  return (
    <>
      {pick ? (
        <Button variant="chip" size="md" {...triggerProps}>
          <Icon name="cal" size={14} />
          Pick a day
        </Button>
      ) : variant === "ghost" ? (
        <Button variant="ghost" title={TOOLTIP} {...triggerProps}>
          Not today
        </Button>
      ) : (
        <IconButton icon="clock" label="Not today" title={TOOLTIP} {...triggerProps} />
      )}

      {open &&
        createPortal(
          <div
            ref={menuRef}
            data-picker-menu
            id={menuId}
            role="menu"
            aria-label="Move to another day"
            className="no-drag fixed z-50 max-h-80 overflow-y-auto rounded-composer bg-surface p-1 shadow-md ring-1 ring-line"
            style={{
              left: position?.left ?? -9999,
              minWidth: MENU_MIN_WIDTH,
              visibility: position ? "visible" : "hidden",
              ...(position?.placement === "above" ? { bottom: position.bottom } : { top: position?.top ?? 0 }),
            }}
          >
            {choices.map((choice, index) => (
              <button
                key={choice.id}
                id={`${menuId}-item-${index}`}
                type="button"
                role="menuitem"
                tabIndex={-1}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => select(index)}
                className={`flex h-9 w-full items-center rounded-row px-3 text-left text-secondary text-ink hover:bg-sunk ${
                  index === activeIndex ? "bg-sunk" : ""
                }`}
              >
                <span className="truncate">{choice.label}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
