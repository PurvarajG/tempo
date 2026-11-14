import { handle, json } from "@/lib/api";
import { store } from "@/lib/store";
import * as v from "@/lib/validate";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(async () => {
    const b = v.body(await json(request));
    return store.splitSegmentAt(v.uuid(id, "id"), v.isoTimestamp(b.at, "at"));
  });
}
