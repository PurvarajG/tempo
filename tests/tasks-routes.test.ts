import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { POST as convertQuickTodo } from "../app/api/quick-todos/[id]/convert/route";
import { DELETE as uncommit, POST as commit } from "../app/api/tasks/[id]/commit/route";
import { DELETE as unlink, POST as link } from "../app/api/tasks/[id]/links/route";
import { PATCH as patchTask } from "../app/api/tasks/[id]/route";
import { POST as batch } from "../app/api/tasks/batch/route";
import { POST as expire } from "../app/api/tasks/expire/route";
import { POST as reschedule } from "../app/api/tasks/reschedule/route";
import { POST as addTask } from "../app/api/tasks/route";
import { toISODate } from "../lib/parse";
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
function idCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}
const today = toISODate(new Date());
const post = (value: unknown) => addTask(req("/api/tasks", body(value)));

test("text with no day token lands today; body scheduled null lands in the inbox", async () => {
  const a = await post({ text: "plain task" });
  assert.equal(a.status, 201);
  assert.equal((await a.json()).scheduled, today);

  const b = await (await post({ text: "later thing", scheduled: null })).json();
  assert.equal(b.scheduled, null);

  const c = await (await post({ text: "tidy desk nodate" })).json();
  assert.equal(c.scheduled, null);
  assert.equal(c.title, "tidy desk");
});

test("explicit path needs a scheduled key, null allowed", async () => {
  assert.equal((await post({ title: "x", minutes: 30 })).status, 400);
  const ok = await post({ title: "x", minutes: 30, scheduled: null });
  assert.equal(ok.status, 201);
  assert.equal((await ok.json()).scheduled, null);
});

test("from: and until: are stored", async () => {
  const t = await (await post({ text: "hidden then gone from:2030-01-10 until:2030-02-01 2030-01-12" })).json();
  assert.equal(t.startOn, "2030-01-10");
  assert.equal(t.expiresOn, "2030-02-01");
});

test("a lone * commits to today, and reports capReached when the day is full", async () => {
  const first = await (await post({ text: "star one *" })).json();
  assert.equal(first.committedOn, today);
  await post({ text: "star two *" });
  await post({ text: "star three *" });
  const over = await post({ text: "star four *" });
  assert.equal(over.status, 201);
  const task = await over.json();
  assert.equal(task.capReached, true);
  assert.equal(task.committedOn ?? null, null);
});

test("batch creates items in order and rejects an empty list", async () => {
  const res = await batch(
    req("/api/tasks/batch", body({ items: [{ text: "one" }, { text: "two tomorrow" }, { text: "three" }], defaultScheduled: null })),
  );
  assert.equal(res.status, 201);
  const out = await res.json();
  assert.deepEqual(out.map((t: { title: string }) => t.title), ["one", "two", "three"]);
  assert.equal(out[0].scheduled, null);
  assert.notEqual(out[1].scheduled, null);

  assert.equal((await batch(req("/api/tasks/batch", body({ items: [] })))).status, 400);
});

test("reschedule moves to a day and back to the inbox", async () => {
  const t = await (await post({ text: "move me" })).json();
  const day = await (await reschedule(req("/api/tasks/reschedule", body({ ids: [t.id], day: "2030-05-05" })))).json();
  assert.equal(day[0].scheduled, "2030-05-05");
  const inbox = await (await reschedule(req("/api/tasks/reschedule", body({ ids: [t.id], day: null })))).json();
  assert.equal(inbox[0].scheduled, null);
});

test("commit 409 lists the committed tasks at cap; uncommit clears", async () => {
  const day = "2031-03-03";
  const ids: string[] = [];
  for (let i = 0; i < 4; i++) ids.push((await (await post({ title: `c${i}`, minutes: 30, scheduled: day })).json()).id);
  for (let i = 0; i < 3; i++) {
    const ok = await commit(req(`/api/tasks/${ids[i]}/commit`, body({ day })), idCtx(ids[i]));
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).committedOn, day);
  }
  const full = await commit(req(`/api/tasks/${ids[3]}/commit`, body({ day })), idCtx(ids[3]));
  assert.equal(full.status, 409);
  const j = await full.json();
  assert.equal(j.committed.length, 3);
  assert.ok(j.error);

  const un = await uncommit(req(`/api/tasks/${ids[0]}/commit`, { method: "DELETE" }), idCtx(ids[0]));
  assert.equal((await un.json()).committedOn ?? null, null);

  const missing = "00000000-0000-4000-8000-000000000000";
  assert.equal((await commit(req(`/api/tasks/${missing}/commit`, body({ day })), idCtx(missing))).status, 404);
});

test("link and unlink, and a self-link is 400", async () => {
  const a = await (await post({ text: "blocker" })).json();
  const b = await (await post({ text: "blocked" })).json();
  const linked = await link(req(`/api/tasks/${b.id}/links`, body({ blockerId: a.id })), idCtx(b.id));
  assert.equal(linked.status, 200);
  assert.deepEqual((await linked.json()).blockedBy, [a.id]);

  const self = await link(req(`/api/tasks/${a.id}/links`, body({ blockerId: a.id })), idCtx(a.id));
  assert.equal(self.status, 400);

  const gone = await unlink(req(`/api/tasks/${b.id}/links?blockerId=${a.id}`, { method: "DELETE" }), idCtx(b.id));
  assert.deepEqual((await gone.json()).blockedBy, []);
});

test("expire trashes due tasks", async () => {
  const t = await (await post({ title: "short lived", minutes: 30, scheduled: "2020-01-01", expiresOn: "2020-01-02" })).json();
  const res = await expire(req("/api/tasks/expire", body({ today: "2020-01-02" })));
  assert.deepEqual((await res.json()).map((x: { id: string }) => x.id), [t.id]);
});

test("PATCH accepts scheduled null and recurrence with from", async () => {
  const t = await (await post({ text: "patch me" })).json();
  const a = await patchTask(req(`/api/tasks/${t.id}`, body({ scheduled: null }, "PATCH")), idCtx(t.id));
  assert.equal((await a.json()).scheduled, null);

  const b = await patchTask(
    req(`/api/tasks/${t.id}`, body({ scheduled: today, recurrence: { freq: "weekly", interval: 1, from: "done" } }, "PATCH")),
    idCtx(t.id),
  );
  assert.equal(b.status, 200);
  assert.equal((await b.json()).recurrence.from, "done");

  const bad = await patchTask(req(`/api/tasks/${t.id}`, body({ recurrence: { freq: "daily", from: "x" } }, "PATCH")), idCtx(t.id));
  assert.equal(bad.status, 400);
});

test("converting a quick to-do can send it to the inbox", async () => {
  const todo = await db.store.addQuickTodo("buy milk");
  const res = await convertQuickTodo(req(`/api/quick-todos/${todo.id}/convert`, body({ scheduled: null })), idCtx(todo.id));
  assert.equal(res.status, 201);
  assert.equal((await res.json()).scheduled, null);
});
