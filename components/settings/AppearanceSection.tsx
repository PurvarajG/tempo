"use client";

import Icon from "@/components/ui/Icon";
import Segmented from "@/components/ui/Segmented";
import SettingRow from "@/components/settings/SettingRow";
import { useTheme, type Theme } from "@/components/ThemeToggle";

const OPTIONS = [
  { value: "system", label: "Auto" },
  { value: "light", label: "Light", icon: <Icon name="sun" size={14} /> },
  { value: "dark", label: "Dark", icon: <Icon name="moon" size={14} /> },
] satisfies { value: Theme; label: string; icon?: React.ReactNode }[];

export default function AppearanceSection() {
  const [theme, setTheme] = useTheme();

  return (
    <ul className="task-list px-2 pb-2">
      <SettingRow
        label="Theme"
        description="Auto follows your Mac's light or dark setting."
        control={
          <Segmented
            size="sm"
            ariaLabel="Theme"
            options={OPTIONS}
            value={theme}
            onChange={setTheme}
          />
        }
      />
    </ul>
  );
}
