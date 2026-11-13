import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { freshDb, type TestDb } from "./helpers/db";

let db: TestDb;
before(async () => {
  db = await freshDb();
});
after(async () => db.close());

test("a missing day returns null", async () => {
  assert.equal(await db.store.getDayReview("2026-01-01"), null);
});

test("save then get round-trips; saving again overwrites", async () => {
  const saved = await db.store.saveDayReview("2026-02-10", { energy: 2, note: "ok day" });
  assert.equal(saved.day, "2026-02-10");
  assert.equal(saved.energy, 2);
  assert.equal(saved.note, "ok day");
  assert.ok(saved.updatedAt);
  const again = await db.store.saveDayReview("2026-02-10", { energy: 3, note: null });
  assert.equal(again.energy, 3);
  assert.equal(again.note, null);
  assert.deepEqual(await db.store.getDayReview("2026-02-10"), again);
  assert.equal((await db.store.listDayReviews("2026-02-10", "2026-02-10")).length, 1);
});

test("energy may be null", async () => {
  const r = await db.store.saveDayReview("2026-02-11", { energy: null, note: "just a note" });
  assert.equal(r.energy, null);
  assert.equal((await db.store.getDayReview("2026-02-11"))?.note, "just a note");
});

test("list range is inclusive and ordered by day", async () => {
  for (const d of ["2026-03-05", "2026-03-03", "2026-03-04", "2026-03-06", "2026-03-02"]) {
    await db.store.saveDayReview(d, { energy: 1, note: d });
  }
  const got = await db.store.listDayReviews("2026-03-03", "2026-03-05");
  assert.deepEqual(got.map((r) => r.day), ["2026-03-03", "2026-03-04", "2026-03-05"]);
});
