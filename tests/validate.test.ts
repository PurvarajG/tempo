import assert from "node:assert/strict";
import test from "node:test";
import * as v from "../lib/validate";

const uuid = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

test("rejects dates that only look like dates", () => {
  assert.equal(v.isoDate("2026-03-01", "scheduled"), "2026-03-01");
  assert.throws(() => v.isoDate("2026-02-30", "scheduled"), v.Invalid);
  assert.throws(() => v.isoDate("2026-13-01", "scheduled"), v.Invalid);
  assert.throws(() => v.isoDate("March 1", "scheduled"), v.Invalid);
});

test("times must be a real 24-hour clock reading", () => {
  assert.equal(v.optionalTime("09:30", "dueTime"), "09:30");
  assert.equal(v.optionalTime("", "dueTime"), undefined);
  assert.throws(() => v.optionalTime("24:00", "dueTime"), v.Invalid);
  assert.throws(() => v.optionalTime("9:30", "dueTime"), v.Invalid);
});

test("enums are closed sets", () => {
  assert.equal(v.stageKind("blocked", "kind"), "blocked");
  assert.throws(() => v.stageKind("archived", "kind"), v.Invalid);
  assert.equal(v.priority(2, "priority"), 2);
  assert.throws(() => v.priority(4, "priority"), v.Invalid);
  assert.equal(v.categoryKind("upkeep", "kind"), "upkeep");
  assert.throws(() => v.categoryKind("hobby", "kind"), v.Invalid);
});

test("an hour is a whole 0-23, and a string list rejects non-lists", () => {
  assert.equal(v.hour(4, "dayStartHour"), 4);
  assert.equal(v.hour(23, "dayStartHour"), 23);
  assert.throws(() => v.hour(24, "dayStartHour"), v.Invalid);
  assert.throws(() => v.hour(-1, "dayStartHour"), v.Invalid);
  assert.throws(() => v.hour(4.5, "dayStartHour"), v.Invalid);
  assert.deepEqual(v.stringList(["now", "ribbon"], "moduleOrder"), ["now", "ribbon"]);
  assert.throws(() => v.stringList("now", "moduleOrder"), v.Invalid);
});

test("a stringList key built from a UUID (e.g. board-backlog-<stageId>) round-trips unchanged rather than being silently truncated", () => {
  const key = `board-backlog-${uuid}`;
  assert.equal(key.length, 50);
  assert.deepEqual(v.stringList([key], "collapsedModules"), [key]);
  // An absurdly long entry must be rejected outright, never sliced into a
  // different, valid-looking key — that silent truncation is exactly what
  // let the board-backlog collapse key duplicate without bound.
  assert.throws(() => v.stringList(["x".repeat(200)], "collapsedModules"), v.Invalid);
});

test("ids must be well-formed before they reach SQL", () => {
  assert.equal(v.uuid(uuid, "id"), uuid);
  assert.throws(() => v.uuid("'; drop table tasks; --", "id"), v.Invalid);
  assert.equal(v.optionalUuid("", "projectId"), undefined);
  assert.deepEqual(v.uuidList([uuid], "ids"), [uuid]);
  assert.throws(() => v.uuidList(uuid, "ids"), v.Invalid);
});

test("required text can't be whitespace, and durations have bounds", () => {
  assert.equal(v.nonEmpty("  Write the plan  ", "Title"), "Write the plan");
  assert.throws(() => v.nonEmpty("   ", "Title"), v.Invalid);
  assert.throws(() => v.minutes(0, "minutes"), v.Invalid);
  assert.throws(() => v.minutes(1.5, "minutes"), v.Invalid);
  assert.equal(v.minutes(90, "minutes"), 90);
});

test("estimates have no upper bound — a task can be its own miniproject", () => {
  assert.equal(v.duration(45, "minutes"), 45);
  assert.equal(v.duration(60 * 24 * 30, "minutes"), 43_200);
  assert.equal(v.minutes(60 * 40, "minutes"), 2_400, "a tracked session can run past a day");
  assert.throws(() => v.duration(0, "minutes"), v.Invalid);
  assert.throws(() => v.duration(12.5, "minutes"), v.Invalid);
});

test("booleans must be actual booleans, not truthy strings", () => {
  assert.equal(v.bool(true, "isComplex"), true);
  assert.equal(v.bool(false, "isComplex"), false);
  assert.throws(() => v.bool("true", "isComplex"), v.Invalid);
  assert.throws(() => v.bool(1, "isComplex"), v.Invalid);
});

test("bodies must be objects", () => {
  assert.deepEqual(v.body({ a: 1 }), { a: 1 });
  assert.throws(() => v.body([1, 2]), v.Invalid);
  assert.throws(() => v.body(null), v.Invalid);
});

test("nullable and optional dates", () => {
  assert.equal(v.nullableIsoDate(null, "scheduled"), null);
  assert.equal(v.nullableIsoDate("2026-03-01", "scheduled"), "2026-03-01");
  assert.throws(() => v.nullableIsoDate(undefined, "scheduled"), v.Invalid);
  assert.throws(() => v.nullableIsoDate("2026-02-30", "scheduled"), v.Invalid);
  assert.equal(v.optionalNullableIsoDate(undefined, "startOn"), undefined);
  assert.equal(v.optionalNullableIsoDate(null, "startOn"), null);
  assert.equal(v.optionalNullableIsoDate("2026-03-01", "startOn"), "2026-03-01");
  assert.throws(() => v.optionalNullableIsoDate("nope", "startOn"), v.Invalid);
});

