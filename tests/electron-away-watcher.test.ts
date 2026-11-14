import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { createAwayWatcher, awayPromptText, AWAY_IDLE_SECONDS, MIN_LOCK_SECONDS } =
  require("../electron/away-watcher.js");

const T0 = new Date("2026-11-13T09:00:00Z");
const at = (s: number) => new Date(T0.getTime() + s * 1000);

test("constants", () => {
  assert.equal(AWAY_IDLE_SECONDS, 300);
  assert.equal(MIN_LOCK_SECONDS, 60);
});

test("lock then unlock while tracking returns the span", () => {
  const w = createAwayWatcher();
  w.lock(at(0), true);
  const r = w.unlock(at(600), true);
  assert.deepEqual(r, { awayFrom: at(0), awayTo: at(600) });
  assert.equal(w.unlock(at(700), true), null);
});

test("a lock under 60 seconds gives null", () => {
  const w = createAwayWatcher();
  w.lock(at(0), true);
  assert.equal(w.unlock(at(59), true), null);
});

test("lock while not tracking gives null", () => {
  const w = createAwayWatcher();
  w.lock(at(0), false);
  assert.equal(w.unlock(at(600), true), null);
});

test("unlock after tracking stopped gives null", () => {
  const w = createAwayWatcher();
  w.lock(at(0), true);
  assert.equal(w.unlock(at(600), false), null);
});

test("idle crossing 300s then returning gives one event", () => {
  const w = createAwayWatcher();
  assert.equal(w.idleTick({ idleSeconds: 100, now: at(100), tracking: true }), null);
  assert.equal(w.idleTick({ idleSeconds: 300, now: at(300), tracking: true }), null);
  assert.equal(w.idleTick({ idleSeconds: 900, now: at(900), tracking: true }), null);
  const r = w.idleTick({ idleSeconds: 2, now: at(1202), tracking: true });
  assert.deepEqual(r, { awayFrom: at(0), awayTo: at(1200) });
  assert.equal(w.idleTick({ idleSeconds: 3, now: at(1203), tracking: true }), null);
  assert.equal(w.idleTick({ idleSeconds: 4, now: at(1204), tracking: true }), null);
});

test("idle is ignored while locked", () => {
  const w = createAwayWatcher();
  w.lock(at(0), true);
  assert.equal(w.idleTick({ idleSeconds: 400, now: at(400), tracking: true }), null);
  assert.equal(w.idleTick({ idleSeconds: 1, now: at(401), tracking: true }), null);
  assert.deepEqual(w.unlock(at(500), true), { awayFrom: at(0), awayTo: at(500) });
});

test("idle then lock gives one event from the idle start", () => {
  const w = createAwayWatcher();
  w.idleTick({ idleSeconds: 300, now: at(300), tracking: true });
  w.lock(at(310), true);
  assert.deepEqual(w.unlock(at(900), true), { awayFrom: at(0), awayTo: at(900) });
  assert.equal(w.idleTick({ idleSeconds: 1, now: at(901), tracking: true }), null);
});

test("tracking stopping clears the idle mark with no prompt", () => {
  const w = createAwayWatcher();
  w.idleTick({ idleSeconds: 400, now: at(400), tracking: true });
  assert.equal(w.idleTick({ idleSeconds: 410, now: at(410), tracking: false }), null);
  assert.equal(w.idleTick({ idleSeconds: 1, now: at(411), tracking: true }), null);
});

test("prompt text and buttons", () => {
  const p = awayPromptText(23, "Write report");
  assert.equal(p.message, 'Away for 23m while timing "Write report".');
  assert.deepEqual(p.buttons, ["Keep it on Write report", "Mark as break", "Discard"]);
  assert.equal(awayPromptText(65, "X").message, 'Away for 1h 5m while timing "X".');
});

test("long labels truncate to 40 characters with an ellipsis", () => {
  const p = awayPromptText(5, "a".repeat(60));
  assert.equal(p.buttons[0], `Keep it on ${"a".repeat(39)}…`);
  assert.ok(p.message.includes(`${"a".repeat(39)}…`));
  assert.ok(!/[–—·]/.test(p.message + p.buttons.join("")));
});
