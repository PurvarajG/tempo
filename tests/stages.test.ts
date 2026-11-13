import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { withTransaction } from "../lib/db";
import { moveTasksToStage, StageConflict, wipCount } from "../lib/store/stages";
import { freshDb, type TestDb } from "./helpers/db";

let db: TestDb;

before(async () => {
  db = await freshDb();
});
after(async () => db.close());

async function project(name: string) {
  const { project, stages } = await db.store.addProject({ name });
  return { project, stages };
}

function task(projectId: string, title: string, stageId?: string) {
  return db.store.addTask({
    title,
    projectId,
    stageId,
    scheduled: "2026-03-01",
    minutes: 30,
    priority: 0,
  });
}

test("a new project comes with its four default columns", async () => {
  const { stages } = await project("Fresh");
  assert.deepEqual(
    stages.map((s) => [s.name, s.kind, s.sortOrder]),
    [
      ["Backlog", "backlog", 0],
      ["In Progress", "active", 1],
      ["Blocked", "blocked", 2],
      ["Done", "done", 3],
    ],
  );
});

test("columns rename, reorder, and add", async () => {
  const { project: p, stages } = await project("Board");

  await db.store.updateStage(stages[0].id, { name: "Someday" });
  const review = await db.store.addStage(p.id, { name: "Review", kind: "active" });
  await db.store.reorderStages(p.id, [review.id, ...stages.map((s) => s.id)]);

  const after = await db.store.listStages(p.id);
  assert.deepEqual(after.map((s) => s.name), [
    "Review",
    "Someday",
    "In Progress",
    "Blocked",
    "Done",
  ]);
});

test("a project keeps exactly one done column", async () => {
  const { project: p, stages } = await project("Invariants");

  await assert.rejects(
    () => db.store.addStage(p.id, { name: "Also done", kind: "done" }),
    StageConflict,
  );
  await assert.rejects(
    () => db.store.updateStage(stages[3].id, { kind: "active" }),
    StageConflict,
  );
  await assert.rejects(() => db.store.removeStage(stages[3].id, stages[0].id), StageConflict);
});

test("removing a column moves its tasks to the chosen destination", async () => {
  const { project: p, stages } = await project("Cleanup");
  const t = await task(p.id, "Survivor", stages[1].id);

  await db.store.removeStage(stages[1].id, stages[0].id);

  const moved = await db.store.getTask(t.id);
  assert.equal(moved?.stageId, stages[0].id);
  assert.equal((await db.store.listStages(p.id)).length, 3);
});

test("a destination in another project is refused", async () => {
  const a = await project("A");
  const b = await project("B");
  await assert.rejects(() => db.store.removeStage(a.stages[1].id, b.stages[0].id), StageConflict);
  await assert.rejects(() => db.store.removeStage(a.stages[1].id, a.stages[1].id), StageConflict);
});

test("tasks moved into the done column are completed, and reopened on the way out", async () => {
  const { project: p, stages } = await project("Transitions");
  const t = await task(p.id, "Finish me", stages[0].id);

  const done = await db.store.moveTaskToStage(t.id, stages[3].id, 0);
  assert.equal(done?.status, "done");
  assert.ok(done?.completedAt);

  const reopened = await db.store.moveTaskToStage(t.id, stages[1].id, 0);
  assert.equal(reopened?.status, "open");
  assert.equal(reopened?.completedAt, undefined);
});

test("board order stays dense across moves", async () => {
  const { project: p, stages } = await project("Ordering");
  const first = await task(p.id, "First", stages[0].id);
  const second = await task(p.id, "Second", stages[0].id);
  const third = await task(p.id, "Third", stages[0].id);

  // Drop the last card at the top of its own column.
  await db.store.moveTaskToStage(third.id, stages[0].id, 0);

  const inColumn = (await db.store.allTasks())
    .filter((t) => t.stageId === stages[0].id)
    .sort((a, b) => a.boardOrder - b.boardOrder);

  assert.deepEqual(inColumn.map((t) => t.title), ["Third", "First", "Second"]);
  assert.deepEqual(inColumn.map((t) => t.boardOrder), [0, 1, 2]);
  assert.ok(first.id && second.id);
});

