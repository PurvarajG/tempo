"use client";

import { Fragment } from "react";
import Dialog from "@/components/ui/Dialog";
import Kbd from "@/components/ui/Kbd";
import { GLOBAL_SHORTCUTS, SHORTCUTS } from "@/lib/shortcuts";

const ROW = "flex items-center justify-between gap-4 rounded-row p-3";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="px-3 pb-1 pt-4 text-meta font-normal text-ink-3">{title}</h3>
      <ul className="task-list">{children}</ul>
    </section>
  );
}

/** Presentational. KeyboardShortcuts owns the open state and renders this. */
export default function ShortcutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Keyboard shortcuts"
      description="Task keys work when you are not typing in a field."
    >
      <div className="-mt-4 max-h-[60vh] overflow-y-auto">
        <Group title="Task rows">
          {SHORTCUTS.map((s) => (
            <li key={s.action} className={ROW}>
              <span className="text-secondary text-ink-2">{s.label}</span>
              <span className="flex items-center gap-2">
                {s.keys.map((key, i) => (
                  <Fragment key={key}>
                    {i > 0 && <span className="text-meta text-ink-3">or</span>}
                    <Kbd>{key}</Kbd>
                  </Fragment>
                ))}
              </span>
            </li>
          ))}
        </Group>
        <Group title="Anywhere">
          {GLOBAL_SHORTCUTS.map((s) => (
            <li key={s.label} className={ROW}>
              <span className="text-secondary text-ink-2">{s.label}</span>
              <Kbd keys={[...s.keys]} />
            </li>
          ))}
        </Group>
      </div>
    </Dialog>
  );
}
