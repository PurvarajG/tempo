import Icon, { type IconName } from "@/components/ui/Icon";

export type LaneProps = {
  title: string;
  count: number;
  glyph: IconName | "live"; // "live" draws the green live dot like kanban Column
  headerRight?: React.ReactNode; // quiet right side of the header (optional)
  footer?: React.ReactNode; // drawn under the header, above the cards (e.g. DayCapacity)
  ariaLabel?: string; // default `${title}, ${count} task(s)`
  emptyText?: string; // default "Nothing here yet."
  children?: React.ReactNode; // BoardCard <li> items
};

/** A board lane (soft.html .lane): a sunk panel, header with glyph, title and count, then cards. */
export default function Lane({
  title,
  count,
  glyph,
  headerRight,
  footer,
  ariaLabel,
  emptyText = "Nothing here yet.",
  children,
}: LaneProps) {
  return (
    <section
      aria-label={ariaLabel ?? `${title}, ${count} ${count === 1 ? "task" : "tasks"}`}
      className="flex min-w-0 flex-col rounded-card bg-sunk p-2"
    >
      <h2 className="flex min-h-12 items-center gap-2 px-2 pt-2 pb-3 text-title text-ink">
        {glyph === "live" ? (
          <span aria-hidden className="mx-1 size-1.5 rounded-full bg-ok shadow-live" />
        ) : (
          <span className="text-ink-2">
            <Icon name={glyph} />
          </span>
        )}
        {title}
        <span className="font-normal text-ink-3">{count}</span>
        {headerRight && <span className="ml-auto flex items-center gap-1">{headerRight}</span>}
      </h2>

      {footer}

      <ul className="flex flex-col gap-2">
        {children}
        {count === 0 && <p className="px-2 py-3 text-meta text-ink-3">{emptyText}</p>}
      </ul>
    </section>
  );
}
