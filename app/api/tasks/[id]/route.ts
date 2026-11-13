import { handle, json } from "@/lib/api";
import { store } from "@/lib/store";
import type { TaskInput } from "@/lib/types";
import * as v from "@/lib/validate";

/** The one patch path used by the detail panel, Kanban, Calendar, and lists. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  const { id } = await ctx.params;
  return handle(async () => {
    const b = v.body(await json(request));
    const patch: Partial<TaskInput> = {};

    if (b.title !== undefined) patch.title = v.nonEmpty(b.title, "Title", 500);
    if (b.notes !== undefined) patch.notes = v.str(b.notes, "Notes");
    if (b.scheduled !== undefined) patch.scheduled = v.nullableIsoDate(b.scheduled, "scheduled");
    if (b.startOn !== undefined) patch.startOn = v.optionalNullableIsoDate(b.startOn, "startOn");
    if (b.expiresOn !== undefined) patch.expiresOn = v.optionalNullableIsoDate(b.expiresOn, "expiresOn");
    if (b.committedOn !== undefined) patch.committedOn = v.optionalNullableIsoDate(b.committedOn, "committedOn");
    if (b.dueTime !== undefined) patch.dueTime = v.optionalTime(b.dueTime, "dueTime") ?? "";
    if (b.isComplex !== undefined) patch.isComplex = v.bool(b.isComplex, "isComplex");
    if (b.finishDate !== undefined) {
      patch.finishDate = b.finishDate ? v.isoDate(b.finishDate, "finishDate") : undefined;
    }
    if (b.minutes !== undefined) patch.minutes = v.duration(b.minutes, "minutes");
    if (b.priority !== undefined) patch.priority = v.priority(b.priority, "priority");
    if (b.tags !== undefined) patch.tags = v.tags(b.tags, "tags");
    // Empty string is meaningful here: it clears the project or the column.
    if (b.projectId !== undefined) patch.projectId = v.optionalUuid(b.projectId, "projectId") ?? "";
    if (b.stageId !== undefined) patch.stageId = v.optionalUuid(b.stageId, "stageId") ?? "";

    if (b.recurrence !== undefined) {
      patch.recurrence = b.recurrence === null ? undefined : v.recurrence(b.recurrence, "recurrence");
    }

    return store.updateTask(v.uuid(id, "task id"), patch);
  });
}

/** Soft delete — moves the task to Trash. Use /forever to remove it for good. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  const { id } = await ctx.params;
  return handle(async () => {
    const removed = await store.trashTask(v.uuid(id, "task id"));
    return removed ? { ok: true } : null;
  });
}
