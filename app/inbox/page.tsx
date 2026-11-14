"use client";

import { useState } from "react";
import QuickAdd from "@/components/QuickAdd";
import BrainDump from "@/components/inbox/BrainDump";
import FreeThisWeek from "@/components/inbox/FreeThisWeek";
import InboxKpis from "@/components/inbox/InboxKpis";
import InboxList from "@/components/inbox/InboxList";
import { type InboxSort, SORT_LABEL, inboxHeadline, inboxStats, inboxTasks } from "@/components/inbox/inbox-data";
import Button from "@/components/ui/Button";
import Card, { CardHeader } from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import PageHead from "@/components/ui/PageHead";
import { toISODate } from "@/lib/parse";
import { useTasks } from "@/lib/store-context";
import { useNow } from "@/lib/useNow";

export default function InboxPage() {
  const { tasks, ready } = useTasks();
  const now = useNow();
  const todayISO = now ? toISODate(now) : "";
  const [sort, setSort] = useState<InboxSort>("oldest");

  const inbox = inboxTasks(tasks, todayISO, sort);
  const stats = inboxStats(tasks, todayISO);
  const known = ready && todayISO !== "";

  return (
    <PageHead
      title="Inbox"
      dim={known && stats.count > 0 ? `${stats.count} to sort` : undefined}
      subtitle={known ? inboxHeadline(stats) : undefined}
      actions={
        <Button
          variant="chip"
          size="md"
          icon="updown"
          aria-label={`Sort: ${SORT_LABEL[sort]}`}
          onClick={() => setSort((s) => (s === "oldest" ? "newest" : "oldest"))}
        >
          {SORT_LABEL[sort]}
        </Button>
      }
      headerExtra={known && <InboxKpis todayISO={todayISO} />}
      rail={
        <>
          <Card aria-labelledby="inbox-brain-dump-title">
            <CardHeader
              titleId="inbox-brain-dump-title"
              icon={<Icon name="paper" size={16} />}
              title="Brain dump"
              right="One task per line"
            />
            <BrainDump labelledBy="inbox-brain-dump-title" />
          </Card>
          {known && <FreeThisWeek todayISO={todayISO} inbox={inbox} />}
        </>
      }
    >
      <div className="flex min-w-0 flex-col gap-4">
        <QuickAdd
          id="doem-inbox-quick-add"
          defaultScheduled={null}
          autoFocus={false}
          placeholder="Add to the inbox. No day needed."
        />
        <InboxList tasks={inbox} todayISO={todayISO} ready={known} />
      </div>
    </PageHead>
  );
}
