import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import MetaLabel from "../tracking/MetaLabel";

const pad = (h: number) => String(h).padStart(2, "0");

/**
 * Shared hour-ruled geometry. Originally lived only in the tracking ribbon
 * (RibbonModule); extracted here so the calendar's week/day grids draw the
 * same rail, gridlines and now-line instead of a second implementation.
 */
export function hourGridBackground(windowHours: number): string {
  const gridlineStop = 100 / windowHours;
  return `repeating-linear-gradient(to bottom, transparent 0, transparent calc(${gridlineStop}% - 1px), color-mix(in srgb, var(--color-line) 55%, transparent) calc(${gridlineStop}% - 1px), color-mix(in srgb, var(--color-line) 55%, transparent) ${gridlineStop}%)`;
}

/** A full 24h day, the window every calendar grid (as opposed to the
 * tracking ribbon, which can crop to waking hours) renders. */
export const DAY_WINDOW_HOURS = 24;

/** Pixel height of a full day at a given px-per-hour density. */
export function dayHeight(pxPerHour: number): number {
  return DAY_WINDOW_HOURS * pxPerHour;
}

/** Pixel offset of a local `HH:MM` time within a full-day column. */
export function timeToPx(hhmm: string, pxPerHour: number): number {
  const [h, m] = hhmm.split(":").map(Number);
  return ((h * 60 + m) / (DAY_WINDOW_HOURS * 60)) * dayHeight(pxPerHour);
}

/** Pixel offset of an ISO instant's local time-of-day within a full-day column. */
export function instantToPx(iso: string, pxPerHour: number): number {
  const d = new Date(iso);
  return ((d.getHours() * 60 + d.getMinutes()) / (DAY_WINDOW_HOURS * 60)) * dayHeight(pxPerHour);
}

/** Calendar grid density: px per hour (soft.html PX=56, `.hrs div{height:56px}`). */
export const CAL_PX_PER_HOUR = 56;

/**
 * Scrolls the element `ref` points at to `hour * pxPerHour`, once per distinct
 * `resetKey` (and once when `hour` first becomes non-null). Does nothing while
 * `hour` is null. Does not search ancestors.
 */
export function useScrollToHour(
  ref: RefObject<HTMLElement | null>,
  hour: number | null,
  pxPerHour: number,
  resetKey?: string,
): void {
  const done = useRef<{ key: string | undefined } | null>(null);
  useLayoutEffect(() => {
    if (hour === null) return;
    if (done.current && done.current.key === resetKey) return;
    const el = ref.current;
    if (!el) return;
    el.scrollTop = hour * pxPerHour;
    done.current = { key: resetKey };
  }, [ref, hour, pxPerHour, resetKey]);
}

/** The hour-label rail. One per grid, however many hour-boxes sit beside it. */
export function HourRail({
  windowStartHour,
  windowHours,
  height,
  className,
  variant = "default",
}: {
  windowStartHour: number;
  windowHours: number;
  height: number;
  className?: string;
  variant?: "default" | "calendar";
}) {
  const hours = Array.from({ length: windowHours }, (_, i) => (windowStartHour + i) % 24);
  if (variant === "calendar") {
    // soft.html `.hrs div`: plain mono 11px ink-3, right-aligned, 12px right
    // padding, pulled up 7px onto its hour line; the first label stays put.
    return (
      <div className={className}>
        {hours.map((hour, i) => (
          <div
            key={i}
            className={`pr-3 text-right font-mono text-caption text-ink-3 ${i === 0 ? "" : "-translate-y-1.75"}`}
            style={{ height: height / windowHours }}
          >
            {pad(hour)}:00
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={`relative ${className ?? "w-10 shrink-0 sm:w-12"}`}>
      {hours.map((hour, i) => (
        <div key={i} className="absolute -translate-y-1/2" style={{ top: (i / windowHours) * height }}>
          <MetaLabel>{pad(hour)}:00</MetaLabel>
        </div>
      ))}
    </div>
  );
}

/**
 * The bordered, hour-gridded box with an optional now-line. Content (segment
 * blocks, gap blocks, task/event chips) is absolutely-positioned by the
 * caller as children.
 */
export function HourGridBox({
  windowHours,
  height,
  nowOffset,
  children,
  className = "",
  "aria-label": ariaLabel,
}: {
  windowHours: number;
  height: number;
  /** Pixel offset of "now" within the box, or null when not applicable/visible. */
  nowOffset: number | null;
  children?: ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    // `isolate` gives every column its own stacking context, so a sticky
    // rail elsewhere on the page (WeekGrid's hour labels) always paints
    // above this column's content — including its own z-10 now-line —
    // instead of competing with it at the same stacking level.
    <div
      // `aria-label` on a plain, roleless <div> is invisible to assistive
      // tech, so give it a role whenever it's named — `group` reads as "one
      // labelled container of related content" without claiming to be a
      // richer widget it isn't.
      role={ariaLabel ? "group" : undefined}
      aria-label={ariaLabel}
      className={`relative isolate min-w-0 flex-1 rounded-lg border border-line bg-raised transition-colors ${className}`}
      style={{ height, backgroundImage: hourGridBackground(windowHours) }}
    >
      {children}
      {nowOffset !== null && nowOffset >= 0 && nowOffset <= height && (
        <div
          aria-label="Now"
          className="pointer-events-none absolute inset-x-0 z-10 h-px bg-accent"
          style={{ top: nowOffset }}
        >
          <span
            aria-hidden
            className="absolute -top-0.75 left-0 size-1.75 rounded-full bg-accent"
          />
        </div>
      )}
    </div>
  );
}

/** One rail beside one box — the common case (tracking ribbon, day view). */
export default function HourGrid({
  windowStartHour,
  windowHours,
  height,
  nowOffset,
  children,
  boxClassName,
}: {
  windowStartHour: number;
  windowHours: number;
  height: number;
  nowOffset: number | null;
  children?: ReactNode;
  boxClassName?: string;
}) {
  return (
    <div className="flex">
      <HourRail windowStartHour={windowStartHour} windowHours={windowHours} height={height} />
      <HourGridBox windowHours={windowHours} height={height} nowOffset={nowOffset} className={boxClassName}>
        {children}
      </HourGridBox>
    </div>
  );
}
