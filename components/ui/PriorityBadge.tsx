import type { Priority } from "@/lib/types";
import Icon from "./Icon";

export interface PriorityBadgeProps {
  priority: Priority;
  className?: string;
  /** Icon only. The word moves to aria-label and title, for dense rows. */
  compact?: boolean;
}

// High and Medium are tinted pills (.prio). Low is plain meta text: no pill.
const TONES: Record<Exclude<Priority, 0>, { word: string; tone: string }> = {
  1: { word: "High", tone: "rounded-full font-medium px-2 py-0.5 text-hi bg-hi-bg" },
  2: { word: "Medium", tone: "rounded-full font-medium px-2 py-0.5 text-med bg-med-bg" },
  3: { word: "Low", tone: "text-ink-3" },
};

export default function PriorityBadge({
  priority,
  className,
  compact = false,
}: PriorityBadgeProps) {
  if (priority === 0) return null;
  const { word, tone } = TONES[priority];
  const classes = [
    "inline-flex items-center gap-1 text-meta whitespace-nowrap",
    tone,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      data-part="prio"
      className={classes}
      {...(compact ? { role: "img", "aria-label": word, title: word } : {})}
    >
      <Icon name="flag" size={12} className="fill-current" />
      {compact ? null : word}
    </span>
  );
}
