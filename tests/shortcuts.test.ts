import assert from "node:assert/strict";
import test from "node:test";
import { GLOBAL_SHORTCUTS, isTypingTarget, matchShortcut, SHORTCUTS, type ShortcutAction } from "../lib/shortcuts";

const KEYS: [string, ShortcutAction][] = [
  ["j", "next"],
  ["k", "prev"],
  ["x", "done"],
  [" ", "done"],
  ["t", "tomorrow"],
  ["d", "pickDate"],
  ["s", "timer"],
  ["f", "focus"],
  ["*", "commit"],
  ["e", "open"],
  ["Enter", "open"],
  ["Backspace", "trash"],
  ["/", "quickAdd"],
  ["?", "sheet"],
];

test("every key maps to its action", () => {
  for (const [key, action] of KEYS) assert.equal(matchShortcut({ key }), action, key);
});

test("letters match either case", () => {
  assert.equal(matchShortcut({ key: "J" }), "next");
  assert.equal(matchShortcut({ key: "X" }), "done");
  assert.equal(matchShortcut({ key: "E" }), "open");
});

test("modifiers return null", () => {
  assert.equal(matchShortcut({ key: "j", metaKey: true }), null);
  assert.equal(matchShortcut({ key: "k", ctrlKey: true }), null);
  assert.equal(matchShortcut({ key: "x", altKey: true }), null);
  assert.equal(matchShortcut({ key: "Enter", metaKey: true }), null);
});

test("unknown keys return null", () => {
  assert.equal(matchShortcut({ key: "a" }), null);
  assert.equal(matchShortcut({ key: "Escape" }), null);
  assert.equal(matchShortcut({ key: "constructor" }), null);
});

test("SHORTCUTS covers every action exactly once, in order", () => {
  const actions = SHORTCUTS.map((s) => s.action);
  assert.deepEqual(actions, ["next", "prev", "done", "tomorrow", "pickDate", "timer", "focus", "commit", "open", "trash", "quickAdd", "sheet"]);
  assert.equal(new Set(actions).size, actions.length);
  for (const [, action] of KEYS) assert.ok(actions.includes(action));
  assert.ok(SHORTCUTS.some((s) => s.label === "Start a focus session"));
});

test("global shortcuts list real routes", () => {
  assert.deepEqual(GLOBAL_SHORTCUTS.slice(0, 3).map((s) => s.label), ["Search and commands", "New task", "Undo"]);
  assert.ok(GLOBAL_SHORTCUTS.some((s) => s.keys.join("") === "⌘1" && s.label === "Go to Today"));
});

test("isTypingTarget is false for null and non-elements", () => {
  assert.equal(isTypingTarget(null), false);
  assert.equal(isTypingTarget({} as unknown as EventTarget), false);
});
