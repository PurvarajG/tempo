import { handle, json } from "@/lib/api";
import { store } from "@/lib/store";
import * as v from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

/** "blockerId blocks this task". Returns the blocked task with its blockedBy list. */
export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => {
    const b = v.body(await json(request));
    const blockedId = v.uuid(id, "task id");
    const linked = await store.linkBlocker(v.uuid(b.blockerId, "blockerId"), blockedId);
    return linked ? store.getTask(blockedId) : null;
  }, 200);
}

export async function DELETE(request: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => {
    const blockedId = v.uuid(id, "task id");
    const blockerId = v.uuid(new URL(request.url).searchParams.get("blockerId"), "blockerId");
    await store.unlinkBlocker(blockerId, blockedId);
    return store.getTask(blockedId);
  });
}
