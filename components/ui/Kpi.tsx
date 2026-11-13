import type { ReactNode } from "react";
import Caption from "@/components/ui/Caption";

/**
 * Kpi: one tile of a KPI row. The grid is the caller's job.
 * Formats nothing: callers pass formatted strings (durations as 1h 30m).
 */
export interface KpiProps {
  label: string;
  value: ReactNode;
  unit?: ReactNode;
  /** Right-hand visual, e.g. a Spark. */
  visual?: ReactNode;
  foot?: { label: ReactNode; value: ReactNode; tone?: "neutral" | "up" };
  className?: string;
  as?: "div" | "section" | "li";
}

export default function Kpi({
  label,
  value,
  unit,
  visual,
  foot,
  className,
  as = "div",
}: KpiProps) {
  const Tag = as;
  const classes = [
    "overflow-hidden rounded-kpi bg-surface ring-1 ring-line",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag data-part="kpi" className={classes}>
      <div className="flex items-end justify-between gap-2 p-4">
        <dl className="m-0">
          <Caption as="dt">{label}</Caption>
          <dd className="m-0 mt-2 font-mono text-kpi font-medium leading-none text-ink">
            {value}
            {unit ? (
              <small className="ml-1 font-sans text-secondary font-normal tracking-normal text-ink-3">
                {unit}
              </small>
            ) : null}
          </dd>
        </dl>
        {visual ? <div className="shrink-0">{visual}</div> : null}
      </div>
      {foot ? (
        <div
          data-testid="kpi-foot"
          className="flex justify-between bg-sunk px-4 py-2 text-meta text-ink-3"
        >
          <span>{foot.label}</span>
          <span
            className={
              foot.tone === "up"
                ? "font-medium text-ok"
                : "font-medium text-ink-2"
            }
          >
            {foot.value}
          </span>
        </div>
      ) : null}
    </Tag>
  );
}
