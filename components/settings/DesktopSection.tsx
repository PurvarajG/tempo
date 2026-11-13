"use client";

import { useEffect, useState } from "react";
import Kbd from "@/components/ui/Kbd";
import Segmented from "@/components/ui/Segmented";
import Toggle from "@/components/ui/Toggle";
import SettingRow from "@/components/settings/SettingRow";
import { DESKTOP_BUILT, hasDesktopOptions } from "@/lib/desktop-options";
import { fmt } from "@/lib/format";
import { useTasks } from "@/lib/store-context";
import { withSettingsDefaults } from "@/lib/store-context/use-tracking-config";

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
function macShortcut(shortcut: string): string {
  return shortcut
    .split("+")
    .map((part) => MAC_KEYS[part.trim().toLowerCase()] ?? part.trim())
    .join(" ");
}

const NUDGE_OPTIONS: { value: string; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "15", label: fmt(15) },
  { value: "30", label: fmt(30) },
  { value: "60", label: fmt(60) },
];

export default function DesktopSection() {
  const { settings, patchSettings } = useTasks();
  const [registered, setRegistered] = useState(true);

  useEffect(() => {
    let live = true;
    window.doem?.getCaptureStatus?.()?.then((status) => {
      if (live && status) setRegistered(status.registered);
    });
    const off = window.doem?.onCaptureStatus?.((status) => {
      if (live && status) setRegistered(status.registered);
    });
    return () => {
      live = false;
      off?.();
    };
  }, []);

  if (!hasDesktopOptions() || !settings) return null;
  const s = withSettingsDefaults(settings);

  return (
    <ul className="task-list px-2 pb-2">
      {DESKTOP_BUILT.captureShortcut && (
        <SettingRow
          label="Capture shortcut"
          description={
            registered
              ? "Opens quick capture from anywhere on your Mac."
              : "Doem could not register this shortcut. Another app may be using it."
          }
          control={<Kbd>{macShortcut(s.captureShortcut)}</Kbd>}
        />
      )}
      {DESKTOP_BUILT.dockBadge && (
        <SettingRow
          label="Dock badge"
          description="Show today's tasks, plus overdue ones with a due time, on the Dock icon."
          control={
            <Toggle
              on={s.dockBadge === "today"}
              label="Dock badge"
              onChange={() => patchSettings({ dockBadge: s.dockBadge === "today" ? "none" : "today" })}
            />
          }
        />
      )}
      {DESKTOP_BUILT.nudge && (
        <SettingRow
          label="Not tracking nudge"
          description="One reminder when nothing has been tracked for this long."
          control={
            <Segmented
              size="sm"
              ariaLabel="Not tracking nudge"
              options={NUDGE_OPTIONS}
              value={s.nudgeMinutes == null ? "off" : String(s.nudgeMinutes)}
              onChange={(v) => patchSettings({ nudgeMinutes: v === "off" ? null : Number(v) })}
            />
          }
        />
      )}
      {DESKTOP_BUILT.claudeAwareness && (
        <SettingRow
          label="Claude Code awareness"
          description="Reads Claude Code session files on this Mac and never changes them. Suggests time blocks on the day ribbon and tells you when Claude is waiting."
          control={
            <Toggle
              on={s.claudeAwareness}
              label="Claude Code awareness"
              onChange={() => patchSettings({ claudeAwareness: !s.claudeAwareness })}
            />
          }
        />
      )}
    </ul>
  );
}
