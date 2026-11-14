import type { CSSProperties } from "react";
import { categoryColorVar } from "./colors";

/**
 * A tracked segment on the day ribbon, in the calendar's block language
 * (`.cal-ev` in globals.css): a category-tinted fill on the surface, tile
 * radius, a 2px left edge in the category colour, title 12px weight 500 in
 * ink, and an optional project dot ahead of it. Positioning (top/height) is
 * the caller's.
 */
export default function TimeBlock({
  color,
  label,
  short = false,
  faded = false,
  /** A task's project colour, rendered as a small dot ahead of the label. */
  projectColor,
  onClick,
  style,
  className = "",
}: {
  color: string;
  label: string;
  /** A block too low for the full padding, like `.cal-ev.is-short`. */
  short?: boolean;
  /** Completed/inactive states dim without changing the palette. */
  faded?: boolean;
  projectColor?: string;
  onClick?: () => void;
  style?: CSSProperties;
  className?: string;
}) {
  const Tag = onClick ? "button" : "div";
  const cls = ["cal-ev", short ? "is-short" : "", faded ? "is-done" : "", className].filter(Boolean).join(" ");

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      title={label}
      className={cls}
      style={{ ...style, ["--c" as string]: categoryColorVar(color) }}
    >
      <span className="cal-ev-title">
        {projectColor && (
          <span
            aria-hidden
            data-testid="project-dot"
            className="mr-1.5 inline-block size-1.5 rounded-full align-middle"
            style={{ background: projectColor }}
          />
        )}
        {label}
      </span>
    </Tag>
  );
}
