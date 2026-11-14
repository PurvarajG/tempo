import { handle, json } from "@/lib/api";
import { store } from "@/lib/store";
import * as v from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => {
    const b = v.body(await json(request));
    return store.updateStage(v.uuid(id, "column id"), {
      ...(b.name !== undefined ? { name: v.nonEmpty(b.name, "Column name", 80) } : {}),
      ...(b.kind !== undefined ? { kind: v.stageKind(b.kind, "kind") } : {}),
      ...(b.wipLimit !== undefined ? { wipLimit: v.nullablePositiveInt(b.wipLimit, "wipLimit", 99) } : {}),
    });
  });
}

/**
 * Deleting a column always states where its tasks go — there is no silent
 * destination, so work can't vanish with the column.
 */
export async function DELETE(request: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => {
    const destination = new URL(request.url).searchParams.get("moveTo");
    if (!destination) v.fail("Choose a column to move the tasks to");
    const removed = await store.removeStage(
      v.uuid(id, "column id"),
      v.uuid(destination, "moveTo"),
    );
    return removed ? { ok: true } : null;
  });
}
