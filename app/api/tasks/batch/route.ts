import { handle, json } from "@/lib/api";
import { store } from "@/lib/store";
import * as v from "@/lib/validate";
import { toInput } from "../_input";

const MAX_ITEMS = 100;

/** Paste-a-list capture: every item is parsed on its own, all created in one transaction. */
export async function POST(request: Request) {
  return handle(async () => {
    const b = v.body(await json(request));
    if (!Array.isArray(b.items) || b.items.length === 0) v.fail("items must be a non-empty list");
    if (b.items.length > MAX_ITEMS) v.fail(`items can hold at most ${MAX_ITEMS}`);
    const fallback = v.optionalNullableIsoDate(b.defaultScheduled, "defaultScheduled");
    const { dateOrder } = await store.getTrackingSettings();

    const inputs = [];
    for (const item of b.items) inputs.push((await toInput(item, { dateOrder, fallback })).input);
    return store.addTasks(inputs);
  }, 201);
}
