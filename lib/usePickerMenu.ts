"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

export interface PickerMenuPosition {
  left: number;
  width: number;
  placement: "above" | "below";
  /** Set when `placement === "below"`. */
  top?: number;
  /** Set when `placement === "above"`. */
  bottom?: number;
}

const VIEWPORT_MARGIN = 8;
const MENU_OFFSET = 4;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * Shared behavior for the portal-rendered CategoryPicker/TaskPicker menus:
 * fixed-position placement against the trigger's bounding rect, measured
 * against the menu's OWN rendered size (not a guessed constant) so a short
 * list never wrongly flips above and a tall one is never wrongly kept below
 * and clipped by the viewport. Repositions on scroll/resize and whenever
 * `optionCount` changes the menu's natural height (e.g. a search filter
 * narrowing the list). Clamps the menu inside the viewport on both axes, and
 * closes rather than leaving a stale menu floating if the trigger scrolls
 * out of view entirely.
 *
 * Also owns outside-pointerdown + Escape dismissal and arrow-key navigation
 * over a flat list of `optionCount` options. The Escape/Arrow/Enter handler
 * is registered on `window` in the CAPTURE phase — ahead of SidePanel's own
 * document-level capture handler (components/ui/SidePanel.tsx), since
 * `window` precedes `document` in the event path — and stops propagation on
 * every key it handles, so a picker opened inside a SidePanel (e.g.
 * ProjectSettings' Timer category picker) only dismisses itself instead of
 * also closing the panel underneath it.
 *
 * The portalled options are intentionally NOT in the Tab order (`tabIndex=
 * -1`): they live on `document.body`, outside a SidePanel's focus-trap scan
 * (which only queries within the panel element), so Tab can't reliably reach
 * them anyway. Keyboard users operate the list with arrow keys + Enter
 * instead, announced via `aria-activedescendant` on the trigger/input — the
 * standard ARIA combobox pattern, and the one place callers should read
 * `menuId` from this hook to wire `aria-controls`/option ids.
 *
 * Extracted once so neither picker hand-rolls its own dismissal/positioning
 * logic — see plan section 5 (tracking picker clipping).
 */
export function usePickerMenu({
  open,
  onClose,
  optionCount,
  onSelect,
  minWidth = 0,
}: {
  open: boolean;
  onClose: () => void;
  optionCount: number;
  onSelect: (index: number) => void;
  /** Floor for the menu's width, e.g. a trigger's own minimum footprint. */
  minWidth?: number;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<PickerMenuPosition | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const menuId = useId();

  // Reset on open/close during render (React's "adjust state when a prop
  // changes" pattern) instead of in an effect: a closed menu has no position,
  // and a freshly opened one starts with nothing highlighted. While open, a
  // shrinking list clamps the stored highlight so it never points past the
  // end (which would silently swallow Enter).
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    setPosition(null);
    setActiveIndex(-1);
  } else if (open) {
    const clamped = optionCount === 0 ? -1 : Math.min(activeIndex, optionCount - 1);
    if (clamped !== activeIndex) setActiveIndex(clamped);
  }

  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });
  // Set by the outside-pointerdown handler below whenever the pointerdown
  // landed inside the trigger/menu, and consumed (reset to false) by the
  // very next focusout — see the focusout handler's comment for why this is
  // what reconciles the two dismissal paths.
  const lastPointerDownInsideRef = useRef(false);
  const focusOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reposition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();

    // The trigger has scrolled entirely out of the viewport — there is
    // nothing sane left to anchor against. Close rather than leave a stale
    // (or fully off-screen but still-open, still key-eating) menu behind.
    if (rect.bottom <= 0 || rect.top >= window.innerHeight || rect.right <= 0 || rect.left >= window.innerWidth) {
      onCloseRef.current();
      return;
    }

    // Measure the menu's own rendered box — it's already mounted (with a
    // fallback position) by the time this runs, so this reflects its real
    // content height/width rather than a guessed constant.
    const menuRect = menuRef.current?.getBoundingClientRect();
    const measuredHeight = menuRect?.height ?? 0;
    const measuredWidth = menuRect?.width ?? minWidth;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const placement: "above" | "below" =
      spaceBelow < measuredHeight && spaceAbove > spaceBelow ? "above" : "below";

    const width = Math.max(rect.width, minWidth, measuredWidth);
    const left = clamp(rect.left, VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN);

    if (placement === "below") {
      const top = clamp(
        rect.bottom + MENU_OFFSET,
        VIEWPORT_MARGIN,
        Math.max(VIEWPORT_MARGIN, window.innerHeight - VIEWPORT_MARGIN),
      );
      setPosition({ left, width, placement, top });
    } else {
      const bottom = clamp(
        window.innerHeight - rect.top + MENU_OFFSET,
        VIEWPORT_MARGIN,
        Math.max(VIEWPORT_MARGIN, window.innerHeight - VIEWPORT_MARGIN),
      );
      setPosition({ left, width, placement, bottom });
    }
  }, [minWidth]);

  // Re-measure whenever the option count changes the menu's natural
  // height/width (e.g. TaskPicker's search filter narrowing the list) —
  // (activeIndex is reset only on open/close, in render above, not on every
  // keystroke that changes the filtered count.)
  useLayoutEffect(() => {
    if (!open) return;
    reposition();
  }, [open, optionCount, reposition]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      const inside = !!(triggerRef.current?.contains(target) || menuRef.current?.contains(target));
      lastPointerDownInsideRef.current = inside;
      if (inside) return;
      onClose();
    };
    const handleReposition = () => reposition();
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [open, onClose, reposition]);

  // Close whenever focus leaves both the trigger and the menu — this is what
  // makes Tab behave sanely for TaskPicker's search input: its options are
  // tabIndex={-1} and the portal is the last node in the document, so Tab
  // from the input has nowhere to land inside the menu and would otherwise
  // leave it open (and still eating Escape/Arrow/Enter at window capture)
  // with focus already gone elsewhere.
  //
  // `relatedTarget` is trusted when the browser populates it (real Tab
  // navigation to a known element) — checked synchronously against the same
  // trigger/menu `contains()` used by the outside-pointerdown handler above,
  // so the two dismissal paths agree on what counts as "inside". When
  // `relatedTarget` is absent or `<body>` — which is what a plain mousedown
  // on non-focusable interior content (the menu's padding, an empty-state
  // message) produces in Chromium, since the browser blurs-to-body before
  // our own pointerdown handler's `contains()` exemption ever runs — treat
  // that as "focus went nowhere", not "focus went outside": defer one tick
  // and only close if this blur wasn't immediately caused by an interior
  // pointerdown (`lastPointerDownInsideRef`, captured synchronously here
  // before the deferred check runs) AND focus didn't in fact land back
  // inside by the time we check.
  //
  // Window/app-blur behavior is engine-dependent here too: Chromium (the
  // Electron target this app ships on) preserves `document.activeElement`
  // across an app switch, so an open menu with an in-progress query
  // correctly survives losing OS focus. An engine that resets
  // `document.activeElement` to `<body>` on blur (some jsdom/test
  // configurations do) would close the menu in that situation instead —
  // deliberately not special-cased, since it isn't reachable on the shipped
  // target.
  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    const handleFocusOut = (event: FocusEvent) => {
      const causedByInteriorPointerDown = lastPointerDownInsideRef.current;
      lastPointerDownInsideRef.current = false;

      const related = event.relatedTarget as Node | null;
      if (related && related !== document.body) {
        if (triggerRef.current?.contains(related) || menuRef.current?.contains(related)) return;
        onCloseRef.current();
        return;
      }

      if (focusOutTimerRef.current !== null) clearTimeout(focusOutTimerRef.current);
      focusOutTimerRef.current = setTimeout(() => {
        focusOutTimerRef.current = null;
        if (causedByInteriorPointerDown) return;
        const active = document.activeElement;
        if (active && active !== document.body && (triggerRef.current?.contains(active) || menuRef.current?.contains(active))) {
          return;
        }
        onCloseRef.current();
      }, 0);
    };
    trigger?.addEventListener("focusout", handleFocusOut);
    menu?.addEventListener("focusout", handleFocusOut);
    return () => {
      trigger?.removeEventListener("focusout", handleFocusOut);
      menu?.removeEventListener("focusout", handleFocusOut);
      if (focusOutTimerRef.current !== null) {
        clearTimeout(focusOutTimerRef.current);
        focusOutTimerRef.current = null;
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // ArrowUp/ArrowDown are preventDefaulted here even while focus is in
    // TaskPicker's search input, which swallows vertical caret motion in
    // that field. Deliberate: a single-line `<input>` has no meaningful
    // vertical caret movement to preserve, and list navigation is the whole
    // point of the arrow keys once the menu is open — silently letting them
    // fall through would leave no keyboard way to reach an option without a
    // mouse. Left/Right/Home/End caret movement inside the input is
    // untouched, since only these four keys are handled below.
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex((i) => (optionCount === 0 ? -1 : (i + 1) % optionCount));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex((i) => (optionCount === 0 ? -1 : (i - 1 + optionCount) % optionCount));
      } else if (e.key === "Enter") {
        if (activeIndex >= 0 && activeIndex < optionCount) {
          e.preventDefault();
          e.stopPropagation();
          onSelect(activeIndex);
        }
      }
    };
    // Capture phase, on `window` rather than `document` — see the doc
    // comment above for why this has to win over SidePanel's own handler.
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [open, optionCount, activeIndex, onSelect]);

  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current && !open) {
      triggerRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  return { triggerRef, menuRef, position, activeIndex, setActiveIndex, menuId };
}
