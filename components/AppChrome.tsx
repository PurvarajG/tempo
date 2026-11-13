"use client";

import { useCallback, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { TasksProvider } from "@/lib/store-context";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import Reminders from "./Reminders";
import TaskPanel from "./TaskPanel";
import TimerConflict from "./TimerConflict";
import ErrorToast from "./ErrorToast";
import UndoBar from "./ui/UndoBar";
import DesktopBridge from "./DesktopBridge";
import CommandPalette from "./CommandPalette";
import KeyboardShortcuts from "./KeyboardShortcuts";
import { readStoredKey } from "@/lib/storage-key";

const KEY = "doem.sidebarCollapsed";
const listeners = new Set<() => void>();

function subscribe(notify: () => void) {
  listeners.add(notify);
  window.addEventListener("storage", notify);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", notify);
  };
}

function readCollapsed(): boolean {
  try {
    return readStoredKey(KEY) === "1";
  } catch {
    return false;
  }
}

/** Sidebar collapse state, remembered in localStorage. Falls back to expanded. */
export function useSidebarCollapsed(): [boolean, (next: boolean) => void] {
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);
  const setCollapsed = useCallback((next: boolean) => {
    try {
      localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      // Storage unavailable: the change simply isn't remembered.
    }
    for (const notify of listeners) notify();
  }, []);
  return [collapsed, setCollapsed];
}

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const pathname = usePathname();

  // The capture window is the composer alone: no chrome, and no DesktopBridge
  // or Reminders, which the main window already runs.
  if (pathname === "/capture") return <TasksProvider>{children}</TasksProvider>;

  return (
    <TasksProvider>
      <div
        data-part="window"
        className="shell-glass relative flex min-h-dvh flex-row border border-win-edge bg-shell shell:h-dvh shell:overflow-hidden"
      >
        {/* Must come first in the DOM: in Electron the native drag rect is
            carved only by later-painted `.no-drag` elements, so every control
            inside this 36px band declares `.no-drag`. `pointer-events-none`
            keeps the plain web build from losing clicks to this strip. */}
        <div className="drag-region pointer-events-none absolute inset-x-0 top-0 h-9" />
        {!collapsed && (
          <Sidebar collapsed={false} onToggleCollapsed={() => setCollapsed(true)} />
        )}
        <main
          data-part="main"
          className={`flex min-w-0 flex-1 flex-col overflow-hidden rounded-panel bg-surface shadow-sm ring-1 ring-line m-2 ${collapsed ? "" : "ml-0"}`}
        >
          <TopBar sidebarCollapsed={collapsed} onExpandSidebar={() => setCollapsed(false)} />
          <div className="relative min-h-0 flex-1">
            {children}
            <div className="pointer-events-none absolute inset-x-0 bottom-6 z-40 flex flex-col items-center gap-2 px-4">
              <ErrorToast />
              <UndoBar />
            </div>
          </div>
        </main>
      </div>
      {/* Mounted once, above every surface: any list, board, or calendar can
          open the same task panel without routing away. */}
      <TaskPanel />
      <TimerConflict />
      <Reminders />
      <DesktopBridge />
      <CommandPalette />
      <KeyboardShortcuts />
    </TasksProvider>
  );
}
