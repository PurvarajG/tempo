import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { freshDb, type TestDb } from "./helpers/db";

const secret = "feed-secret-that-is-long-enough";

let db: TestDb;
let GET: (request: Request) => Promise<Response>;

before(async () => {
  db = await freshDb();
  // Imported only after freshDb has pointed the store at a throwaway database.
  ({ GET } = await import("../app/api/calendar-feed/route"));
});
after(async () => db.close());

test.beforeEach(() => {
  process.env.CALENDAR_FEED_SECRET = secret;
});
test.afterEach(() => {
  delete process.env.CALENDAR_FEED_SECRET;
});

function request(query = ""): Request {
  return new Request(`https://app.test/api/calendar-feed${query}`);
}

test("an unconfigured feed is unavailable rather than open", async () => {
  delete process.env.CALENDAR_FEED_SECRET;
  const response = await GET(request(`?token=${secret}`));
  assert.equal(response.status, 503);
});

test("an empty secret is treated as unconfigured, not as a valid token", async () => {
  process.env.CALENDAR_FEED_SECRET = "";
  assert.equal((await GET(request())).status, 503);
  assert.equal((await GET(request("?token="))).status, 503);
});

test("a missing or wrong token is rejected", async () => {
  assert.equal((await GET(request())).status, 401);
  assert.equal((await GET(request("?token="))).status, 401);
  assert.equal((await GET(request("?token=nope"))).status, 401);
  assert.equal((await GET(request(`?token=${secret}x`))).status, 401);
});

test("the correct token serves the open tasks as an iCalendar feed", async () => {
  const open = await db.store.addTask({
    title: "Feed me",
    scheduled: "2026-03-01",
    minutes: 30,
    priority: 0,
  });
  const done = await db.store.addTask({
    title: "Already finished",
    scheduled: "2026-03-01",
    minutes: 30,
    priority: 0,
  });
  await db.store.completeTask(done.id);

  const response = await GET(request(`?token=${encodeURIComponent(secret)}`));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/calendar; charset=utf-8");

  const body = await response.text();
  assert.ok(body.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(body.includes(`UID:${open.id}@dayplan`));
  assert.ok(body.includes("Feed me"));
  assert.ok(!body.includes("Already finished"), "completed tasks drop off the feed");
});

test("the feed is never cached by an intermediary", async () => {
  const response = await GET(request(`?token=${secret}`));
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
});

test("an undated task does not break the feed and is left out of it", async () => {
  const undated = await db.store.addTask({
    title: "Inbox thought",
    scheduled: null,
    minutes: 30,
    priority: 0,
  });

  const response = await GET(request(`?token=${encodeURIComponent(secret)}`));
  assert.equal(response.status, 200);

  const body = await response.text();
  assert.ok(body.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(body.endsWith("END:VCALENDAR\r\n"));
  assert.ok(!body.includes(undated.id));
  assert.ok(!body.includes("Inbox thought"));
});
