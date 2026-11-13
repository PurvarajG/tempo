import { handle, json } from "@/lib/api";
import { store } from "@/lib/store";
import * as v from "@/lib/validate";

/** Trashes open tasks whose expiry day has arrived and returns them. */
export async function POST(request: Request) {
  return handle(async () => {
    const b = v.body(await json(request));
    return store.expireDueTasks(v.isoDate(b.today, "today"));
  });
}
