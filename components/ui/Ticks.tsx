/**
 * Tick-bar meter: 3px ticks with 3px gaps, the filled portion in the tone
 * colour and the remainder in the "off" colour. Used for Momentum progress
 * and week capacity. Over-capacity (value above 1) switches to the hi tone.
 */
export interface TicksProps {
  /** 0..1, clamped for the fill; values above 1 fill fully. */
  value: number;
  /** Accessible name. */
  label: string;
  tone?: "accent" | "hi";
  size?: "md" | "sm";
  /** aria-valuetext, e.g. "5h 30m of 6h". */
  valueText?: string;
  className?: string;
}

export default function Ticks({
  value,
  label,
  tone,
  size = "md",
  valueText,
  className,
}: TicksProps) {
  const safe = Number.isFinite(value) ? value : 0;
  const clamped = Math.min(1, Math.max(0, safe));
  const percent = Math.round(clamped * 100);
  const resolvedTone = tone ?? (safe > 1 ? "hi" : "accent");
  const tick =
    resolvedTone === "hi" ? "var(--color-hi)" : "var(--color-accent)";
  const height = size === "sm" ? "h-5" : "h-6";

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={valueText}
      data-tone={resolvedTone}
      data-size={size}
      className={`${height} w-full rounded-check ${className ?? ""}`.trim()}
      style={
        {
          "--fill": `${clamped * 100}%`,
          backgroundImage: `repeating-linear-gradient(90deg, ${tick} 0 3px, transparent 3px 6px), repeating-linear-gradient(90deg, var(--color-off) 0 3px, transparent 3px 6px)`,
          backgroundSize: "var(--fill) 100%, 100% 100%",
          backgroundPosition: "0 0, 0 0",
          backgroundRepeat: "no-repeat, repeat",
        } as React.CSSProperties
      }
    />
  );
}