test("recurrence validates freq, interval and from", () => {
  assert.deepEqual(v.recurrence({ freq: "daily" }, "recurrence"), { freq: "daily", interval: 1 });
  assert.deepEqual(v.recurrence({ freq: "weekly", interval: 2, from: "done" }, "recurrence"), {
    freq: "weekly",
    interval: 2,
    from: "done",
  });
  assert.deepEqual(v.recurrence({ freq: "monthly", interval: 365, from: "schedule" }, "r"), {
    freq: "monthly",
    interval: 365,
    from: "schedule",
  });
  assert.throws(() => v.recurrence({ freq: "yearly" }, "recurrence"), v.Invalid);
  assert.throws(() => v.recurrence({ freq: "daily", interval: 0 }, "recurrence"), v.Invalid);
  assert.throws(() => v.recurrence({ freq: "daily", interval: 366 }, "recurrence"), v.Invalid);
  assert.throws(() => v.recurrence({ freq: "daily", interval: 1.5 }, "recurrence"), v.Invalid);
  assert.throws(() => v.recurrence({ freq: "daily", from: "never" }, "recurrence"), v.Invalid);
  assert.throws(() => v.recurrence("daily", "recurrence"), v.Invalid);
  assert.throws(() => v.recurrence(null, "recurrence"), v.Invalid);
});

test("energy is null or 1 to 3", () => {
  assert.equal(v.energy(null, "energy"), null);
  assert.equal(v.energy(1, "energy"), 1);
  assert.equal(v.energy(3, "energy"), 3);
  assert.throws(() => v.energy(0, "energy"), v.Invalid);
  assert.throws(() => v.energy(4, "energy"), v.Invalid);
  assert.throws(() => v.energy(2.5, "energy"), v.Invalid);
  assert.throws(() => v.energy("2", "energy"), v.Invalid);
  assert.throws(() => v.energy(undefined, "energy"), v.Invalid);
});

test("weekday is a whole 0-6", () => {
  assert.equal(v.weekday(0, "day"), 0);
  assert.equal(v.weekday(6, "day"), 6);
  assert.throws(() => v.weekday(7, "day"), v.Invalid);
  assert.throws(() => v.weekday(-1, "day"), v.Invalid);
  assert.throws(() => v.weekday(1.5, "day"), v.Invalid);
  assert.throws(() => v.weekday("1", "day"), v.Invalid);
  assert.throws(() => v.weekday(null, "day"), v.Invalid);
});

test("oneOf is a closed set", () => {
  assert.equal(v.oneOf("dmy", "dateOrder", ["dmy", "mdy"] as const), "dmy");
  assert.throws(() => v.oneOf("ymd", "dateOrder", ["dmy", "mdy"] as const), v.Invalid);
  assert.throws(() => v.oneOf(1, "dateOrder", ["dmy", "mdy"] as const), v.Invalid);
  assert.throws(() => v.oneOf(null, "dateOrder", ["dmy", "mdy"] as const), v.Invalid);
});

test("nullablePositiveInt allows null or 1..max", () => {
  assert.equal(v.nullablePositiveInt(null, "wip", 50), null);
  assert.equal(v.nullablePositiveInt(1, "wip", 50), 1);
  assert.equal(v.nullablePositiveInt(50, "wip", 50), 50);
  assert.throws(() => v.nullablePositiveInt(0, "wip", 50), v.Invalid);
  assert.throws(() => v.nullablePositiveInt(51, "wip", 50), v.Invalid);
  assert.throws(() => v.nullablePositiveInt(2.5, "wip", 50), v.Invalid);
  assert.throws(() => v.nullablePositiveInt("3", "wip", 50), v.Invalid);
  assert.throws(() => v.nullablePositiveInt(undefined, "wip", 50), v.Invalid);
});

test("shortcut is an accelerator string", () => {
  assert.equal(v.shortcut("Control+Alt+Space", "shortcut"), "Control+Alt+Space");
  assert.equal(v.shortcut("CommandOrControl+Shift+K", "shortcut"), "CommandOrControl+Shift+K");
  assert.equal(v.shortcut("F5", "shortcut"), "F5");
  assert.throws(() => v.shortcut("", "shortcut"), v.Invalid);
  assert.throws(() => v.shortcut("   ", "shortcut"), v.Invalid);
  assert.throws(() => v.shortcut("Control + Alt", "shortcut"), v.Invalid);
  assert.throws(() => v.shortcut("Control+", "shortcut"), v.Invalid);
  assert.throws(() => v.shortcut("Ctrl+Alt+$", "shortcut"), v.Invalid);
  assert.throws(() => v.shortcut("A".repeat(61), "shortcut"), v.Invalid);
  assert.throws(() => v.shortcut(5, "shortcut"), v.Invalid);
});
