import assert from "node:assert/strict";
import test from "node:test";
import {
  MIN_SUGGESTION_MINUTES,
  pickClaudeCategory,
  suggestedClaudeBlocks,
} from "../lib/claude-sessions";

const NOW = new Date("2026-11-13T15:00:00.000Z");
const at = (min: number) => new Date(NOW.getTime() + min * 60_000).toISOString();
const win = (a: number, b: number) => ({
  start: new Date(NOW.getTime() + a * 60_000),
  end: new Date(NOW.getTime() + b * 60_000),
});

function session(over: Record<string, unknown> = {}) {
  return {
    id: "s1",
    projectPath: "/p/doem",
    projectName: "doem",
    branch: "main" as string | null,
    lastPrompt: "fix the ribbon",
    firstMessageAt: at(-120),
    lastMessageAt: at(-60),
    waiting: false,
    active: false,
    ...over,
  };
}

test("clips to the window", () => {
  const r = suggestedClaudeBlocks([session()], win(-100, -80), [], NOW);
  assert.equal(r.length, 1);
  assert.equal(r[0].startedAt, at(-100));
  assert.equal(r[0].endedAt, at(-80));
  assert.equal(r[0].key, `s1|${at(-100)}`);
});

test("active ends at now, inactive at lastMessageAt", () => {
  const w = win(-300, 300);
  assert.equal(suggestedClaudeBlocks([session()], w, [], NOW)[0].endedAt, at(-60));
  assert.equal(suggestedClaudeBlocks([session({ active: true })], w, [], NOW)[0].endedAt, at(0));
});

test("a segment in the middle splits into two pieces", () => {
  const r = suggestedClaudeBlocks([session()], win(-300, 300), [{ startedAt: at(-100), endedAt: at(-80) }], NOW);
  assert.deepEqual(r.map((x) => [x.startedAt, x.endedAt]), [
    [at(-120), at(-100)],
    [at(-80), at(-60)],
  ]);
});

test("pieces under the minimum are dropped", () => {
  assert.equal(MIN_SUGGESTION_MINUTES, 5);
  const r = suggestedClaudeBlocks([session()], win(-300, 300), [{ startedAt: at(-117), endedAt: at(-60) }], NOW);
  assert.equal(r.length, 0);
  const ok = suggestedClaudeBlocks([session()], win(-300, 300), [{ startedAt: at(-115), endedAt: at(-60) }], NOW);
  assert.equal(ok.length, 1);
});

test("a running segment covers to now", () => {
  const s = session({ active: true, firstMessageAt: at(-30) });
  const r = suggestedClaudeBlocks([s], win(-300, 300), [{ startedAt: at(-20), endedAt: undefined }], NOW);
  assert.deepEqual(r.map((x) => [x.startedAt, x.endedAt]), [[at(-30), at(-20)]]);
});

test("overlapping sessions are both kept and sorted", () => {
  const a = session({ id: "a", firstMessageAt: at(-50), lastMessageAt: at(-20) });
  const b = session({ id: "b", firstMessageAt: at(-60), lastMessageAt: at(-30) });
  const r = suggestedClaudeBlocks([a, b], win(-300, 300), [], NOW);
  assert.deepEqual(r.map((x) => x.sessionId), ["b", "a"]);
});

test("label and note copy", () => {
  const [x] = suggestedClaudeBlocks([session()], win(-300, 300), [], NOW);
  assert.equal(x.label, "Claude Code: doem");
  assert.equal(x.note, "Claude Code in doem on main. fix the ribbon");
  const [y] = suggestedClaudeBlocks([session({ branch: null, lastPrompt: "" })], win(-300, 300), [], NOW);
  assert.equal(y.note, "Claude Code in doem");
  for (const t of [x.label, x.note, y.note]) assert.doesNotMatch(t, /[–—·]/);
});

const cat = (id: string, name: string, archived = false) =>
  ({ id, name, archived, color: "", kind: "work", sortOrder: 0, createdAt: "" }) as never;

test("pickClaudeCategory preference and fallbacks", () => {
  assert.equal(pickClaudeCategory([cat("a", "Admin"), cat("b", "Deep work")]), "b");
  assert.equal(pickClaudeCategory([cat("a", "Admin"), cat("b", "Rest")]), "a");
  assert.equal(pickClaudeCategory([cat("a", "Dev", true), cat("b", "Rest")]), "b");
  assert.equal(pickClaudeCategory([cat("a", "Dev", true)]), undefined);
  assert.equal(pickClaudeCategory([]), undefined);
});
