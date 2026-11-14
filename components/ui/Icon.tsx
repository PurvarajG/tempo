import type { ReactNode } from "react";

export type IconName =
  | "today"
  | "up"
  | "cal"
  | "chart"
  | "search"
  | "plus"
  | "chev"
  | "chevup"
  | "updown"
  | "panel"
  | "moon"
  | "sun"
  | "monitor"
  | "bell"
  | "list"
  | "board"
  | "clock"
  | "flag"
  | "play"
  | "check"
  | "repeat"
  | "folder"
  | "target"
  | "paper"
  | "trash"
  | "more"
  | "x"
  | "inbox";

const SHAPES: Record<IconName, ReactNode> = {
  today: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 2" />
    </>
  ),
  up: <path d="M5 7h14M5 12h10M5 17h6" />,
  cal: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="3" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  chart: <path d="M6 19V11M12 19V5M18 19v-6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  chev: <path d="m9 6 6 6-6 6" />,
  chevup: <path d="m6 15 6-6 6 6" />,
  updown: <path d="m8 9 4-4 4 4M8 15l4 4 4-4" />,
  panel: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="3" />
      <path d="M10 5v14" />
    </>
  ),
  moon: <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
    </>
  ),
  monitor: (
    <>
      <rect x="3.5" y="4.5" width="17" height="11.5" rx="2.5" />
      <path d="M9 20h6M12 16v4" />
    </>
  ),
  bell: <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />,
  list: (
    <path d="M9 7h11M9 12h11M9 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01" />
  ),
  board: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="2" />
      <rect x="13" y="4" width="7" height="7" rx="2" />
      <rect x="4" y="13" width="7" height="7" rx="2" />
      <rect x="13" y="13" width="7" height="7" rx="2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  flag: <path d="M6 21V4h11l-2 4 2 4H6" />,
  play: <path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" strokeWidth={2.5} />,
  repeat: (
    <path d="M17 3l3 3-3 3M20 6H8a4 4 0 0 0-4 4M7 21l-3-3 3-3M4 18h12a4 4 0 0 0 4-4" />
  ),
  folder: (
    <path d="M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r=".5" />
    </>
  ),
  paper: (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M10 7V4.5h4V7" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  more: (
    <>
      <circle cx="6" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="18" cy="12" r="1" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6 6 18" />,
  inbox: (
    <>
      <path d="M4 13l2.5-7h11L20 13v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
      <path d="M4 13h4.5l1.5 2h4l1.5-2H20" />
    </>
  ),
};

export const ICON_NAMES = Object.keys(SHAPES) as readonly IconName[];

export interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  label?: string;
  strokeWidth?: number;
}

export default function Icon({
  name,
  size = 16,
  className,
  label,
  strokeWidth = 1.5,
}: IconProps) {
  const a11y = label
    ? ({ role: "img", "aria-label": label } as const)
    : ({ "aria-hidden": "true", focusable: "false" } as const);
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={["shrink-0", "block", className].filter(Boolean).join(" ")}
      {...a11y}
    >
      {SHAPES[name]}
    </svg>
  );
}
