"use client";

import { useTasks } from "@/lib/store-context";
import { BELOW_MODULES, MODULE_TITLE } from "@/lib/tracking-modules";
import { useDragReorder } from "@/lib/useDragReorder";
import Toggle from "@/components/ui/Toggle";

const BELOW = BELOW_MODULES as readonly string[];

/** Drag to reorder, toggle to hide. Only the cards drawn below Records are listed;
 *  the other stored keys are kept in moduleOrder untouched. */
export default function ModuleOrderSection() {
  const { settings, patchSettings } = useTasks();
  const stored = settings?.moduleOrder ?? [];
  // Hooks can't follow an early return, so the fallback keeps this call
  // unconditional even though the parent page never renders this section
  // before settings has loaded.
  const belowKeys = [
    ...stored.filter((key) => BELOW.includes(key)),
    ...BELOW_MODULES.filter((key) => !stored.includes(key)),
  ];
  const rows = belowKeys.map((key) => ({ id: key, key }));
  const { list, dragHandleProps } = useDragReorder(rows, (ordered) =>
    patchSettings({ moduleOrder: [...ordered, ...stored.filter((key) => !BELOW.includes(key))] }),
  );
  if (!settings) return null;

  return (
    <ul className="task-list px-2 pb-2">
      {list.map(({ key }) => {
        const hidden = settings.hiddenModules.includes(key);
        const title = MODULE_TITLE[key] ?? key;
        return (
          <li
            key={key}
            {...dragHandleProps(key)}
            className="flex cursor-grab items-center gap-3 rounded-row p-3 transition-colors duration-150 ease-out hover:bg-row-hover active:cursor-grabbing"
          >
            <span className="shrink-0 text-ink-dim" aria-hidden>
              <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
                <circle cx="3" cy="3" r="1.3" />
                <circle cx="9" cy="3" r="1.3" />
                <circle cx="3" cy="8" r="1.3" />
                <circle cx="9" cy="8" r="1.3" />
                <circle cx="3" cy="13" r="1.3" />
                <circle cx="9" cy="13" r="1.3" />
              </svg>
            </span>
            <span className={`min-w-0 flex-1 truncate text-body font-medium ${hidden ? "text-ink-3" : ""}`}>
              {title}
            </span>
            <span className="text-meta text-ink-3">{hidden ? "Hidden" : "Shown"}</span>
            <Toggle
              on={!hidden}
              label={hidden ? `Show ${title}` : `Hide ${title}`}
              onChange={() =>
                patchSettings({
                  hiddenModules: hidden
                    ? settings.hiddenModules.filter((k) => k !== key)
                    : [...settings.hiddenModules, key],
                })
              }
            />
          </li>
        );
      })}
    </ul>
  );
}
