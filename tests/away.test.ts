import assert from "node:assert/strict";
import test from "node:test";
import { awayMinutes, planAway } from "../lib/away";

const T0 = new Date("2026-11-13T10:00:00.000Z");
const at = (min: number) => new Date(T0.getTime() + min * 60_000).toISOString();

test("keep returns keep", () => {
  assert.deepEqual(planAway("keep", at(-30), at(0), at(10)), { kind: "keep" });
});

test("discard ends the span at the away start", () => {
  assert.deepEqual(planAway("discard", at(-30), at(0), at(10)), { kind: "discard", endAt: at(0) });
});

test("break splits and rests for the away time", () => {
  assert.deepEqual(planAway("break", at(-30), at(0), at(10)), {
    kind: "break",
    endAt: at(0),
    restFrom: at(0),
    restTo: at(10),
    resumeAt: at(10),
  });
});

test("awayFrom is clamped up to the timer start", () => {
  assert.deepEqual(planAway("discard", at(5), at(0), at(10)), { kind: "discard", endAt: at(5) });
  const p = planAway("break", at(5), at(0), at(10));
  assert.equal(p.kind, "break");
  if (p.kind === "break") assert.equal(p.restFrom, at(5));
});

test("none when the timer started at or after awayTo", () => {
  for (const c of ["keep", "break", "discard"] as const) {
    assert.deepEqual(planAway(c, at(10), at(0), at(10)), { kind: "none" });
    assert.deepEqual(planAway(c, at(20), at(0), at(10)), { kind: "none" });
  }
});

test("none when the away span is empty or reversed", () => {
  assert.deepEqual(planAway("keep", at(-30), at(10), at(10)), { kind: "none" });
  assert.deepEqual(planAway("break", at(-30), at(10), at(0)), { kind: "none" });
});

test("invalid dates return none", () => {
  assert.deepEqual(planAway("keep", "nope", at(0), at(10)), { kind: "none" });
  assert.deepEqual(planAway("break", at(-30), "", at(10)), { kind: "none" });
  assert.deepEqual(planAway("discard", at(-30), at(0), "x"), { kind: "none" });
});

test("outputs are normalised ISO strings", () => {
  const p = planAway("discard", "2026-11-13T09:00:00+00:00", "2026-11-13T10:00:00+00:00", "2026-11-13T10:05:00Z");
  assert.deepEqual(p, { kind: "discard", endAt: "2026-11-13T10:00:00.000Z" });
});

test("awayMinutes floors, and is zero for empty, reversed or invalid", () => {
  assert.equal(awayMinutes(at(0), at(10)), 10);
  assert.equal(awayMinutes(at(0), new Date(T0.getTime() + 119_999).toISOString()), 1);
  assert.equal(awayMinutes(at(0), at(0)), 0);
  assert.equal(awayMinutes(at(10), at(0)), 0);
  assert.equal(awayMinutes("bad", at(0)), 0);
});
