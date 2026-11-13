import { handle, json } from "@/lib/api";
import { store } from "@/lib/store";
import { toISODate } from "@/lib/parse";
import * as v from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Graduates a checklist item into a full task scheduled for today (or the inbox when `scheduled` is null), using the
 * app's existing defaults. The source item is removed in the same transaction,
 * so a failure leaves the checklist exactly as it was.
 */
export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => {
    const b = v.body(await json(request).catch(() => ({})));
    return store.convertQuickTodo(v.uuid(id, "id"), {
      title: b.title !== undefined ? v.nonEmpty(b.title, "Title", 300) : undefined,
      projectId: v.optionalUuid(b.projectId, "projectId"),
      scheduled: b.scheduled !== undefined ? v.nullableIsoDate(b.scheduled, "scheduled") : toISODate(new Date()),
      minutes: b.minutes !== undefined ? v.duration(b.minutes, "minutes") : 30,
      priority: b.priority !== undefined ? v.priority(b.priority, "priority") : 0,
    });
  }, 201);
}
