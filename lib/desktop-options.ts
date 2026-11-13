/**
 * A flag turns true only when the desktop app consumes that setting today.
 * Options whose feature is not built are hidden, never disabled. Phases 10C
 * and 10D flip these.
 */
export const DESKTOP_BUILT = {
  captureShortcut: true,
  dockBadge: true,
  nudge: true,
  claudeAwareness: true,
} as const;

export function hasDesktopOptions(): boolean {
  return Object.values(DESKTOP_BUILT).some(Boolean);
}
