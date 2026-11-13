export interface SparkProps {
  values: number[];
  /** Accessible description, e.g. "Focus hours, last 14 days". */
  label: string;
  /** Indexes drawn in the highlight colour. Default "last". */
  highlight?: "last" | "none" | number[];
  /** Colour of highlighted bars. Default ink. */
  tone?: "ink" | "accent";
  className?: string;
}

export default function Spark({
  values,
  label,
  highlight = "last",
  tone = "ink",
  className,
}: SparkProps) {
  const safe = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const max = Math.max(0, ...safe);
  const on = (i: number) =>
    highlight === "last"
      ? i === safe.length - 1
      : highlight === "none"
        ? false
        : highlight.includes(i);
  const hot = tone === "accent" ? "bg-accent" : "bg-ink";

  return (
    <div
      role="img"
      aria-label={label}
      className={["flex h-7 items-end gap-0.5", className].filter(Boolean).join(" ")}
    >
      {safe.map((v, i) => (
        <i
          key={i}
          aria-hidden="true"
          data-spark-bar=""
          data-on={on(i) ? "true" : "false"}
          className={`block w-0.5 min-h-0.5 rounded-full ${on(i) ? hot : "bg-line-2"}`}
          style={{ height: max > 0 ? `${(v / max) * 100}%` : "2px" }}
        />
      ))}
    </div>
  );
}
