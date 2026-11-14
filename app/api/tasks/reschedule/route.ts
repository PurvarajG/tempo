import { handle, json } from "@/lib/api";
import { store } from "@/lib/store";
import * as v from "@/lib/validate";

/** Moves many tasks to one day, or back to the inbox when `day` is null. */
export async function POST(request: Request) {
  return handle(async () => {
    const b = v.body(await json(request));
    if (b.day === undefined) v.fail("day is required (a date or null)");
    return store.rescheduleTasks(v.uuidList(b.ids, "ids"), v.nullableIsoDate(b.day, "day"));
  });
}
