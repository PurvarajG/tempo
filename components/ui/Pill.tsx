import type { ReactNode } from "react";

export type PillTone = "neutral" | "accent" | "ok";

export interface PillProps {
  children: ReactNode;
  tone?: PillTone;
  leading?: ReactNode;
  className?: string;
  title?: string;
}

const TONES: Record<PillTone, string> = {
  neutral: "text-ink-2 inset-ring inset-ring-line-2",
  accent: "text-accent bg-accent-soft",
  ok: "text-ok inset-ring inset-ring-line-2",
};

export default function Pill({
  children,
  tone = "neutral",
  leading,
  className,
  title,
}: PillProps) {
  return (
    <span
      data-part="pill"
      title={title}
      className={[
        "inline-flex items-center gap-1 text-meta px-2 py-0.5 rounded-full whitespace-nowrap",
        TONES[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {leading}
      {children}
    </span>
  );
}
