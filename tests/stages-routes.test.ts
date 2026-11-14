import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { PATCH } from "../app/api/stages/[id]/route";
import { POST as reorder } from "../app/api/stages/reorder/route";
import { GET } from "../app/api/stages/route";
import { freshDb, type TestDb } from "./helpers/db";

let db: TestDb;
let projectId: string;
let stageId: string;
before(async () => {
  db = await freshDb();
  const { project, stages } = await db.store.addProject({ name: "Routes" });
  projectId = project.id;
  stageId = stages[0].id;
});
after(async () => db.close());

function req(url: string, init?: RequestInit): Request {
  return new Request(`https://app.test${url}`, init);
}

function body(value: unknown, method = "POST"): RequestInit {
  return { method, body: JSON.stringify(value), headers: { "content-type": "application/json" } };
}

const idCtx = (id: string) => ({ params: Promise.resolve({ id }) });
const patch = (value: unknown) => PATCH(req(`/api/stages/${stageId}`, body(value, "PATCH")), idCtx(stageId));

test("wipLimit can be set, then cleared with null", async () => {
  const set = await patch({ wipLimit: 3 });
  assert.equal(set.status, 200);
  assert.equal((await set.json()).wipLimit, 3);
  const cleared = await patch({ wipLimit: null });
  assert.equal((await cleared.json()).wipLimit, null);
});

test("invalid wipLimit is 400", async () => {
  for (const bad of [0, -1, 100, 1.5, "3"]) {
    assert.equal((await patch({ wipLimit: bad })).status, 400, String(bad));
  }
});

test("rename still works alongside wipLimit, and reorder still works", async () => {
  const res = await patch({ name: "Renamed", wipLimit: 5 });
  const s = await res.json();
  assert.equal(s.name, "Renamed");
  assert.equal(s.wipLimit, 5);

  const list = await (await GET(req(`/api/stages?projectId=${projectId}`))).json();
  const ids = list.map((x: { id: string }) => x.id).reverse();
  assert.equal((await reorder(req("/api/stages/reorder", body({ projectId, ids })))).status, 200);
});
