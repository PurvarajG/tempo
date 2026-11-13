import assert from "node:assert/strict";
import test from "node:test";
import {
  carriedOver,
  daysInLane,
  goneQuiet,
  hereLabel,
  laneCountLabel,
  laneGlyph,
  leftToPlanMinutes,
  limitToSave,
  openInStage,
} from "../components/kanban/lanes";
import { addDays, toISODate } from "../lib/parse";
import type { ProjectStage, Task } from "../lib/types";

const today = toISODate(new Date());
const ago = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
};

function mk(over: Partial<Task> & { id: string }): Task {
  return {
    title: over.id,
    boardOrder: 0,
    tags: [],
    scheduled: today,
    minutes: 30,
    priority: "medium",
    status: "open",
    isComplex: false,
    sortOrder: 0,
    createdAt: ago(30),
    subtasks: [],
    projectId: "p1",
    stageId: "act",
    ...over,
  } as Task;
}

const stage = (id: string, kind: ProjectStage["kind"]) =>
  ({ id, projectId: "p1", name: id, kind }) as ProjectStage;
const stages = [stage("bk", "backlog"), stage("act", "active"), stage("bl", "blocked"), stage("dn", "done")];

test("daysInLane", () => {
  assert.equal(daysInLane(mk({ id: "a" }), today), null);
  assert.equal(daysInLane(mk({ id: "a", stageEnteredAt: ago(5) }), today), 5);
});

test("hereLabel", () => {
  assert.equal(hereLabel(mk({ id: "a", stageEnteredAt: ago(2) }), today), null);
  assert.equal(hereLabel(mk({ id: "a", stageEnteredAt: ago(3) }), today), "3d here");
  assert.equal(hereLabel(mk({ id: "a", stageEnteredAt: ago(9), status: "done" }), today), null);
  assert.equal(hereLabel(mk({ id: "a" }), today), null);
});

test("goneQuiet", () => {
  const tasks = [
    mk({ id: "b", stageEnteredAt: ago(15) }),
    mk({ id: "a", stageEnteredAt: ago(15) }),
    mk({ id: "long", stageEnteredAt: ago(40) }),
    mk({ id: "edge", stageEnteredAt: ago(14) }),
    mk({ id: "bk", stageId: "bk", stageEnteredAt: ago(40) }),
    mk({ id: "bl", stageId: "bl", stageEnteredAt: ago(40) }),
    mk({ id: "dn", stageId: "dn", stageEnteredAt: ago(40) }),
    mk({ id: "other", projectId: "p2", stageEnteredAt: ago(40) }),
    mk({ id: "trash", status: "trashed", stageEnteredAt: ago(40) }),
    mk({ id: "done", status: "done", stageEnteredAt: ago(40) }),
  ];
  assert.deepEqual(goneQuiet(tasks, stages, "p1", today).map((t) => t.id), ["long", "a", "b"]);
});

test("openInStage", () => {
  const tasks = [mk({ id: "a" }), mk({ id: "b", status: "done" }), mk({ id: "c", stageId: "bk" })];
  assert.equal(openInStage(tasks, "act"), 1);
});

test("laneCountLabel", () => {
  assert.deepEqual(laneCountLabel(4, 3), { text: "4", over: false });
  assert.deepEqual(laneCountLabel(4, 3, null), { text: "4", over: false });
  assert.deepEqual(laneCountLabel(5, 3, 3), { text: "3/3", over: false });
  assert.deepEqual(laneCountLabel(5, 4, 3), { text: "4/3", over: true });
});

test("limitToSave", () => {
  assert.equal(limitToSave(2, 5), 5);
  assert.equal(limitToSave(8, 5), 8);
  assert.equal(limitToSave(null, 5), null);
  assert.equal(limitToSave(0, 0), 1);
  assert.equal(limitToSave(3.7, 1), 3);
});

test("leftToPlanMinutes", () => {
  const tasks = [
    mk({ id: "a", minutes: 30 }),
    mk({ id: "b", minutes: 45 }),
    mk({ id: "c", minutes: 99, status: "done" }),
    mk({ id: "d", minutes: 99, status: "trashed" }),
    mk({ id: "e", minutes: 99, projectId: "p2" }),
  ];
  assert.equal(leftToPlanMinutes(tasks, "p1"), 75);
});

test("carriedOver", () => {
  const tasks = [
    mk({ id: "late", scheduled: addDays(today, -2) }),
    mk({ id: "now" }),
    mk({ id: "inbox", scheduled: null }),
    mk({ id: "doneLate", scheduled: addDays(today, -2), status: "done" }),
    mk({ id: "trashLate", scheduled: addDays(today, -2), status: "trashed" }),
    mk({ id: "otherLate", scheduled: addDays(today, -2), projectId: "p2" }),
  ];
  assert.deepEqual(carriedOver(tasks, "p1", today).map((t) => t.id), ["late"]);
});

test("laneGlyph", () => {
  assert.equal(laneGlyph("backlog"), "target");
  assert.equal(laneGlyph("active"), "live");
  assert.equal(laneGlyph("blocked"), "clock");
  assert.equal(laneGlyph("done"), "check");
});
