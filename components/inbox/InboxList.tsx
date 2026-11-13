"use client";

import Icon from "@/components/ui/Icon";
import Card, { CardHeader } from "@/components/ui/Card";
import { fmtHours } from "@/lib/format";
import type { Task } from "@/lib/types";
import InboxRow from "./InboxRow";
import { groupInbox } from "./inbox-data";

/** One Inbox card (soft.html 618-646): tray header, then a small header line per group and open rows. */
export default function InboxList({
  tasks,
  todayISO,
  ready,
}: {
  tasks: Task[];
  todayISO: string;
  ready: boolean;
}) {
  const groups = groupInbox(tasks, todayISO);
  return (
    <Card aria-labelledby="inbox-title">
      <CardHeader
        titleId="inbox-title"
        icon={<Icon name="inbox" size={16} />}
        title="Inbox"
        count={ready ? tasks.length : undefined}
        right="Pick a day for each, or move it to trash"
      />
      {ready && groups.length === 0 ? (
        <p className="px-4 pb-4 pt-1 text-body text-ink-3">Nothing waiting for a day.</p>
      ) : null}
      {ready
        ? groups.map((g, i) => (
            <div key={g.key} data-group={g.key}>
              <div
                className={`flex items-center justify-between px-3 pb-1 text-meta text-ink-3 ${i === 0 ? "pt-1" : "pt-4"}`}
              >
                <span>{`${g.label}, ${g.tasks.length}`}</span>
                <span className="font-mono">{fmtHours(g.minutes)}</span>
              </div>
              <ul className="task-list px-2 pb-2">
                {g.tasks.map((t) => (
                  <InboxRow key={t.id} task={t} todayISO={todayISO} />
                ))}
              </ul>
            </div>
          ))
        : null}
    </Card>
  );
}
