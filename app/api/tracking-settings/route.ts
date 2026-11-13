import { handle, json } from "@/lib/api";
import { store } from "@/lib/store";
import { TODAY_CAP_OPTIONS } from "@/lib/types";
import * as v from "@/lib/validate";

export async function GET() {
  return handle(async () => store.getTrackingSettings());
}

export async function PATCH(request: Request) {
  return handle(async () => {
    const b = v.body(await json(request));
    return store.updateTrackingSettings({
      ...(b.dayStartHour !== undefined ? { dayStartHour: v.hour(b.dayStartHour, "dayStartHour") } : {}),
      ...(b.wakingStartHour !== undefined ? { wakingStartHour: v.hour(b.wakingStartHour, "wakingStartHour") } : {}),
      ...(b.wakingEndHour !== undefined ? { wakingEndHour: v.hour(b.wakingEndHour, "wakingEndHour") } : {}),
      ...(b.minGapMinutes !== undefined ? { minGapMinutes: v.minutes(b.minGapMinutes, "minGapMinutes") } : {}),
      ...(b.moduleOrder !== undefined ? { moduleOrder: v.stringList(b.moduleOrder, "moduleOrder") } : {}),
      ...(b.hiddenModules !== undefined ? { hiddenModules: v.stringList(b.hiddenModules, "hiddenModules") } : {}),
      ...(b.collapsedModules !== undefined
        ? { collapsedModules: v.stringList(b.collapsedModules, "collapsedModules") }
        : {}),
      ...(b.hiddenNavItems !== undefined
        ? { hiddenNavItems: v.stringList(b.hiddenNavItems, "hiddenNavItems") }
        : {}),
      ...(b.todayCap !== undefined
        ? {
            todayCap: (() => {
              const n = v.minutes(b.todayCap, "todayCap");
              if (typeof b.todayCap !== "number" || !(TODAY_CAP_OPTIONS as readonly number[]).includes(n)) {
                v.fail(`todayCap must be one of ${TODAY_CAP_OPTIONS.join(", ")}`);
              }
              return n as (typeof TODAY_CAP_OPTIONS)[number];
            })(),
          }
        : {}),
      ...(b.dockBadge !== undefined ? { dockBadge: v.oneOf(b.dockBadge, "dockBadge", ["today", "none"] as const) } : {}),
      ...(b.captureShortcut !== undefined ? { captureShortcut: v.shortcut(b.captureShortcut, "captureShortcut") } : {}),
      ...(b.nudgeMinutes !== undefined ? { nudgeMinutes: v.nullablePositiveInt(b.nudgeMinutes, "nudgeMinutes", 240) } : {}),
      ...(b.wrapHour !== undefined ? { wrapHour: v.hour(b.wrapHour, "wrapHour") } : {}),
      ...(b.weeklyResetDay !== undefined ? { weeklyResetDay: v.weekday(b.weeklyResetDay, "weeklyResetDay") } : {}),
      ...(b.claudeAwareness !== undefined ? { claudeAwareness: v.bool(b.claudeAwareness, "claudeAwareness") } : {}),
      ...(b.dateOrder !== undefined ? { dateOrder: v.oneOf(b.dateOrder, "dateOrder", ["dmy", "mdy"] as const) } : {}),
    });
  });
}
