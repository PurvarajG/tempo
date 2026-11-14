import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  /** Caller passes an Icon element, so this file has no import dependency. */
  icon?: ReactNode;
  action?: ReactNode;
  layout?: "inline" | "block";
  /** Adds role="status" so the message is announced when it appears. */
  live?: boolean;
  className?: string;
}

function join(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function EmptyState({
  title,
  description,
  icon,
  action,
  layout = "block",
  live = false,
  className,
}: EmptyStateProps) {
  const role = live ? "status" : undefined;

  if (layout === "inline") {
    return (
      <div
        role={role}
        data-layout="inline"
        className={join("flex flex-wrap items-center gap-4 text-body text-ink-3", className)}
      >
        <span>{title}</span>
        {description ? <span>{description}</span> : null}
        {action}
      </div>
    );
  }

  return (
    <div
      role={role}
      data-layout="block"
      className={join("flex flex-col items-center p-6 text-center", className)}
    >
      {icon ? (
        <div
          aria-hidden
          className="mb-3 flex size-10 items-center justify-center rounded-tile bg-sunk text-ink-3"
        >
          {icon}
        </div>
      ) : null}
      <p className="text-title font-medium text-ink">{title}</p>
      {description ? (
        <p className="mt-1 max-w-[36ch] text-secondary text-ink-3">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
