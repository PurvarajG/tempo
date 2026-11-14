"use client";

import CategoryDot from "./CategoryDot";

/**
 * The activity quick-start chip (soft.html `.pill`): hairline ring, rounded-full,
 * small ink-2 text. The running one is accent-soft with accent text. Shared by
 * `NowModule`'s quick-start row and `UnaccountedModule`'s per-gap fill row.
 */
export default function ActivityPill({
  color,
  name,
  active = false,
  onClick,
}: {
  color: string;
  name: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={active}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-2.5 py-1 text-meta font-medium transition-colors ${
        active
          ? "bg-accent-soft text-accent"
          : "text-ink-2 inset-ring inset-ring-line-2 hover:bg-sunk hover:text-ink"
      }`}
    >
      <CategoryDot color={color} />
      {name}
    </button>
  );
}
