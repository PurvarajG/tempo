import assert from "node:assert/strict";
import test from "node:test";
import { todayTasksPrompt } from "../lib/claude-prompt";
import type { Project, Task } from "../lib/types";

const task = (o: Partial<Task>): Task =>
  ({
    id: "t", title: "Task", boardOrder: 0, tags: [], scheduled: "2026-11-12", minutes: 0, priority: 0,
    status: "open", isComplex: false, sortOrder: 0, createdAt: "2026-11-01T00:00:00Z", subtasks: [], ...o,
  }) as Task;
const project = { id: "p1", name: "Homebase", color: "#000", archived: false, sortOrder: 0, createdAt: "" } as Project;
const TODAY = "2026-11-12";

test("header, blank line, numbered in given order", () => {
  const out = todayTasksPrompt({ open: [task({ title: "B first" }), task({ title: "A second" })], projects: [], todayISO: TODAY });
  assert.equal(out, "My tasks for today, Thu 12 Nov (from Doem):\n\n1. B first\n2. A second");
});

test("facts appear only when present", () => {
  const out = todayTasksPrompt({
    open: [
      task({ title: "Full", priority: 1, projectId: "p1", minutes: 90, dueTime: "9:5" }),
      task({ title: "Med", priority: 2, minutes: 45 }),
      task({ title: "Low", priority: 3 }),
    ],
    projects: [project],
    todayISO: TODAY,
  });
  const lines = out.split("\n");
  assert.equal(lines[2], "1. Full (High, Homebase, 1h 30m, due 09:05)");
  assert.equal(lines[3], "2. Med (Medium, 45m)");
  assert.equal(lines[4], "3. Low");
});

test("notes: first line only, trimmed to 120 chars, indented", () => {
  const long = "x".repeat(200);
  const out = todayTasksPrompt({
    open: [task({ title: "N", notes: `\n  First line\nsecond` }), task({ title: "L", notes: long })],
    projects: [],
    todayISO: TODAY,
  });
  assert.match(out, /1\. N\n {3}Notes: First line\n2\. L\n {3}Notes: x{120}$/);
});

test("empty list", () => {
  assert.equal(todayTasksPrompt({ open: [], projects: [], todayISO: TODAY }), "My tasks for today, Thu 12 Nov (from Doem): nothing open.");
});

test("no dashes, middle dots or ISO dates", () => {
  const out = todayTasksPrompt({ open: [task({ title: "A", priority: 1, projectId: "p1", minutes: 30, dueTime: "14:30", notes: "n" })], projects: [project], todayISO: TODAY });
  assert.doesNotMatch(out, /[—–·]/);
  assert.doesNotMatch(out, /\d{4}-\d{2}-\d{2}/);
});
