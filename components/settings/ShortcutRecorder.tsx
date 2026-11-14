"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Kbd from "@/components/ui/Kbd";

const MAC_KEYS: Record<string, string> = {
  control: "⌃",
  ctrl: "⌃",
  alt: "⌥",
  option: "⌥",
  shift: "⇧",
  command: "⌘",
  cmd: "⌘",
  commandorcontrol: "⌘",
  cmdorctrl: "⌘",
  meta: "⌘",
  super: "⌘",
};

/** "Control+Alt+Space" reads as "⌃ ⌥ Space". */
export function macShortcut(shortcut: string): string {
  return shortcut
    .split("+")
    .map((part) => MAC_KEYS[part.trim().toLowerCase()] ?? part.trim())
    .join(" ");
}

const NAMED_KEYS: Record<string, string> = {
  Space: "Space",
  Enter: "Enter",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
};

/** The physical key, so Option (which changes `key` on a Mac) still reads as the letter. */
function keyName(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1[0-9]|20)$/.test(code)) return code;
  return NAMED_KEYS[code] ?? null;
}

type KeyCombo = Pick<KeyboardEvent, "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">;

/**
 * An Electron accelerator for a key press, or null when it can't be a global
 * shortcut: it needs Command, Control or Option (Shift alone would swallow
 * normal typing) and a letter, number, Space, Enter, arrow or F-key.
 */
export function acceleratorFromEvent(e: KeyCombo): string | null {
  const key = keyName(e.code);
  if (!key || !(e.metaKey || e.ctrlKey || e.altKey)) return null;
  const parts: string[] = [];
  if (e.metaKey) parts.push("Command");
  if (e.ctrlKey) parts.push("Control");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  parts.push(key);
  return parts.join("+");
}

const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta"]);

export default function ShortcutRecorder({
  value,
  defaultValue,
  onChange,
}: {
  value: string;
  defaultValue: string;
  onChange: (shortcut: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (!recording) return;
    window.doem?.pauseCaptureShortcut?.(true);
    const stop = () => setRecording(false);
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === "Escape" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setHint(null);
        stop();
        return;
      }
      if (MODIFIER_KEYS.has(e.key)) return;
      const next = acceleratorFromEvent(e);
      if (!next) {
        setHint("Use ⌘, ⌃ or ⌥ with a letter, number, Space or F-key.");
        return;
      }
      setHint(null);
      stop();
      if (next !== value) onChange(next);
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("blur", stop);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("blur", stop);
      window.doem?.pauseCaptureShortcut?.(false);
    };
  }, [recording, value, onChange]);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Kbd>{recording ? "Press keys…" : macShortcut(value)}</Kbd>
        {recording ? (
          <Button variant="ghost" size="sm" onClick={() => { setHint(null); setRecording(false); }}>
            Cancel
          </Button>
        ) : (
          <>
            {value !== defaultValue && (
              <Button variant="ghost" size="sm" onClick={() => onChange(defaultValue)}>
                Reset
              </Button>
            )}
            <Button variant="chip" size="sm" onClick={() => setRecording(true)}>
              Change
            </Button>
          </>
        )}
      </div>
      {recording && (
        <p className="text-caption text-ink-3" role="status">
          {hint ?? "Esc to cancel"}
        </p>
      )}
    </div>
  );
}
