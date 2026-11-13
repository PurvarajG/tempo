"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Task } from "@/lib/types";
import TaskRow from "@/components/TaskRow";
import Button from "@/components/ui/Button";
import Card, { CardHeader } from "@/components/ui/Card";
import Dialog from "@/components/ui/Dialog";
import EmptyState from "@/components/ui/EmptyState";
import Icon from "@/components/ui/Icon";
import PageHead from "@/components/ui/PageHead";
import { toISODate } from "@/lib/parse";
import { useTasks } from "@/lib/store-context";
import { useNow } from "@/lib/useNow";

export default function TrashPage() {
  const { restoreTask, undoOffer } = useTasks();
  const now = useNow();
  const todayISO = now ? toISODate(now) : "";
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);
  const restored = useRef(false);
  const hadOffer = useRef(false);

  const load = useCallback(
    () =>
      fetch("/api/tasks/trash")
        .then((r) => r.json())
        .then((list: Task[]) => setTasks(list)),
    [],
  );

  // Loaded once on mount (ST-049).
  useEffect(() => {
    load().finally(() => setReady(true));
  }, [load]);

  // When the "Restored" offer closes, an Undo may have trashed the task again,
  // so refetch the list. Harmless after a plain expiry.
  useEffect(() => {
    if (undoOffer) {
      hadOffer.current = true;
      return;
    }
    if (hadOffer.current && restored.current) {
      hadOffer.current = false;
      restored.current = false;
      void load();
    }
  }, [undoOffer, load]);

  async function restore(id: string) {
    restored.current = true;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await restoreTask(id);
  }

  async function deleteForever() {
    if (!pending || deleting) return;
    const id = pending.id;
    setDeleting(true);
    try {
      await fetch(`/api/tasks/${id}/forever`, { method: "DELETE" });
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } finally {
      setDeleting(false);
      setPending(null);
    }
  }

  const subtitle = !ready
    ? undefined
    : tasks.length === 0
      ? "Nothing in the trash."
      : `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"} in the trash.`;

  return (
    <PageHead title="Trash" subtitle={subtitle}>
      <div className="max-w-3xl">
      <Card aria-labelledby="trash-title">
        <CardHeader
          titleId="trash-title"
          icon={<Icon name="trash" size={16} />}
          title="Trash"
          count={ready ? tasks.length : undefined}
        />
        {ready && tasks.length > 0 && (
          <ul className="task-list px-2 pb-2">
            {tasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                todayISO={todayISO}
                hideCheckbox
                actions={
                  <>
                    <Button variant="ghost" size="sm" onClick={() => void restore(t.id)}>
                      Restore
                    </Button>
                    <Button variant="ghost" size="sm" tone="danger" onClick={() => setPending(t)}>
                      Delete forever
                    </Button>
                  </>
                }
              />
            ))}
          </ul>
        )}
        {ready && tasks.length === 0 && <EmptyState title="Nothing in the trash." />}
      </Card>
      </div>

      <Dialog
        open={pending !== null}
        onClose={() => setPending(null)}
        role="alertdialog"
        title={`Delete “${pending?.title ?? ""}” forever?`}
        description="This cannot be undone."
        actions={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button variant="primary" tone="danger" onClick={() => void deleteForever()}>
              Delete forever
            </Button>
          </>
        }
      />
    </PageHead>
  );
}
