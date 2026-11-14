"use client";

import { useTasks } from "@/lib/store-context";
import { NAV, UNHIDEABLE_NAV_KEY } from "@/components/Sidebar";
import Toggle from "@/components/ui/Toggle";
import SettingRow from "@/components/settings/SettingRow";

/** Hides a nav link from the sidebar. The route itself still loads if navigated to directly. */
export default function NavVisibility() {
  const { settings, patchSettings } = useTasks();
  if (!settings) return null;

  return (
    <ul className="task-list px-2 pb-2">
      {NAV.map((item) => {
        const locked = item.key === UNHIDEABLE_NAV_KEY;
        const hidden = settings.hiddenNavItems.includes(item.key);
        return (
          <SettingRow
            key={item.key}
            label={hidden ? <span className="text-ink-3">{item.label}</span> : item.label}
            description={locked ? "Always shown" : undefined}
            control={
              <Toggle
                on={!hidden}
                label={hidden ? `Show ${item.label}` : `Hide ${item.label}`}
                disabled={locked}
                onChange={() =>
                  patchSettings({
                    hiddenNavItems: hidden
                      ? settings.hiddenNavItems.filter((k) => k !== item.key)
                      : [...settings.hiddenNavItems, item.key],
                  })
                }
              />
            }
          />
        );
      })}
    </ul>
  );
}
