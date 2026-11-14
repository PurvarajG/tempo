"use client";

import { useEffect, useRef } from "react";
import Caption from "./Caption";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * True when `node` is the last aria-modal layer in document order. Dialog is
 * portaled to body after the panel, so an open Dialog sits later in the DOM and
 * owns Escape and Tab while it is open.
 */
export function isTopLayer(node: HTMLElement | null): boolean {
  if (!node) return false;
  const layers = document.querySelectorAll<HTMLElement>('[aria-modal="true"]');
  return layers.length > 0 && layers[layers.length - 1] === node;
}

/**
 * A right-side panel on desktop, a full-height sheet below `sm`. Both are the
 * same dialog: focus moves in on open, Tab is trapped inside, Escape closes,
 * and focus returns to whatever opened it — so keyboard users never end up
 * tabbing through the page behind an open panel.
 */
export default function SidePanel({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;
    const node = panel.current;
    node?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (!isTopLayer(node)) return;
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !node) return;

      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      restoreTo.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-scrim motion-safe:transition-opacity"
        onClick={onClose}
        aria-hidden
      >
        {/* AppChrome's h-9 drag strip has nothing subtracting it here
            otherwise: without this spacer, clicking/double-clicking the
            top 36px of the scrim would drag/zoom the window instead of
            dismissing the panel. The click still bubbles to the parent's
            onClick, so dismissal keeps working across the whole scrim. */}
        <div className="no-drag h-9" />
      </div>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        // Below the `sm` (640px) breakpoint this panel is `w-full`, i.e. a
        // full-viewport `.no-drag` surface — the same "entire window
        // undraggable" shape as the scrim bug above, just permanent while
        // open instead of confined to a spacer. That's safe only because
        // the window has a 900px `minWidth` floor (electron/main.js) that
        // keeps `sm` always satisfied and there is no page-zoom path that
        // could shrink the effective viewport. If `minWidth` ever drops
        // below 640px, or page zoom is added, this needs the same h-9
        // spacer treatment as the scrim.
        className="no-drag absolute inset-y-0 right-0 flex w-full flex-col bg-surface shadow-md ring-1 ring-line sm:max-w-md"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <Caption as="h2">{title}</Caption>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="grid size-9 shrink-0 place-items-center rounded-full text-ink-2 ring-1 ring-line transition-colors duration-150 ease-out hover:bg-sunk hover:text-ink"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer && <div className="border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
