"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import Icon from "@/components/ui/Icon";

export type Theme = "light" | "dark" | "system";

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
}

/** Notifies this tab when `cycle` writes; `storage` covers the other tabs. */
const CHANGED = "theme-changed";
const listeners = new Set<() => void>();

function subscribe(notify: () => void) {
  listeners.add(notify);
  window.addEventListener("storage", notify);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", notify);
  };
}

function write(next: Theme) {
  localStorage.setItem("theme", next);
  for (const notify of listeners) notify();
  window.dispatchEvent(new Event(CHANGED));
}

/**
 * The saved theme lives in localStorage, so it's read as an external store
 * rather than copied into state by an effect. The server snapshot is `null`,
 * which lets the toggle render a placeholder and keeps hydration honest.
 */
function useStoredTheme(): Theme | null {
  const theme = useSyncExternalStore(
    subscribe,
    () => (localStorage.getItem("theme") as Theme | null) ?? "system",
    () => null,
  );

  // Writing to the DOM is exactly what an effect is for.
  useEffect(() => {
    if (theme) apply(theme);
  }, [theme]);

  return theme;
}

/** Shared by the top bar toggle and the Settings Appearance section. */
export function useTheme(): [Theme, (next: Theme) => void] {
  const theme = useStoredTheme();
  return [theme ?? "system", write];
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeScheme(notify: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia(DARK_QUERY);
  mq.addEventListener("change", notify);
  return () => mq.removeEventListener("change", notify);
}

/** Whether the OS prefers dark; used to resolve the 'system' theme. */
function useSystemDark(): boolean {
  return useSyncExternalStore(
    subscribeScheme,
    () => typeof window.matchMedia === "function" && window.matchMedia(DARK_QUERY).matches,
    () => false,
  );
}

export default function ThemeToggle() {
  const theme = useStoredTheme();
  const systemDark = useSystemDark();

  const cycle = useCallback(() => {
    const order: Theme[] = ["system", "light", "dark"];
    write(order[(order.indexOf(theme ?? "system") + 1) % order.length]);
  }, [theme]);

  if (!theme) return <div className="size-9" />;

  const label = theme === "system" ? "Auto" : theme === "light" ? "Light" : "Dark";

  const renderedDark = theme === "dark" || (theme === "system" && systemDark);

  return (
    <button
      data-part="icon-btn"
      onClick={cycle}
      aria-label={`Theme: ${label}. Click to change.`}
      title={`Theme: ${label}`}
      className="no-drag grid size-9 shrink-0 place-items-center rounded-full ring-1 ring-line text-ink-2 transition-colors duration-150 ease-out hover:bg-sunk hover:text-ink"
    >
      <Icon name={renderedDark ? "sun" : "moon"} size={16} />
    </button>
  );
}
