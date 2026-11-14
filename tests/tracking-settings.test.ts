import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { freshDb, type TestDb } from "./helpers/db";

let db: TestDb;

before(async () => {
  db = await freshDb();
});
after(async () => db.close());

test("fresh db returns the v2 settings defaults", async () => {
  const s = await db.store.getTrackingSettings();
  assert.equal(s.todayCap, 3);
  assert.equal(s.dockBadge, "today");
  assert.equal(s.captureShortcut, "Control+Alt+Space");
  assert.equal(s.nudgeMinutes, null);
  assert.equal(s.wrapHour, 17);
  assert.equal(s.weeklyResetDay, 0);
  assert.equal(s.claudeAwareness, false);
  assert.equal(s.dateOrder, "dmy");
});

test("each new field patches and reads back", async () => {
  const s = await db.store.updateTrackingSettings({
    todayCap: 5,
    dockBadge: "none",
    captureShortcut: "Command+Shift+K",
    nudgeMinutes: 45,
    wrapHour: 18,
    weeklyResetDay: 1,
    claudeAwareness: true,
    dateOrder: "mdy",
  });
  assert.equal(s.todayCap, 5);
  assert.equal(s.dockBadge, "none");
  assert.equal(s.captureShortcut, "Command+Shift+K");
  assert.equal(s.nudgeMinutes, 45);
  assert.equal(s.wrapHour, 18);
  assert.equal(s.weeklyResetDay, 1);
  assert.equal(s.claudeAwareness, true);
  assert.equal(s.dateOrder, "mdy");
  const again = await db.store.getTrackingSettings();
  assert.equal(again.todayCap, 5);
  assert.equal(again.dateOrder, "mdy");
});

test("nudgeMinutes can be set and then cleared with null", async () => {
  const on = await db.store.updateTrackingSettings({ nudgeMinutes: 30 });
  assert.equal(on.nudgeMinutes, 30);
  const off = await db.store.updateTrackingSettings({ nudgeMinutes: null });
  assert.equal(off.nudgeMinutes, null);
  assert.equal((await db.store.getTrackingSettings()).nudgeMinutes, null);
});

test("patching one field leaves the others untouched", async () => {
  await db.store.updateTrackingSettings({
    wakingEndHour: 22,
    hiddenNavItems: ["trash"],
    todayCap: 1,
    wrapHour: 16,
  });
  const s = await db.store.updateTrackingSettings({ dockBadge: "none" });
  assert.equal(s.dockBadge, "none");
  assert.equal(s.todayCap, 1);
  assert.equal(s.wrapHour, 16);
  assert.equal(s.wakingEndHour, 22);
  assert.deepEqual(s.hiddenNavItems, ["trash"]);
  const s2 = await db.store.updateTrackingSettings({ wakingEndHour: 21 });
  assert.equal(s2.dockBadge, "none");
  assert.equal(s2.todayCap, 1);
});
