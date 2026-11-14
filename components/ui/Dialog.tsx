"use client";

import { useEffect, useId, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** The caller's Buttons, rendered right-aligned. */
  actions?: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Default true. False ignores backdrop clicks; Escape still calls onClose. */
  dismissible?: boolean;
  role?: "dialog" | "alertdialog";
}

/**
 * A centred modal for confirmations and small forms. Escape is handled in the
 * document capture phase, Tab is trapped inside, focus moves in on open and
 * returns to the opener on close.
 */
export default function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  initialFocusRef,
  dismissible = true,
  role = "dialog",
}: DialogProps) {
  const surface = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const initialRef = useRef(initialFocusRef);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
    initialRef.current = initialFocusRef;
  });

  useEffect(() => {
    if (!open) return;

    const restoreTo = document.activeElement as HTMLElement | null;
    const node = surface.current;
    const target =
      initialRef.current?.current ?? node?.querySelector<HTMLElement>(FOCUSABLE) ?? node;
    target?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !node) return;

      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        event.preventDefault();
        node.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === node)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      restoreTo?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim"
      onClick={dismissible ? () => onCloseRef.current() : undefined}
    >
      {/* Keeps the window's 36px drag band dismissing like the rest of the backdrop. */}
      <div className="no-drag absolute inset-x-0 top-0 h-9 w-full" />
      <div
        ref={surface}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="no-drag relative flex w-full max-w-md flex-col gap-4 rounded-card bg-surface p-6 shadow-md ring-1 ring-line"
      >
        <h2 id={titleId} className="text-title font-medium text-ink">
          {title}
        </h2>
        {description && (
          <p id={descId} className="text-secondary text-ink-2">
            {description}
          </p>
        )}
        {children}
        {actions && <div className="flex justify-end gap-2">{actions}</div>}
      </div>
    </div>,
    document.body,
  );
}
