import { handle, json } from "@/lib/api";
import { CommitCapReached, store } from "@/lib/store";
import * as v from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

/** Commit a task to a day. A full day answers 409 with the tasks already there, for "Swap with...". */
export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  let full: CommitCapReached | null = null;
  const res = await handle(async () => {
    const b = v.body(await json(request));
    try {
      return await store.commitTask(v.uuid(id, "task id"), v.isoDate(b.day, "day"));
    } catch (error) {
      if (!(error instanceof CommitCapReached)) throw error;
      full = error;
      return {};
    }
  });
  const cap = full as CommitCapReached | null;
  if (cap) return Response.json({ error: cap.message, committed: cap.committed }, { status: 409 });
  return res;
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => store.uncommitTask(v.uuid(id, "task id")));
}
