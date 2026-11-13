import { Fragment, type ReactNode } from "react";

export interface KbdProps {
  children?: ReactNode;
  keys?: string[];
  className?: string;
}

const BASE =
  "inline-block rounded-full bg-surface px-2 py-[3px] font-mono text-caption text-ink-3 ring-1 ring-line";

export default function Kbd({ children, keys, className }: KbdProps) {
  const classes = [BASE, className].filter(Boolean).join(" ");

  if (keys && keys.length > 0) {
    return (
      <kbd data-part="kbd" className={classes}>
        {keys.map((key, index) => (
          <Fragment key={`${key}-${index}`}>
            {index > 0 ? " " : null}
            <kbd>{key}</kbd>
          </Fragment>
        ))}
      </kbd>
    );
  }

  return <kbd data-part="kbd" className={classes}>{children}</kbd>;
}
