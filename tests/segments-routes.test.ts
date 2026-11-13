import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { DELETE, PATCH } from "../app/api/segments/[id]/route";
import { POST as fill } from "../app/api/segments/fill/route";
import { GET as gaps } from "../app/api/segments/gaps/route";
import { GET, POST } from "../app/api/segments/route";
import { POST as stop } from "../app/api/segments/stop/route";
import { freshDb, type TestDb } from "./helpers/db";

let db: TestDb;
let categoryId: string;

before(async () => {
  db = await freshDb();
  categoryId = (await db.query<{ id: string }>(`select id from categories limit 1`))[0].id;
});
after(async () => db.close());

function req(url: string, init?: RequestInit): Request {
  return new Request(`https://app.test${url}`, init);
}

function body(value: unknown): RequestInit {
  return { method: "POST", body: JSON.stringify(value), headers: { "content-type": "application/json" } };
}

function idCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

test("starting a segment twice is a 409, naming what's already running", async () => {
  const first = await POST(req("/api/segments", body({ categoryId })));
  assert.equal(first.status, 201);

  const conflict = await POST(req("/api/segments", body({ categoryId })));
  assert.equal(conflict.status, 409);

  await stop();
});

test("GET returns segments overlapping the range, plus the running segment separately", async () => {
  const filled = await fill(
    req(
      "/api/segments/fill",
      body({ startedAt: "2026-04-01T09:00:00.000Z", endedAt: "2026-04-01T10:00:00.000Z", categoryId }),
    ),
  );
  const { id: filledId } = await filled.json();
  const started = await POST(req("/api/segments", body({ categoryId })));
  const { id: runningId } = await started.json();

  const res = await GET(req("/api/segments?from=2026-04-01T00:00:00.000Z&to=2026-04-02T00:00:00.000Z"));
  assert.equal(res.status, 200);
  const payload = await res.json();
  assert.equal(payload.running.id, runningId, "the running segment is reported regardless of the range");
  assert.ok(
    payload.segments.some((s: { id: string }) => s.id === filledId),
    "the historical segment inside the range is listed",
  );

  await stop();
});

test("switching hands the timer over in one request", async () => {
  await POST(req("/api/segments", body({ categoryId })));
  const res = await POST(req("/api/segments", body({ categoryId, replaceRunning: true, note: "next" })));
  assert.equal(res.status, 201);
  const payload = await res.json();
  assert.equal(payload.started.note, "next");
  await stop();
});

test("PATCH edits a segment and DELETE removes it", async () => {
  const created = await POST(
    req("/api/segments", body({ startedAt: "2026-04-02T09:00:00.000Z", endedAt: "2026-04-02T10:00:00.000Z", categoryId })),
  );
  const seg = await created.json();

  const edited = await PATCH(req(`/api/segments/${seg.id}`, { ...body({ note: "Edited" }), method: "PATCH" }), idCtx(seg.id));
  assert.equal(edited.status, 200);
  assert.equal((await edited.json()).note, "Edited");

  const deleted = await DELETE(req(`/api/segments/${seg.id}`, { method: "DELETE" }), idCtx(seg.id));
  assert.equal(deleted.status, 200);
});

test("fillGap rejects an overlapping span with 400", async () => {
  await fill(
    req(
      "/api/segments/fill",
      body({ startedAt: "2026-04-03T09:00:00.000Z", endedAt: "2026-04-03T10:00:00.000Z", categoryId }),
    ),
  );

  const overlapping = await fill(
    req(
      "/api/segments/fill",
      body({ startedAt: "2026-04-03T09:30:00.000Z", endedAt: "2026-04-03T11:00:00.000Z", categoryId }),
    ),
  );
  assert.equal(overlapping.status, 400);
});

