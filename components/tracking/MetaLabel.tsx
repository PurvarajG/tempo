/**
 * The mono idiom, so it stops being retyped: every label, hour, date and
 * count in the tracking dashboard speaks in this voice. Sans stays reserved
 * for user content (activity names, notes).
 */
export default function MetaLabel({
  as: Tag = "span",
  children,
  className = "",
}: {
  as?: "span" | "time" | "div";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tag className={`font-mono text-caption uppercase tracking-caption text-ink-3 ${className}`}>
      {children}
    </Tag>
  );
}
