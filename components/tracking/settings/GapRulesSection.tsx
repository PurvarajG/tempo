"use client";

import { useTasks } from "@/lib/store-context";
import Input from "@/components/ui/Input";
import SettingRow, { SETTING_SELECT } from "@/components/settings/SettingRow";

/** Day start hour, awake window, shortest gap: the boundaries every module's math reads. */
export default function GapRulesSection() {
  const { settings, patchSettings } = useTasks();
  if (!settings) return null;

  return (
    <ul className="task-list px-2 pb-2">
      <HourRow
        id="gap-day-start"
        label="Day starts at"
        description="Time after this counts toward the next day."
        value={settings.dayStartHour}
        onChange={(dayStartHour) => patchSettings({ dayStartHour })}
      />
      <HourRow
        id="gap-awake-from"
        label="Awake from"
        value={settings.wakingStartHour}
        onChange={(wakingStartHour) => patchSettings({ wakingStartHour })}
      />
      <HourRow
        id="gap-awake-until"
        label="Awake until"
        description="Gaps are only looked for in this window."
        value={settings.wakingEndHour}
        onChange={(wakingEndHour) => patchSettings({ wakingEndHour })}
      />
      <SettingRow
        label="Shortest gap"
        description="Shorter gaps are not shown."
        htmlFor="gap-min"
        control={
          <Input
            id="gap-min"
            type="number"
            min={1}
            variant="field"
            wrapperClassName="w-28 font-mono"
            trailing="min"
            value={settings.minGapMinutes}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (n > 0) patchSettings({ minGapMinutes: n });
            }}
          />
        }
      />
    </ul>
  );
}

function HourRow({
  id,
  label,
  description,
  value,
  onChange,
}: {
  id: string;
  label: string;
  description?: string;
  value: number;
  onChange: (hour: number) => void;
}) {
  // fmtTime gives 24-hour output such as "18:00", so the "HH:00" label matches it.
  return (
    <SettingRow
      label={label}
      description={description}
      htmlFor={id}
      control={
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={SETTING_SELECT}
        >
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>
              {String(h).padStart(2, "0")}:00
            </option>
          ))}
        </select>
      }
    />
  );
}
