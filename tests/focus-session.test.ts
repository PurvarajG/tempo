import assert from "node:assert/strict";
import test from "node:test";
import {
  acknowledgeFocusSession,
  extendFocusSession,
  focusMinutes,
  focusOverLine,
  focusPhase,
  focusRemainingMs,
  startFocusSession,
} from "../lib/focus-session";

const NOW = new Date("2026-11-13T10:00:00.000Z");
const at = (min: number) => new Date(NOW.getTime() + min * 60_000);
const task = { id: "t1", title: "Write", minutes: 45 };

test("minimum is 5m for missing, zero or spent estimates", () => {
  assert.equal(focusMinutes(0, 0), 5);
  assert.equal(focusMinutes(null, 10), 5);
  assert.equal(focusMinutes(undefined, 0), 5);
  assert.equal(focusMinutes(-3, 0), 5);
  assert.equal(focusMinutes(30, 40), 5);
  assert.equal(focusMinutes(8, 5), 5);
});

test("countdown is the remaining estimate", () => {
  assert.equal(focusMinutes(45, 20), 25);
  assert.equal(focusMinutes(45, 0), 45);
});

test("start sets endsAt and is not acknowledged", () => {
  const s = startFocusSession(task, 20, NOW);
  assert.equal(s.minutes, 25);
  assert.equal(s.endsAt, at(25).toISOString());
  assert.equal(s.acknowledged, false);
  assert.equal(s.taskId, "t1");
  assert.equal(s.title, "Write");
});

test("remaining may go negative", () => {
  const s = startFocusSession(task, 20, NOW);
  assert.equal(focusRemainingMs(s, at(5)), 20 * 60_000);
  assert.equal(focusRemainingMs(s, at(26)), -60_000);
});

test("phases", () => {
  const s = startFocusSession(task, 20, NOW);
  assert.equal(focusPhase(s, at(24)), "counting");
  assert.equal(focusPhase(s, at(25)), "timesUp");
  assert.equal(focusPhase(s, at(30)), "timesUp");
  const k = acknowledgeFocusSession(s);
  assert.equal(k.acknowledged, true);
  assert.equal(s.acknowledged, false);
  assert.equal(focusPhase(k, at(30)), "over");
  assert.equal(focusPhase(k, at(10)), "counting");
});

test("extend from before endsAt adds to endsAt", () => {
  const s = startFocusSession(task, 20, NOW);
  const e = extendFocusSession(s, at(10));
  assert.equal(e.endsAt, at(40).toISOString());
  assert.equal(e.minutes, 15);
  assert.equal(e.acknowledged, false);
});

test("extend after endsAt adds to now and clears acknowledged", () => {
  const s = acknowledgeFocusSession(startFocusSession(task, 20, NOW));
  const e = extendFocusSession(s, at(30), 10);
  assert.equal(e.endsAt, at(40).toISOString());
  assert.equal(e.minutes, 10);
  assert.equal(e.acknowledged, false);
});

test("over line wording", () => {
  const s = startFocusSession(task, 20, NOW);
  assert.equal(focusOverLine(s, at(25)), "Over the estimate by 1m.");
  assert.equal(focusOverLine(s, at(25.5)), "Over the estimate by 1m.");
  assert.equal(focusOverLine(s, at(37)), "Over the estimate by 12m.");
  assert.equal(focusOverLine(s, at(90)), "Over the estimate by 1h 5m.");
});
