"use client";

import { useTasks } from "@/lib/store-context";
import { withSettingsDefaults } from "@/lib/store-context/use-tracking-config";
import { TODAY_CAP_OPTIONS, type DateOrder } from "@/lib/types";
import { WEEKDAYS_LONG, fmtTime } from "@/lib/format";
import Segmented from "@/components/ui/Segmented";
import Menu from "@/components/ui/Menu";
import SettingRow from "./SettingRow";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => fmtTime(`${String(h).padStart(2, "0")}:00`);
// Week starts Monday; values stay the Sunday-based 0-6 numbers settings.weeklyResetDay stores.
const RESET_OPTIONS = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ value: String(d), label: WEEKDAYS_LONG[d].slice(0, 3) }));
const CAP_OPTIONS = TODAY_CAP_OPTIONS.map((n) => ({ value: String(n), label: String(n) }));
const ORDER_OPTIONS: { value: DateOrder; label: string }[] = [
  { value: "dmy", label: "Day first" },
  { value: "mdy", label: "Month first" },
];

export default function TodaySection() {
  const { settings, patchSettings } = useTasks();
  if (!settings) return null;
  const s = withSettingsDefaults(settings);

  return (
    <ul className="task-list px-2 pb-2">
      <SettingRow
        label="Today's list"
        description="How many tasks you can commit to each day."
        control={
          <Segmented
            size="sm"
            ariaLabel="Today's list size"
            options={CAP_OPTIONS}
            value={String(s.todayCap)}
            onChange={(v) => patchSettings({ todayCap: Number(v) })}
          />
        }
      />
      <SettingRow
        label="Wrap-up time"
        description="When Today offers to close the day."
        control={
          <Menu
            variant="chip"
            ariaLabel="Wrap-up time"
            label={hourLabel(s.wrapHour)}
            minWidth={120}
            items={HOURS.map((h) => ({
              id: String(h),
              label: hourLabel(h),
              onSelect: () => patchSettings({ wrapHour: h }),
            }))}
          />
        }
      />
      <SettingRow
        label="Weekly reset"
        description="The day your week starts over."
        control={
          <Segmented
            size="sm"
            ariaLabel="Weekly reset"
            options={RESET_OPTIONS}
            value={String(s.weeklyResetDay)}
            onChange={(v) => patchSettings({ weeklyResetDay: Number(v) })}
          />
        }
      />
      <SettingRow
        label="Date order"
        description="How quick add reads a date typed in numbers."
        control={
          <Segmented
            size="sm"
            ariaLabel="Date order"
            options={ORDER_OPTIONS}
            value={s.dateOrder}
            onChange={(v) => patchSettings({ dateOrder: v })}
          />
        }
      />
    </ul>
  );
}
