"use client";

import { usePathname } from "next/navigation";
import { useTasks } from "@/lib/store-context";
import { NAV } from "./Sidebar";
import NotificationsButton from "./NotificationsButton";
import ThemeToggle from "./ThemeToggle";
import TimerStrip from "./TimerStrip";
import Icon from "./ui/Icon";
import IconButton from "./ui/IconButton";
import Kbd from "./ui/Kbd";
import { openCommandPalette } from "./CommandPalette";

const GROUP_LABEL = { main: "Main", more: "More" } as const;

function useCrumbs(): string[] {
  const pathname = usePathname() ?? "/";
  const { projects } = useTasks();

  if (pathname === "/settings") return ["You", "Settings"];
  if (pathname === "/tracking/settings") return ["Tracking", "Settings"];
  if (pathname === "/search") return ["Search"];
  if (pathname === "/wrap") return ["Today", "Wrap up"];
  if (pathname.startsWith("/projects/")) {
    const id = pathname.split("/")[2];
    return ["Projects", projects.find((p) => p.id === id)?.name ?? "Project"];
  }
  const item = NAV.find((n) => n.href === pathname);
  if (item && (item.group === "main" || item.group === "more")) {
    return [GROUP_LABEL[item.group], item.label];
  }
  return [];
}

export default function TopBar({
  sidebarCollapsed,
  onExpandSidebar,
}: {
  sidebarCollapsed: boolean;
  onExpandSidebar: () => void;
}) {
  const crumbs = useCrumbs();

  return (
    <header
      data-part="bar"
      className={`drag-region flex h-16 shrink-0 items-center gap-3 border-b border-line px-6 ${
        sidebarCollapsed ? "[[data-desktop]_&]:pl-20" : ""
      }`}
    >
      {sidebarCollapsed && (
        <IconButton
          icon="panel"
          label="Show sidebar"
          onClick={onExpandSidebar}
          className="no-drag"
        />
      )}

      <nav
        data-part="crumb"
        aria-label="Breadcrumb"
        className="flex min-w-0 items-center gap-2 text-body text-ink-3"
      >
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <span key={`${i}-${crumb}`} className="flex min-w-0 items-center gap-2">
              {i > 0 && <Icon name="chev" size={14} />}
              {last ? (
                <span aria-current="page" className="truncate font-medium text-ink">
                  {crumb}
                </span>
              ) : (
                <span>{crumb}</span>
              )}
            </span>
          );
        })}
      </nav>

      <button
        id="doem-sidebar-search"
        data-part="search"
        type="button"
        aria-label="Search"
        onClick={() => openCommandPalette()}
        className="no-drag ml-auto flex h-9 w-full min-w-0 max-w-[300px] items-center gap-2 rounded-full bg-sunk pl-3.5 pr-1.5 text-left text-secondary text-ink-3 transition-shadow duration-150 ease-out hover:shadow-[inset_0_0_0_1px_var(--color-line-2)]"
      >
        <Icon name="search" />
        <span className="min-w-0 flex-1 truncate">Search tasks, projects…</span>
        <Kbd>⌘ K</Kbd>
      </button>

      <NotificationsButton />

      {sidebarCollapsed && (
        <div className="no-drag">
          <TimerStrip variant="compact" />
        </div>
      )}
      <div className="no-drag">
        <ThemeToggle />
      </div>
    </header>
  );
}
