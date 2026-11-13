import type { CSSProperties } from "react";

/**
 * An outlined free block (soft.html `.blk.free`): no fill, ink-3 text. The
 * hairline is dashed, the one dashed element in the tracking system, so
 * absence never reads as another category. Click fills it.
 */
export default function GapBlock({
  label,
  onClick,
  style,
  className = "",
}: {
  label: string;
  onClick?: () => void;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`flex items-center truncate rounded-tile border border-dashed border-line-2 px-2 text-left text-meta text-ink-3 transition-colors hover:bg-sunk ${className}`}
      style={style}
    >
      <span className="truncate">{label}</span>
    </button>
  );
}