test("a column's wipLimit can be set, read back and cleared", async () => {
  const { stages } = await project("Limits");
  assert.equal(stages[1].wipLimit ?? null, null);

  const set = await db.store.updateStage(stages[1].id, { wipLimit: 3 });
  assert.equal(set?.wipLimit, 3);
  const listed = (await db.store.listStages()).find((s) => s.id === stages[1].id);
  assert.equal(listed?.wipLimit, 3);

  // Setting a limit alongside a rename keeps both.
  const both = await db.store.updateStage(stages[1].id, { name: "Doing", wipLimit: 2 });
  assert.equal(both?.name, "Doing");
  assert.equal(both?.wipLimit, 2);

  const cleared = await db.store.updateStage(stages[1].id, { wipLimit: null });
  assert.equal(cleared?.wipLimit ?? null, null);
});

test("an invalid wipLimit is rejected and nothing changes", async () => {
  const { stages } = await project("Bad limits");
  for (const bad of [0, -1, 1.5, Number.NaN]) {
    await assert.rejects(() => db.store.updateStage(stages[1].id, { wipLimit: bad }));
  }
  const after = (await db.store.listStages()).find((s) => s.id === stages[1].id);
  assert.equal(after?.wipLimit ?? null, null);
});

test("the limit is soft: a column can hold more cards than its limit", async () => {
  const { project: p, stages } = await project("Soft");
  await db.store.updateStage(stages[1].id, { wipLimit: 1 });
  await task(p.id, "One", stages[1].id);
  await task(p.id, "Two", stages[1].id);
  const tasks = await db.store.allTasks();
  assert.equal(wipCount(tasks, stages[1].id), 2);
});

test("removeStage stamps stage_entered_at on moved tasks only", async () => {
  const { project: p, stages } = await project("Stamps");
  const mover = await task(p.id, "Mover", stages[2].id);
  const stayer = await task(p.id, "Stayer", stages[0].id);
  const before = await db.store.allTasks();
  const stayerBefore = before.find((t) => t.id === stayer.id)?.stageEnteredAt;
  const moverBefore = before.find((t) => t.id === mover.id)?.stageEnteredAt;
  await new Promise((r) => setTimeout(r, 20));

  await db.store.removeStage(stages[2].id, stages[0].id);

  const after = await db.store.allTasks();
  const moverAfter = after.find((t) => t.id === mover.id);
  assert.equal(moverAfter?.stageId, stages[0].id);
  assert.ok(moverAfter?.stageEnteredAt);
  if (moverBefore) assert.ok(moverAfter.stageEnteredAt > moverBefore);
  assert.equal(after.find((t) => t.id === stayer.id)?.stageEnteredAt, stayerBefore);
});

test("moveTasksToStage stamps stage_entered_at only for tasks that change column", async () => {
  const { project: p, stages } = await project("Bulk");
  const a = await task(p.id, "A", stages[0].id);
  const b = await task(p.id, "B", stages[1].id);
  const bBefore = (await db.store.allTasks()).find((t) => t.id === b.id)?.stageEnteredAt;
  await new Promise((r) => setTimeout(r, 20));

  await withTransaction((tx) => moveTasksToStage(tx, stages[0].id, stages[1]));

  const after = await db.store.allTasks();
  const aAfter = after.find((t) => t.id === a.id);
  assert.equal(aAfter?.stageId, stages[1].id);
  assert.ok(aAfter?.stageEnteredAt);
  assert.equal(after.find((t) => t.id === b.id)?.stageEnteredAt, bBefore);
});

test("wipCount counts only open tasks in the given stage", () => {
  const tasks = [
    { stageId: "a", status: "open" },
    { stageId: "a", status: "open" },
    { stageId: "a", status: "done" },
    { stageId: "a", status: "trashed" },
    { stageId: "b", status: "open" },
    { status: "open" },
  ];
  assert.equal(wipCount(tasks, "a"), 2);
  assert.equal(wipCount(tasks, "b"), 1);
  assert.equal(wipCount(tasks, "zzz"), 0);
});
