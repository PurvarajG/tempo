import assert from "node:assert/strict";
import test from "node:test";
import { matchesQuery, searchProjects, searchTasks } from "../lib/search";
import type { Project, Task } from "../lib/types";

let seq = 0;
function mk(over: Partial<Task> = {}): Task {
  seq += 1;
  return {
    id: `t${seq}`,
    title: `Task ${seq}`,
    boardOrder: 0,
    tags: [],
    scheduled: "2026-11-12",
    minutes: 30,
    priority: 0,
    status: "open",
    isComplex: false,
    sortOrder: seq,
    createdAt: "2026-11-01T00:00:00.000Z",
    subtasks: [],
    ...over,
  } as Task;
}
function proj(name: string, over: Partial<Project> = {}): Project {
  seq += 1;
  return { id: `p${seq}`, name, color: "#000", archived: false, sortOrder: seq, createdAt: "2026-11-01T00:00:00.000Z", ...over } as Project;
}
const ids = (ts: { id: string }[]) => ts.map((t) => t.id);

test("empty and whitespace queries return nothing", () => {
  const tasks = [mk({ title: "Write report" })];
  assert.deepEqual(searchTasks(tasks, ""), []);
  assert.deepEqual(searchTasks(tasks, "   "), []);
  assert.deepEqual(searchProjects([proj("Home")], "  "), []);
  assert.equal(matchesQuery("anything", ""), false);
});

test("every term must match (AND), in any order", () => {
  const a = mk({ title: "Write quarterly report" });
  const b = mk({ title: "Write email" });
  assert.deepEqual(ids(searchTasks([a, b], "report write")), [a.id]);
  assert.equal(matchesQuery("Write quarterly report", "quar  rep"), true);
  assert.equal(matchesQuery("Write email", "write report"), false);
});

test("notes and exact tags match", () => {
  const a = mk({ title: "A", notes: "call the plumber" });
  const b = mk({ title: "B", tags: ["errand"] });
  const c = mk({ title: "C", tags: ["errands"] });
  assert.deepEqual(ids(searchTasks([a, b, c], "plumber")), [a.id]);
  assert.deepEqual(ids(searchTasks([a, b, c], "errand")), [b.id], "tags are exact, not substring");
  assert.deepEqual(ids(searchTasks([a, b, c], "b errand")), [b.id]);
});

test("case-insensitive", () => {
  const a = mk({ title: "Buy MILK", tags: ["Home"] });
  assert.deepEqual(ids(searchTasks([a], "milk")), [a.id]);
  assert.deepEqual(ids(searchTasks([a], "BUY")), [a.id]);
  assert.deepEqual(ids(searchTasks([a], "home")), [a.id]);
});

test("trashed tasks never match", () => {
  const a = mk({ title: "ghost", status: "trashed" });
  assert.deepEqual(searchTasks([a], "ghost"), []);
});

test("open before done, prefix-first within each, otherwise input order", () => {
  const doneP = mk({ title: "plan done", status: "done" });
  const openC = mk({ title: "re-plan" });
  const openP = mk({ title: "Plan trip" });
  const openC2 = mk({ title: "the plan b" });
  const doneC = mk({ title: "old plan", status: "done" });
  assert.deepEqual(
    ids(searchTasks([doneP, openC, doneC, openP, openC2], "plan")),
    [openP.id, openC.id, openC2.id, doneP.id, doneC.id],
  );
});

test("limit caps results after ordering", () => {
  const a = mk({ title: "x plan" });
  const b = mk({ title: "plan x" });
  assert.deepEqual(ids(searchTasks([a, b], "plan", 1)), [b.id]);
  assert.equal(searchTasks([a, b], "plan").length, 2);
  assert.deepEqual(searchTasks([a, b], "plan", 0), []);
});

test("projects match on name, skip archived, prefix-first, limit", () => {
  const p1 = proj("My Home");
  const p2 = proj("Home reno");
  const p3 = proj("Home old", { archived: true });
  const p4 = proj("Work");
  assert.deepEqual(ids(searchProjects([p1, p2, p3, p4], "home")), [p2.id, p1.id]);
  assert.deepEqual(ids(searchProjects([p1, p2, p3, p4], "HOME", 1)), [p2.id]);
  assert.deepEqual(searchProjects([p4], "zzz"), []);
});
