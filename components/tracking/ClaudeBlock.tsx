import type { CSSProperties } from "react";
import Icon from "../ui/Icon";

/**
 * A suggested block from a Claude Code session (soft.html `.blk.free`): no
 * fill, a 1px inset hairline in line-2, tile radius, label in ink-2 and the
 * time range in mono ink-3 on the right (`.blk span`). Solid, never dashed:
 * dashed is reserved for gaps. Hover takes the `.blk.now` form (accent-soft
 * with a 2px accent left edge) so it reads as "click to make this real".
 * Nothing is written until the click. Positioning is the caller's.
 */
export default function ClaudeBlock({
  label,
  timeLabel,
  onAccept,
  disabled = false,
  short = false,
  style,
  className = "",
}: {
  label: string;
  /** `14:00 to 14:45`. */
  timeLabel: string;
  onAccept: () => void;
  disabled?: boolean;
  /** A block too low for the full padding. */
  short?: boolean;
  style?: CSSProperties;
  className?: string;
}) {
  const name = `Accept suggested block: ${label}, ${timeLabel}`;
  return (
    <button
      type="button"
      onClick={onAccept}
      disabled={disabled}
      aria-label={name}
      title={name}
      className={`group flex items-center justify-between gap-2 overflow-hidden rounded-tile text-left text-meta text-ink-2 inset-ring-1 inset-ring-line-2 transition-colors hover:bg-accent-soft hover:shadow-now-edge disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:shadow-none ${short ? "px-2" : "px-3 py-2"} ${className}`}
      style={style}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon name="plus" size={12} className="text-accent" />
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 font-mono text-ink-3 group-hover:text-accent">{timeLabel}</span>
    </button>
  );
}
