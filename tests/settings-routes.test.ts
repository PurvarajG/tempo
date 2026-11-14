import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { GET, PATCH } from "../app/api/tracking-settings/route";
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

const patch = (value: unknown) => PATCH(req("/api/tracking-settings", body(value, "PATCH")));

test("each new field is accepted and read back", async () => {
  const res = await patch({
    todayCap: 3,
    dockBadge: "none",
    captureShortcut: "Control+Alt+Space",
    nudgeMinutes: 45,
    wrapHour: 18,
    weeklyResetDay: 5,
    claudeAwareness: true,
    dateOrder: "mdy",
  });
  assert.equal(res.status, 200);
  const s = await (await GET()).json();
  assert.equal(s.todayCap, 3);
  assert.equal(s.dockBadge, "none");
  assert.equal(s.captureShortcut, "Control+Alt+Space");
  assert.equal(s.nudgeMinutes, 45);
  assert.equal(s.wrapHour, 18);
  assert.equal(s.weeklyResetDay, 5);
  assert.equal(s.claudeAwareness, true);
  assert.equal(s.dateOrder, "mdy");
});

test("nudgeMinutes can be cleared with null", async () => {
  const res = await patch({ nudgeMinutes: null });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).nudgeMinutes, null);
});

test("invalid values are 400", async () => {
  for (const bad of [
    { todayCap: 2 },
    { todayCap: "3" },
    { dockBadge: "all" },
    { captureShortcut: "Ctrl + !" },
    { nudgeMinutes: 241 },
    { nudgeMinutes: 0 },
    { wrapHour: 24 },
    { weeklyResetDay: 7 },
    { claudeAwareness: "yes" },
    { dateOrder: "ymd" },
  ]) {
    assert.equal((await patch(bad)).status, 400, JSON.stringify(bad));
  }
});

test("existing fields still patch and untouched fields keep their values", async () => {
  const before = await (await GET()).json();
  const res = await patch({ wakingStartHour: 6, wakingEndHour: 22, hiddenNavItems: ["calendar"], moduleOrder: ["now"] });
  assert.equal(res.status, 200);
  const s = await res.json();
  assert.equal(s.wakingStartHour, 6);
  assert.equal(s.wakingEndHour, 22);
  assert.deepEqual(s.hiddenNavItems, ["calendar"]);
  assert.deepEqual(s.moduleOrder, ["now"]);
  assert.equal(s.todayCap, before.todayCap);
  assert.equal(s.dateOrder, before.dateOrder);
  assert.equal((await patch({ wakingStartHour: 99 })).status, 400);
});
