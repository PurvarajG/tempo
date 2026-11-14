"use client";

import { useCallback, useState } from "react";
import { SETTINGS_DEFAULTS, type TrackingSettings } from "../types";
import { request } from "./request";

export type SettingsPatch = Partial<Omit<TrackingSettings, "updatedAt">>;

/** The eight v2 settings fields with SETTINGS_DEFAULTS filling anything unset. */
export function withSettingsDefaults(
  settings: Partial<TrackingSettings> | null | undefined,
): typeof SETTINGS_DEFAULTS {
  const out = { ...SETTINGS_DEFAULTS } as Record<string, unknown>;
  for (const key of Object.keys(SETTINGS_DEFAULTS) as (keyof typeof SETTINGS_DEFAULTS)[]) {
    const value = settings?.[key];
    if (value !== undefined) out[key] = value;
  }
  return out as typeof SETTINGS_DEFAULTS;
}

export type TrackingConfigApi = {
  settings: TrackingSettings | null;
  setSettings: React.Dispatch<React.SetStateAction<TrackingSettings | null>>;
  patchSettings: (patch: SettingsPatch) => Promise<void>;
};

export function useTrackingConfig(onError: (message: string) => void): TrackingConfigApi {
  const [settings, setSettings] = useState<TrackingSettings | null>(null);

  const patchSettings = useCallback(
    async (patch: SettingsPatch) => {
      let before: TrackingSettings | null = null;
      setSettings((prev) => {
        before = prev;
        return prev ? { ...prev, ...patch } : prev;
      });
      try {
        const saved = await request<TrackingSettings>("/api/tracking-settings", {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
        setSettings(saved);
      } catch (error) {
        setSettings(before);
        onError((error as Error).message);
      }
    },
    [onError],
  );

  return { settings, setSettings, patchSettings };
}
