import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { LinkInvalid } from "../lib/store/task-links";
import { TaskInvariantError } from "../lib/store/tasks";
import { freshDb, type TestDb } from "./helpers/db";

let db: TestDb;
before(async () => {
  db = await freshDb();
});
after(async () => db.close());

async function mk(title: string) {
  return db.store.addTask({ title, scheduled: "2026-03-01", minutes: 30, priority: 0 });
}

test("link shows up as blockedBy on getTask and allTasks; duplicate is a no-op", async () => {
  const a = await mk("a");
  const b = await mk("b");
  assert.equal(await db.store.linkBlocker(a.id, b.id), true);
  assert.equal(await db.store.linkBlocker(a.id, b.id), true);
  assert.deepEqual((await db.store.getTask(b.id))?.blockedBy, [a.id]);
  const all = await db.store.allTasks();
  assert.deepEqual(all.find((t) => t.id === b.id)?.blockedBy, [a.id]);
  assert.deepEqual(all.find((t) => t.id === a.id)?.blockedBy ?? [], []);
});

test("a missing task returns false", async () => {
  const a = await mk("solo");
  assert.equal(await db.store.linkBlocker(a.id, randomUUID()), false);
  assert.equal(await db.store.linkBlocker(randomUUID(), a.id), false);
});

test("a trashed blocker disappears from blockedBy and returns on restore", async () => {
  const a = await mk("blocker");
  const b = await mk("blocked");
  await db.store.linkBlocker(a.id, b.id);
  await db.store.trashTask(a.id);
  assert.deepEqual((await db.store.getTask(b.id))?.blockedBy ?? [], []);
  await db.store.restoreTask(a.id);
  assert.deepEqual((await db.store.getTask(b.id))?.blockedBy, [a.id]);
});

test("unlink removes the link and reports whether a row existed", async () => {
  const a = await mk("u1");
  const b = await mk("u2");
  await db.store.linkBlocker(a.id, b.id);
  assert.equal(await db.store.unlinkBlocker(a.id, b.id), true);
  assert.equal(await db.store.unlinkBlocker(a.id, b.id), false);
  assert.deepEqual((await db.store.getTask(b.id))?.blockedBy ?? [], []);
});

test("self-link and cycles are rejected as LinkInvalid (a TaskInvariantError)", async () => {
  const a = await mk("c1");
  const b = await mk("c2");
  const c = await mk("c3");
  await assert.rejects(() => db.store.linkBlocker(a.id, a.id), LinkInvalid);
  await db.store.linkBlocker(a.id, b.id);
  await db.store.linkBlocker(b.id, c.id);
  await assert.rejects(() => db.store.linkBlocker(b.id, a.id), LinkInvalid);
  await assert.rejects(() => db.store.linkBlocker(c.id, a.id), TaskInvariantError);
  assert.equal(await db.store.linkBlocker(a.id, c.id), true, "a diamond is not a cycle");
});

test("deleting either task forever removes its links", async () => {
  const a = await mk("d1");
  const b = await mk("d2");
  const c = await mk("d3");
  await db.store.linkBlocker(a.id, b.id);
  await db.store.linkBlocker(c.id, a.id);
  await db.store.deleteTaskForever(a.id);
  const left = await db.query<{ n: number }>(
    `select count(*)::int as n from task_links where blocker_id = $1 or blocked_id = $1 or blocker_id = $2`,
    [a.id, c.id],
  );
  assert.equal(left[0].n, 0);
  assert.deepEqual((await db.store.getTask(b.id))?.blockedBy ?? [], []);
});

test("blockedTasksOf lists only open blocked tasks", async () => {
  const a = await mk("o1");
  const b = await mk("o2");
  const c = await mk("o3");
  const d = await mk("o4");
  for (const x of [b, c, d]) await db.store.linkBlocker(a.id, x.id);
  await db.store.trashTask(c.id);
  await db.query(`update tasks set status = 'done' where id = $1`, [d.id]);
  assert.deepEqual(await db.store.blockedTasksOf(a.id), [b.id]);
  assert.deepEqual(await db.store.blockedTasksOf(b.id), []);
});
