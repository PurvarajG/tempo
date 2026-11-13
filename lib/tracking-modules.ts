/** The six dashboard modules, in their seeded default order. Shared by the dashboard and its settings page. */
export const MODULE_TITLE: Record<string, string> = {
  now: "Now",
  unaccounted: "Gaps today",
  ribbon: "Day ribbon",
  rollups: "By category",
  signals: "Day summary",
  records: "Records",
};

/** Which dashboard column a module lands in at ≥lg. Below that the grid collapses
 *  and both lists stack in moduleOrder sequence. */
export const MODULE_COLUMN: Record<string, "main" | "side"> = {
  now: "main", unaccounted: "main", records: "main",
  ribbon: "side", rollups: "side", signals: "side",
};

// Stored key, never renamed, so saved moduleOrder, hiddenModules and collapsedModules still match.
export const GAPS_MODULE = "unaccounted";

/** The modules drawn as cards under the Tracking page's top section, in default order. Records is drawn at the top as Recent entries; rollups and signals are no longer drawn. */
export const BELOW_MODULES = ["now", "unaccounted", "ribbon"] as const;
