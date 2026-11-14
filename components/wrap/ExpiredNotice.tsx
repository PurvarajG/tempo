"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import { useTasks } from "@/lib/store-context";
import type { Task } from "@/lib/types";

export default function ExpiredNotice({ todayISO }: { todayISO: string }) {
  const { expireDueTasks, restoreTask, patchTask } = useTasks();
  const [expired, setExpired] = useState<Task[]>([]);
  const askedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!todayISO || askedFor.current === todayISO) return;
    askedFor.current = todayISO;
    void expireDueTasks(todayISO).then((moved) => {
      if (moved.length > 0) setExpired(moved);
    });
  }, [todayISO, expireDueTasks]);

  if (!todayISO || expired.length === 0) return null;

  async function undo() {
    const list = expired;
    for (const task of list) {
      await restoreTask(task.id);
      await patchTask(task.id, { expiresOn: null });
    }
    setExpired([]);
  }

  const count = expired.length;
  return (
    <Card>
      <div className="flex items-center gap-3 px-4 py-3">
        <Icon name="trash" size={14} className="shrink-0 text-ink-3" />
        <div className="min-w-0 flex-1">
          <p className="text-body text-ink-2">
            {count === 1 ? "1 task expired." : `${count} tasks expired.`}
          </p>
          <p className="truncate text-meta text-ink-3">{expired.map((t) => t.title).join(", ")}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void undo()}>
          Undo
        </Button>
      </div>
    </Card>
  );
}