test("starting a segment with a taskId resolves its category server-side, ignoring a client categoryId", async () => {
  const wrongCategory = (await db.query<{ id: string }>(`select id from categories where id <> $1 limit 1`, [
    categoryId,
  ]))[0].id;
  const { store } = await import("../lib/store");
  const admin = await store.addCategory({ name: "Client Work Route Test", color: "cat-slate", kind: "work" });
  const { project } = await store.addProject({ name: "Route Test Project", defaultCategoryId: admin.id });
  const task = await store.addTask({ title: "Route test task", scheduled: "2026-05-02", minutes: 30, priority: 0, projectId: project.id });

  const started = await POST(req("/api/segments", body({ categoryId: wrongCategory, taskId: task.id })));
  assert.equal(started.status, 201);
  const payload = await started.json();
  assert.equal(payload.categoryId, admin.id, "the task's project category wins over whatever the client sent");

  await stop();
});

test("POST /api/segments/fill accepts a taskId and resolves its category server-side", async () => {
  const { store } = await import("../lib/store");
  const admin = await store.addCategory({ name: "Fill Route Admin", color: "cat-slate", kind: "work" });
  const { project } = await store.addProject({ name: "Fill Route Project", defaultCategoryId: admin.id });
  const task = await store.addTask({
    title: "Fill route task",
    scheduled: "2026-04-04",
    minutes: 30,
    priority: 0,
    projectId: project.id,
  });

  const res = await fill(
    req(
      "/api/segments/fill",
      body({ startedAt: "2026-04-04T09:00:00.000Z", endedAt: "2026-04-04T10:00:00.000Z", taskId: task.id }),
    ),
  );
  assert.equal(res.status, 201);
  const payload = await res.json();
  assert.equal(payload.taskId, task.id);
  assert.equal(payload.categoryId, admin.id);
  assert.equal(payload.source, "backfill");
});

test("GET gaps returns the day's untracked spans", async () => {
  const res = await gaps(req("/api/segments/gaps?date=2026-05-01"));
  assert.equal(res.status, 200);
  const payload = await res.json();
  assert.ok(Array.isArray(payload));
});

test("gaps requires a valid date", async () => {
  const res = await gaps(req("/api/segments/gaps?date=not-a-date"));
  assert.equal(res.status, 400);
});


test("split route cuts a segment in two at the given time", async () => {
  const { POST: split } = await import("../app/api/segments/[id]/split/route");
  const created = await POST(
    req("/api/segments", body({ startedAt: "2026-04-05T09:00:00.000Z", endedAt: "2026-04-05T10:00:00.000Z", categoryId })),
  );
  const seg = await created.json();
  const res = await split(req(`/api/segments/${seg.id}/split`, body({ at: "2026-04-05T09:30:00.000Z" })), idCtx(seg.id));
  assert.equal(res.status, 200);
  const { before, after } = await res.json();
  assert.equal(before.endedAt, "2026-04-05T09:30:00.000Z");
  assert.equal(after.startedAt, "2026-04-05T09:30:00.000Z");
  assert.equal(after.endedAt, "2026-04-05T10:00:00.000Z");
});

test("split route: missing segment is 404, a point outside the range is 400", async () => {
  const { POST: split } = await import("../app/api/segments/[id]/split/route");
  const missing = "00000000-0000-4000-8000-000000000000";
  assert.equal((await split(req(`/api/segments/${missing}/split`, body({ at: "2026-04-05T09:30:00.000Z" })), idCtx(missing))).status, 404);

  const created = await POST(
    req("/api/segments", body({ startedAt: "2026-04-06T09:00:00.000Z", endedAt: "2026-04-06T10:00:00.000Z", categoryId })),
  );
  const seg = await created.json();
  const outside = await split(req(`/api/segments/${seg.id}/split`, body({ at: "2026-04-06T11:00:00.000Z" })), idCtx(seg.id));
  assert.equal(outside.status, 400);
  const bad = await split(req(`/api/segments/${seg.id}/split`, body({ at: "garbage" })), idCtx(seg.id));
  assert.equal(bad.status, 400);
});
