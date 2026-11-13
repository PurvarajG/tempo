// Keyboard shortcuts for task lists. Pure module, no React.
// `f` starts a focus session (Phase 10A).

export type ShortcutAction =
  | "next"
  | "prev"
  | "done"
  | "tomorrow"
  | "pickDate"
  | "timer"
  | "focus"
  | "commit"
  | "open"
  | "trash"
  | "quickAdd"
  | "sheet";

export type Shortcut = { action: ShortcutAction; keys: readonly string[]; label: string };

export const SHORTCUTS: readonly Shortcut[] = [
  { action: "next", keys: ["J"], label: "Next task" },
  { action: "prev", keys: ["K"], label: "Previous task" },
  { action: "done", keys: ["X", "Space"], label: "Mark done" },
  { action: "tomorrow", keys: ["T"], label: "Move to tomorrow" },
  { action: "pickDate", keys: ["D"], label: "Pick a day" },
  { action: "timer", keys: ["S"], label: "Start or stop the timer" },
  { action: "focus", keys: ["F"], label: "Start a focus session" },
  { action: "commit", keys: ["*"], label: "Commit to today" },
  { action: "open", keys: ["E", "Enter"], label: "Open task" },
  { action: "trash", keys: ["⌫"], label: "Move to trash" },
  { action: "quickAdd", keys: ["/"], label: "Add a task" },
  { action: "sheet", keys: ["?"], label: "Show shortcuts" },
];

// Mirrors ROUTE_BY_DIGIT and the handlers in components/DesktopBridge.tsx.
export const GLOBAL_SHORTCUTS: readonly { keys: readonly string[]; label: string }[] = [
  { keys: ["⌘", "K"], label: "Search and commands" },
  { keys: ["⌘", "N"], label: "New task" },
  { keys: ["⌘", "Z"], label: "Undo" },
  { keys: ["⌘", "0"], label: "Go to Inbox" },
  { keys: ["⌘", "1"], label: "Go to Today" },
  { keys: ["⌘", "2"], label: "Go to Calendar" },
  { keys: ["⌘", "3"], label: "Go to Tracking" },
  { keys: ["⌘", "4"], label: "Go to Next 7 days" },
  { keys: ["⌘", "5"], label: "Go to All tasks" },
];

const BY_KEY: Readonly<Record<string, ShortcutAction>> = {
  j: "next",
  k: "prev",
  x: "done",
  " ": "done",
  t: "tomorrow",
  d: "pickDate",
  s: "timer",
  f: "focus",
  "*": "commit",
  e: "open",
  Enter: "open",
  Backspace: "trash",
  "/": "quickAdd",
  "?": "sheet",
};

export function matchShortcut(e: {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
}): ShortcutAction | null {
  if (e.metaKey || e.ctrlKey || e.altKey) return null;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  return Object.prototype.hasOwnProperty.call(BY_KEY, key) ? BY_KEY[key] : null;
}

const NON_TEXT_INPUTS = new Set(["checkbox", "radio", "button", "submit", "reset", "range", "color"]);

export function isTypingTarget(el: EventTarget | null): boolean {
  if (!el || typeof HTMLElement === "undefined" || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT") return !NON_TEXT_INPUTS.has((el as HTMLInputElement).type);
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable || el.contentEditable === "true";
}
