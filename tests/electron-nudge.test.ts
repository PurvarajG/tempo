import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { createNudgeCounter, nudgeMessage, ACTIVE_IDLE_SECONDS } = require("../electron/nudge.js");

const away = { tracking: false, locked: false, idleSeconds: 0 };
const running = { tracking: true, locked: false, idleSeconds: 0 };

function run(counter: ReturnType<typeof createNudgeCounter>, n: number, state = away) {
  let last = { notify: false, minutes: 0 };
  const fired: number[] = [];
  for (let i = 0; i < n; i++) {
    last = counter.tick(state);
    if (last.notify) fired.push(last.minutes);
  }
  return { last, fired };
}

test("off by default", () => {
  const c = createNudgeCounter();
  const { fired, last } = run(c, 60);
  assert.deepEqual(fired, []);
  assert.equal(last.minutes, 60);
});

test("fires once when the count reaches the threshold", () => {
  const c = createNudgeCounter();
  c.setThreshold(15);
  assert.deepEqual(run(c, 14).fired, []);
  const t = c.tick(away);
  assert.equal(t.notify, true);
  assert.equal(t.minutes, 15);
});

test("no second fire in the same gap", () => {
  const c = createNudgeCounter();
  c.setThreshold(15);
  assert.deepEqual(run(c, 60).fired, [15]);
});

test("tracking resets the count and re-arms", () => {
  const c = createNudgeCounter();
  c.setThreshold(15);
  assert.deepEqual(run(c, 15).fired, [15]);
  assert.deepEqual(c.tick(running), { notify: false, minutes: 0 });
  assert.deepEqual(run(c, 15).fired, [15]);
});

test("reset() re-arms", () => {
  const c = createNudgeCounter();
  c.setThreshold(5);
  assert.deepEqual(run(c, 5).fired, [5]);
  c.reset();
  assert.deepEqual(run(c, 5).fired, [5]);
});

test("locked and idle ticks neither count nor reset", () => {
  const c = createNudgeCounter();
  c.setThreshold(15);
  run(c, 10);
  const locked = c.tick({ tracking: false, locked: true, idleSeconds: 0 });
  assert.deepEqual(locked, { notify: false, minutes: 10 });
  const idle = c.tick({ tracking: false, locked: false, idleSeconds: ACTIVE_IDLE_SECONDS });
  assert.deepEqual(idle, { notify: false, minutes: 10 });
  const slightlyIdle = c.tick({ tracking: false, locked: false, idleSeconds: ACTIVE_IDLE_SECONDS - 1 });
  assert.equal(slightlyIdle.minutes, 11);
  assert.deepEqual(run(c, 4).fired, [15]);
});

test("null threshold never notifies but still counts", () => {
  const c = createNudgeCounter();
  c.setThreshold(15);
  c.setThreshold(null);
  const { fired, last } = run(c, 30);
  assert.deepEqual(fired, []);
  assert.equal(last.minutes, 30);
});

test("changing the threshold does not re-fire a notified gap", () => {
  const c = createNudgeCounter();
  c.setThreshold(15);
  run(c, 15);
  c.setThreshold(20);
  assert.deepEqual(run(c, 10).fired, []);
});

test("message wording", () => {
  assert.deepEqual(nudgeMessage(15), { title: "Not tracking", body: "Nothing has been tracked for 15m." });
  assert.equal(nudgeMessage(60).body, "Nothing has been tracked for 1h.");
  assert.equal(nudgeMessage(90).body, "Nothing has been tracked for 1h 30m.");
});
