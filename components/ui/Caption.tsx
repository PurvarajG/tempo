import type { ReactNode } from "react";

/**
 * Caption: small mono uppercase label (11px, tracking 0.07em).
 * Labels only. Never put a Caption inside a button.
 */
export interface CaptionProps {
  children: ReactNode;
  as?: "span" | "div" | "p" | "h2" | "h3" | "dt" | "th" | "label";
  className?: string;
  id?: string;
  /** Only meaningful when as="label". */
  htmlFor?: string;
}

export default function Caption({
  children,
  as = "span",
  className,
  id,
  htmlFor,
}: CaptionProps) {
  const Tag = as;
  const classes = [
    "font-mono text-caption font-normal uppercase tracking-caption text-ink-3",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (as === "label") {
    return (
      <label id={id} htmlFor={htmlFor} className={classes}>
        {children}
      </label>
    );
  }

  return (
    <Tag id={id} className={classes}>
      {children}
    </Tag>
  );
}
