import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { GET, PUT } from "../app/api/day-reviews/route";
import { freshDb, type TestDb } from "./helpers/db";

let db: TestDb;
before(async () => {
  db = await freshDb();
});
after(async () => db.close());

function req(url: string, init?: RequestInit): Request {
  return new Request(`https://app.test${url}`, init);
}

function body(value: unknown, method = "POST"): RequestInit {
  return { method, body: JSON.stringify(value), headers: { "content-type": "application/json" } };
}

test("PUT saves a review and GET by day returns it", async () => {
  const put = await PUT(req("/api/day-reviews", body({ day: "2026-05-01", energy: 2, note: "ok day" }, "PUT")));
  assert.equal(put.status, 200);
  const got = await GET(req("/api/day-reviews?day=2026-05-01"));
  assert.equal(got.status, 200);
  const r = await got.json();
  assert.equal(r.energy, 2);
  assert.equal(r.note, "ok day");
});

test("PUT again overwrites, and null clears energy and note", async () => {
  await PUT(req("/api/day-reviews", body({ day: "2026-05-01", energy: null, note: null }, "PUT")));
  const r = await (await GET(req("/api/day-reviews?day=2026-05-01"))).json();
  assert.equal(r.energy, null);
  assert.equal(r.note, null);
});

test("GET by range lists reviews oldest first", async () => {
  await PUT(req("/api/day-reviews", body({ day: "2026-05-03", energy: 3, note: null }, "PUT")));
  await PUT(req("/api/day-reviews", body({ day: "2026-05-02", energy: 1, note: "x" }, "PUT")));
  const res = await GET(req("/api/day-reviews?from=2026-05-01&to=2026-05-03"));
  const list = await res.json();
  assert.deepEqual(list.map((d: { day: string }) => d.day), ["2026-05-01", "2026-05-02", "2026-05-03"]);
});

test("GET for a day with no review is 404; no params is 400", async () => {
  assert.equal((await GET(req("/api/day-reviews?day=2030-01-01"))).status, 404);
  assert.equal((await GET(req("/api/day-reviews"))).status, 400);
  assert.equal((await GET(req("/api/day-reviews?from=2026-05-01"))).status, 400);
});

test("PUT rejects a bad energy, bad day, and an over-long note", async () => {
  for (const bad of [
    { day: "2026-05-01", energy: 4, note: null },
    { day: "2026-05-01", energy: "high", note: null },
    { day: "nope", energy: 1, note: null },
    { day: "2026-05-01", energy: 1, note: "x".repeat(2001) },
  ]) {
    assert.equal((await PUT(req("/api/day-reviews", body(bad, "PUT")))).status, 400, JSON.stringify(bad).slice(0, 60));
  }
});
