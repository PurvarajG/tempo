import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { randomUUID } from "node:crypto";
import { addDays, toISODate } from "../lib/parse";
import { CommitCapReached, TaskInvariantError } from "../lib/store/tasks";
import { freshDb, type TestDb } from "./helpers/db";

let db: TestDb;

before(async () => {
  db = await freshDb();
});
after(async () => db.close());

function task(overrides: Record<string, unknown> = {}) {
  return db.store.addTask({
    title: "A task",
    scheduled: "2026-03-01",
    minutes: 30,
    priority: 0,
    ...overrides,
  });
}

test("a new project task lands in the first open column", async () => {
  const { project, stages } = await db.store.addProject({ name: "Intake" });
  const t = await task({ projectId: project.id });
  assert.equal(t.stageId, stages[0].id);
});

test("changing project moves the task to the new project's first column", async () => {
  const a = await db.store.addProject({ name: "From" });
  const b = await db.store.addProject({ name: "To" });
  const t = await task({ projectId: a.project.id, stageId: a.stages[1].id });

  const moved = await db.store.updateTask(t.id, { projectId: b.project.id });
  assert.equal(moved?.projectId, b.project.id);
  assert.equal(moved?.stageId, b.stages[0].id);
});

test("clearing the project clears the column", async () => {
  const { project } = await db.store.addProject({ name: "Detach" });
  const t = await task({ projectId: project.id });

  const loose = await db.store.updateTask(t.id, { projectId: "" });
  assert.equal(loose?.projectId, undefined);
  assert.equal(loose?.stageId, undefined);
});

test("a column from another project is refused", async () => {
  const a = await db.store.addProject({ name: "Own" });
  const b = await db.store.addProject({ name: "Other" });
  const t = await task({ projectId: a.project.id });

  await assert.rejects(
    () => db.store.updateTask(t.id, { stageId: b.stages[0].id }),
    TaskInvariantError,
  );
});

test("completing a project task moves it to Done, and reopening brings it back", async () => {
  const { project, stages } = await db.store.addProject({ name: "Lifecycle" });
  const t = await task({ projectId: project.id, stageId: stages[1].id });

  const completed = await db.store.completeTask(t.id);
  assert.equal(completed?.task.status, "done");
  assert.equal(completed?.task.stageId, stages[3].id);

  const reopened = await db.store.reopenTask(t.id);
  assert.equal(reopened?.status, "open");
  assert.equal(reopened?.stageId, stages[0].id, "reopening returns to the first open column");
});

test("completing a recurring task creates the next occurrence in the open column", async () => {
  const { project, stages } = await db.store.addProject({ name: "Recurring" });
  const start = addDays(toISODate(new Date()), 1);
  const t = await task({
    projectId: project.id,
    scheduled: start,
    recurrence: { freq: "weekly", interval: 1 },
  });

  const result = await db.store.completeTask(t.id);
  assert.equal(result?.next?.scheduled, addDays(start, 7));
  assert.equal(result?.next?.status, "open");
  assert.equal(result?.next?.stageId, stages[0].id);
});

test("a recurring task scheduled weeks ago rolls forward past today on the same cadence", async () => {
  const today = toISODate(new Date());
  const start = addDays(today, -45);
  const t = await task({
    scheduled: start,
    recurrence: { freq: "weekly", interval: 1 },
  });

  const result = await db.store.completeTask(t.id);
  const next = result?.next?.scheduled;
  assert.ok(next && next > today, `next ${next} should be after ${today}`);
  const gapDays = (Date.parse(next + "T00:00:00Z") - Date.parse(start + "T00:00:00Z")) / 86400000;
  assert.equal(gapDays % 7, 0, "stays on the original weekday cadence");
});

test("a recurring task with from: done schedules the next one a week from today", async () => {
  const today = toISODate(new Date());
  const t = await task({
    scheduled: addDays(today, -45),
    recurrence: { freq: "weekly", interval: 1, from: "done" },
  });

  const result = await db.store.completeTask(t.id);
  assert.equal(result?.next?.scheduled, addDays(today, 7));
});

test("a task with no project completes without needing a column", async () => {
  const t = await task();
  const result = await db.store.completeTask(t.id);
  assert.equal(result?.task.status, "done");
  assert.equal(result?.task.stageId, undefined);
});

test("a complex task requires a finish date on or after scheduled", async () => {
  await assert.rejects(
    () => task({ isComplex: true }),
    TaskInvariantError,
    "no finishDate at all",
  );
  await assert.rejects(
    () => task({ isComplex: true, finishDate: "2026-02-28" }),
    TaskInvariantError,
    "finishDate before scheduled",
  );

  const t = await task({ isComplex: true, finishDate: "2026-03-01", scheduled: "2026-03-01" });
  assert.equal(t.finishDate, "2026-03-01", "equal to scheduled is allowed");
});

test("a complex task clears dueTime, since a time-of-day doesn't apply to a range", async () => {
  const t = await task({
    isComplex: true,
    finishDate: "2026-03-05",
    dueTime: "09:00",
  });
  assert.equal(t.dueTime, undefined);
});

test("turning complex off clears the finish date", async () => {
  const t = await task({ isComplex: true, finishDate: "2026-03-05" });
  const toggledOff = await db.store.updateTask(t.id, { isComplex: false });
  assert.equal(toggledOff?.isComplex, false);
  assert.equal(toggledOff?.finishDate, undefined);
});

test("patching only the finish date on an existing complex task is validated against scheduled", async () => {
  const t = await task({ isComplex: true, finishDate: "2026-03-05" });
  await assert.rejects(
    () => db.store.updateTask(t.id, { finishDate: "2026-02-15" }),
    TaskInvariantError,
  );

  const extended = await db.store.updateTask(t.id, { finishDate: "2026-03-10" });
  assert.equal(extended?.finishDate, "2026-03-10");
});

test("moving scheduled past an existing finish date is refused", async () => {
  const t = await task({ isComplex: true, finishDate: "2026-03-05" });
  await assert.rejects(
    () => db.store.updateTask(t.id, { scheduled: "2026-03-10" }),
    TaskInvariantError,
  );
});

test("deleting a project leaves its tasks intact but unassigned", async () => {
  const { project } = await db.store.addProject({ name: "Doomed" });
  const t = await task({ projectId: project.id });

  await db.store.deleteProject(project.id);

  const survivor = await db.store.getTask(t.id);
  assert.equal(survivor?.projectId, undefined);
  assert.equal(survivor?.stageId, undefined);
});
