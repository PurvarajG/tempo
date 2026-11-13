"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useTasks } from "@/lib/store-context";
import { useNow } from "@/lib/useNow";
import { toISODate } from "@/lib/parse";
import { inboxCount } from "@/lib/today";
import { buildWeekPlan, weekMetrics } from "@/lib/week-capacity";
import Icon, { type IconName } from "./ui/Icon";
import IconButton from "./ui/IconButton";
import DoemMark from "./DoemMark";
import TimerStrip from "./TimerStrip";
import ProfileMenu from "./sidebar/ProfileMenu";
import ProjectTree from "./sidebar/ProjectTree";
import {
  GROUP_LABEL,
  NAV_COUNT,
  NAV_ROW,
  NAV_ROW_ON,
  NAV_ROW_REST,
} from "./sidebar/nav-styles";

export interface NavItem {
  key: string;
  label: string;
  href: string;
  group: "main" | "more" | "footer";
  icon?: IconName;
}

export const NAV: NavItem[] = [
  { key: "today", label: "Today", href: "/", group: "main", icon: "today" },
  { key: "inbox", label: "Inbox", href: "/inbox", group: "main", icon: "inbox" },
  { key: "upcoming", label: "Next 7 days", href: "/upcoming", group: "main", icon: "up" },
  { key: "calendar", label: "Calendar", href: "/calendar", group: "main", icon: "cal" },
  { key: "tracking", label: "Tracking", href: "/tracking", group: "main", icon: "chart" },
  { key: "all", label: "All tasks", href: "/all", group: "more", icon: "list" },
  { key: "completed", label: "Completed", href: "/completed", group: "more", icon: "check" },
  { key: "trash", label: "Trash", href: "/trash", group: "more", icon: "trash" },
  { key: "settings", label: "Settings", href: "/settings", group: "footer" },
];

/** The one nav entry that can never be hidden: without it there is no way to undo hiding. */
export const UNHIDEABLE_NAV_KEY = "settings";

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div data-part="lbl-s" className={GROUP_LABEL}>
      {children}
    </div>
  );
}

function Count({ n }: { n: number | null }) {
  if (!n) return null;
  return (
    <span data-part="nav-count" aria-hidden="true" className={NAV_COUNT}>
      {n}
    </span>
  );
}

function NavLinks() {
  const pathname = usePathname();
  const { tasks, settings } = useTasks();
  const now = useNow();
  const todayISO = now ? toISODate(now) : "";

  const todayCount = useMemo(
    () =>
      todayISO
        ? tasks.filter((t) => t.status === "open" && t.scheduled && t.scheduled <= todayISO).length
        : null,
    [tasks, todayISO],
  );
  const weekCount = useMemo(
    () =>
      todayISO
        ? weekMetrics(tasks, todayISO, buildWeekPlan(tasks, todayISO, settings)).taskCount
        : null,
    [tasks, todayISO, settings],
  );
  const inbox = useMemo(() => (todayISO ? inboxCount(tasks, todayISO) : null), [tasks, todayISO]);
  const counts: Record<string, number | null> = { today: todayCount, inbox, upcoming: weekCount };

  // settings is null before the first fetch: show the full nav rather than flashing an empty sidebar.
  const visible = settings
    ? NAV.filter((item) => !settings.hiddenNavItems.includes(item.key))
    : NAV;
  const main = visible.filter((i) => i.group === "main");
  const more = visible.filter((i) => i.group === "more");

  function renderItem(item: NavItem) {
    const active = pathname === item.href;
    return (
      <Link
        key={item.key}
        href={item.href}
        data-part="nav-row"
        aria-current={active ? "page" : undefined}
        className={`${NAV_ROW} ${active ? NAV_ROW_ON : NAV_ROW_REST}`}
      >
        {item.icon && <Icon name={item.icon} size={16} />}
        <span className="truncate">{item.label}</span>
        <Count n={counts[item.key] ?? null} />
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* The primary group has no visible heading: under the brand row a
          "Main" label read as the logo's tagline. The nav keeps its
          accessible name. */}
      {main.length > 0 && (
        <nav aria-label="Main" className="flex flex-col gap-0.5">
          {main.map(renderItem)}
        </nav>
      )}

      <ProjectTree />

      {more.length > 0 && (
        <div>
          <GroupLabel>More</GroupLabel>
          <nav aria-label="More" className="flex flex-col gap-0.5">
            {more.map(renderItem)}
          </nav>
        </div>
      )}
    </div>
  );
}

/** Height of the bottom fade, and the padding that lets the last row scroll clear of it. */
const FADE_PX = 24;

/**
 * The nav scroll region. It ends above the foot (a sibling, never an overlay).
 * The bottom fade is a mask on the region itself and only shows while more
 * rows sit below the fold.
 */
function NavScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 1);
  }, []);
  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [measure]);
  const mask = `linear-gradient(to bottom, #000 calc(100% - ${FADE_PX}px), transparent)`;
  return (
    <div
      ref={ref}
      data-part="nav-scroll"
      data-fade={more ? "end" : undefined}
      onScroll={measure}
      style={more ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
      className="pane-scroll -m-1 min-h-0 flex-1 overflow-y-auto p-1 pb-6"
    >
      {children}
    </div>
  );
}

/**
 * The source list (soft.html .side): brand, Main, Projects, More, then the
 * foot with the timer card and the profile row. The window root carries the
 * shell tint and glass, so the aside paints no background of its own.
 */
export default function Sidebar({
  onToggleCollapsed,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  // Desktop pt-14: the traffic lights (trafficLightPosition y 20, 14 tall)
  // end at y 34, so the brand tile starts about 23px below them, matching
  // the 24px gap between the tile and the first nav row.
  return (
    <aside
      data-part="side"
      className="flex w-66 shrink-0 flex-col gap-6 px-4 pb-4 pt-6 text-ink [[data-desktop]_&]:pt-14"
    >
      {/* The drag band clears the macOS traffic lights and lets the window be
          grabbed along the sidebar's top; every control inside is `.no-drag`. */}
      <div className="drag-region">
        {/* pl-3 puts the tile's left edge on the sidebar's content column
            (nav icons and group labels at 12px in). soft.html's 8px left
            sat 4px proud of it. pr-2 keeps the collapse icon centred over
            the Projects chevron. */}
        <div data-part="brand" className="no-drag flex items-center gap-3 pl-3 pr-2 text-brand">
          <Link href="/" aria-label="Doem home" className="flex items-center gap-3 text-ink">
            <DoemMark className="size-8" />
            <span>doem</span>
          </Link>
          <span className="ml-auto text-ink-3">
            <IconButton
              icon="panel"
              label="Collapse sidebar"
              shape="tile"
              onClick={onToggleCollapsed}
            />
          </span>
        </div>
      </div>

      {/* 4px gutter (negative margin plus equal padding) keeps the selected
          row's ring from being clipped by the scroll pane. */}
      <NavScroll>
        <NavLinks />
      </NavScroll>

      <div data-part="side-foot" className="no-drag mt-auto flex shrink-0 flex-col gap-3">
        <TimerStrip variant="card" />
        <ProfileMenu />
      </div>
    </aside>
  );
}
