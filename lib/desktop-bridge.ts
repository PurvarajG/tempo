export type DoemCommand =
  | { type: "new-task" }
  | { type: "focus-search" }
  | { type: "toggle-timer" }
  | { type: "navigate"; path: string }
  | { type: "refresh-tasks" } // capture window saved a task; main window reloads tasks
  | { type: "reminder-start"; taskId: string } // notification action Start
  | { type: "reminder-tomorrow"; taskId: string } // notification action Tomorrow
  | { type: "away"; choice: "keep" | "break" | "discard"; awayFrom: string; awayTo: string }; // ISO strings

export type DoemTimerStatus = { label: string; startedAt: string } | null;

export type DoemReminder = {
  taskId: string;
  title: string;
  scheduled: string;
  dueTime: string;
  leadMinutes: number;
};
export type DoemDesktopSettings = {
  captureShortcut: string;
  nudgeMinutes: number | null;
  claudeAwareness: boolean;
};
export type DoemCaptureStatus = { shortcut: string; registered: boolean };
export type ClaudeSession = { id: string; projectPath: string; projectName: string; branch: string | null; lastPrompt: string; firstMessageAt: string; lastMessageAt: string; waiting: boolean; active: boolean };

declare global {
  interface Window {
    doem?: {
      onCommand: (callback: (command: DoemCommand) => void) => () => void;
      setBadge: (count: number) => void;
      setTimerStatus: (status: DoemTimerStatus) => void;
      setCanToggleTimer: (canToggle: boolean) => void;
      notify: (title: string, options?: { body?: string; tag?: string }) => void;
      attention: (payload: { title: string; body?: string }) => void;
      setReminders: (reminders: DoemReminder[]) => void;
      setDesktopSettings: (settings: DoemDesktopSettings) => void;
      getCaptureStatus: () => Promise<DoemCaptureStatus | null>;
      /** Releases the global shortcut while Settings records a new one. */
      pauseCaptureShortcut?: (paused: boolean) => void;
      onCaptureStatus: (callback: (status: DoemCaptureStatus) => void) => () => void;
      getClaudeSessions: () => Promise<ClaudeSession[]>;
      onClaudeSessions: (callback: (sessions: ClaudeSession[]) => void) => () => void;
      closeCapture: () => void;
      captureSaved: () => void;
      platform: string;
    };
  }
}
