import type { ReactNode } from "react";

export interface CardProps {
  children: ReactNode;
  as?: "section" | "div" | "article" | "aside";
  className?: string;
  "aria-labelledby"?: string;
  id?: string;
  /** Clip children to the card radius. Off by default. */
  clip?: boolean;
}

export default function Card({
  children,
  as: Tag = "section",
  className,
  clip = false,
  id,
  "aria-labelledby": ariaLabelledBy,
}: CardProps) {
  const classes = ["bg-surface rounded-card ring-1 ring-line shadow-sm"];
  if (clip) classes.push("overflow-hidden");
  if (className) classes.push(className);
  return (
    <Tag id={id} data-part="card" aria-labelledby={ariaLabelledBy} className={classes.join(" ")}>
      {children}
    </Tag>
  );
}

export interface CardHeaderProps {
  title: ReactNode;
  titleAs?: "h2" | "h3";
  titleId?: string;
  /** Caller passes an icon element; this file has no icon import. */
  icon?: ReactNode;
  count?: ReactNode;
  right?: ReactNode;
  /** Button(s) shown after the right meta. */
  action?: ReactNode;
  className?: string;
}

export function CardHeader({
  title,
  titleAs: Heading = "h2",
  titleId,
  icon,
  count,
  right,
  action,
  className,
}: CardHeaderProps) {
  const classes = ["flex items-center gap-2 px-4 pt-4 pb-2"];
  if (className) classes.push(className);
  return (
    <div data-part="card-h" className={classes.join(" ")}>
      {icon ? (
        <span
          aria-hidden="true"
          className="grid size-7 shrink-0 place-items-center rounded-tile ring-1 ring-line text-ink-2"
        >
          {icon}
        </span>
      ) : null}
      <Heading id={titleId} className="text-title font-medium text-ink">
        {title}
      </Heading>
      {count != null && count !== false ? (
        <span className="text-body text-ink-3">{count}</span>
      ) : null}
      {right != null || action != null ? (
        <div className="ml-auto flex items-center gap-2">
          {right != null ? <span className="text-meta text-ink-3">{right}</span> : null}
          {action}
        </div>
      ) : null}
    </div>
  );
}
