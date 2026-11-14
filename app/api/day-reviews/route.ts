import { handle, json } from "@/lib/api";
import { store } from "@/lib/store";
import * as v from "@/lib/validate";

export async function GET(request: Request) {
  return handle(async () => {
    const q = new URL(request.url).searchParams;
    const day = q.get("day");
    if (day !== null) return store.getDayReview(v.isoDate(day, "day"));
    const from = q.get("from");
    const to = q.get("to");
    if (from === null || to === null) v.fail("Pass day, or both from and to");
    return store.listDayReviews(v.isoDate(from, "from"), v.isoDate(to, "to"));
  });
}

export async function PUT(request: Request) {
  return handle(async () => {
    const b = v.body(await json(request));
    const note = b.note === null || b.note === undefined ? null : v.str(b.note, "note");
    if (note !== null && note.length > 2000) v.fail("note must be 2000 characters or fewer");
    return store.saveDayReview(v.isoDate(b.day, "day"), {
      energy: v.energy(b.energy === undefined ? null : b.energy, "energy"),
      note,
    });
  });
}
