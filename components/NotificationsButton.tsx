"use client";

import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import { useTasks } from "@/lib/store-context";
import { fmtHours, fmtTime } from "@/lib/format";
import { remindersDue } from "@/lib/reminders";
import { toISODate } from "@/lib/parse";
import { usePickerMenu } from "@/lib/usePickerMenu";

const PANEL_WIDTH = 288;
const TRIGGER_SIZE = 36;
const SETTINGS_HREF = "/settings#desktop";

/**
 * Top-bar bell (soft.html .icon-btn: 36px circle, 1px line ring, ink-2, 16px
 * glyph, sunk on hover). Opens today's reminders and the nudge status.
 * Reads the store only; the popover uses the same panel look as ui/Menu.
 */
export default function NotificationsButton() {
  const { tasks, settings, openTask } = useTasks();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  const todayISO = toISODate(new Date());
  const reminders = useMemo(() => remindersDue(tasks, todayISO), [tasks, todayISO]);

  const nudgeMinutes = settings?.nudgeMinutes ?? null;
  const optionCount = reminders.length + 1;

  const select = useCallback(
    (index: number) => {
      setOpen(false);
      const task = reminders[index];
      if (task) openTask(task.id);
      else router.push(SETTINGS_HREF);
    },
    [reminders, openTask, router],
  );

  const { triggerRef, menuRef, position, activeIndex, setActiveIndex, menuId } = usePickerMenu({
    open,
    onClose: close,
    optionCount,
    onSelect: select,
    minWidth: PANEL_WIDTH,
  });

  const rowId = (i: number) => `${menuId}-row-${i}`;
  const activeId = open && activeIndex >= 0 ? rowId(activeIndex) : undefined;
  const rowClass = (i: number) =>
    `flex h-9 w-full items-center gap-3 rounded-tab px-3 text-left text-secondary text-ink hover:bg-sunk ${
      i === activeIndex ? "bg-sunk" : ""
    }`;

  return (
    <div className="no-drag">
      {/* aria-activedescendant on the trigger is the hook's announce model; the lint rule does not know it. */}
      {/* eslint-disable-next-line jsx-a11y/role-supports-aria-props */}
      <button
        ref={triggerRef}
        type="button"
        data-part="icon-btn"
        aria-label="Notifications"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-activedescendant={activeId}
        onClick={() => setOpen((v) => !v)}
        className="grid size-9 shrink-0 place-items-center rounded-full ring-1 ring-line text-ink-2 transition-colors duration-150 ease-out hover:bg-sunk hover:text-ink"
      >
        <Icon name="bell" size={16} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            data-picker-menu
            id={menuId}
            role="dialog"
            aria-label="Notifications"
            className="no-drag fixed z-50 max-h-96 overflow-y-auto rounded-row bg-surface p-1 shadow-md ring-1 ring-line"
            style={{
              left: (position?.left ?? -9999) + TRIGGER_SIZE,
              transform: "translateX(-100%)",
              width: PANEL_WIDTH,
              visibility: position ? "visible" : "hidden",
              ...(position?.placement === "above" ? { bottom: position.bottom } : { top: position?.top ?? 0 }),
            }}
          >
            <p className="px-3 pb-1 pt-2 text-meta text-ink-3">Reminders today</p>
            {reminders.length === 0 ? (
              <p className="px-3 pb-2 text-secondary text-ink-3">Nothing due today.</p>
            ) : (
              reminders.map((t, i) => (
                <button
                  key={t.id}
                  id={rowId(i)}
                  type="button"
                  tabIndex={-1}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => select(i)}
                  className={rowClass(i)}
                >
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  <span className="shrink-0 font-mono text-meta text-ink-3">{fmtTime(t.dueTime as string)}</span>
                </button>
              ))
            )}
            <div className="mx-3 my-1 border-t border-line" />
            <p className="px-3 pb-1 pt-2 text-meta text-ink-3">Nudges</p>
            <p className="px-3 pb-2 text-secondary text-ink-2">
              {nudgeMinutes ? `Nudge after ${fmtHours(nudgeMinutes)} without a timer.` : "Nudges are off."}
            </p>
            <button
              id={rowId(reminders.length)}
              type="button"
              tabIndex={-1}
              onMouseEnter={() => setActiveIndex(reminders.length)}
              onClick={() => select(reminders.length)}
              className={rowClass(reminders.length)}
            >
              <span className="min-w-0 flex-1 truncate">Reminder and nudge settings</span>
              <Icon name="chev" size={16} className="shrink-0 text-ink-3" />
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
