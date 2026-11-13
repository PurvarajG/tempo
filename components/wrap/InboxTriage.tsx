"use client";

import InboxRow from "@/components/inbox/InboxRow";
import Card, { CardHeader } from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import { isHiddenUntil } from "@/lib/next";
import { useTasks } from "@/lib/store-context";

/** Weekly reset: every undated task, each to be given a day or trashed. */
export default function InboxTriage({ todayISO }: { todayISO: string }): React.ReactElement {
  const { tasks, ready } = useTasks();

  const inbox = tasks
    .filter((t) => t.status === "open" && t.scheduled === null && !isHiddenUntil(t, todayISO))
    .map((t, i) => ({ t, i }))
    .sort((a, b) => Number(b.t.priority === 1) - Number(a.t.priority === 1) || a.i - b.i)
    .map(({ t }) => t);

  return (
    <Card aria-labelledby="wrap-inbox-title">
      <CardHeader
        titleId="wrap-inbox-title"
        icon={<Icon name="paper" size={16} />}
        title="Inbox"
        count={ready ? inbox.length : undefined}
        right="Give each a day or trash it"
      />
      {ready && inbox.length > 0 && (
        <ul className="task-list px-2 pb-2">
          {inbox.map((t) => (
            <InboxRow key={t.id} task={t} todayISO={todayISO} />
          ))}
        </ul>
      )}
      {ready && inbox.length === 0 && <p className="px-4 pb-4 text-secondary text-ink-3">Inbox is empty.</p>}
    </Card>
  );
}
