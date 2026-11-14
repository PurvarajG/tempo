import assert from "node:assert/strict";
import test from "node:test";
import { externalEventLabel, groupExternalEventsByDate } from "../lib/external-events-view";
import type { ExternalEvent } from "../lib/icloud";

function timed(start: string, end: string, overrides: Partial<ExternalEvent> = {}): ExternalEvent {
  return { id: `t-${start}`, title: "Meeting", start, end, allDay: false, ...overrides };
}

function allDay(start: string, end: string, overrides: Partial<ExternalEvent> = {}): ExternalEvent {
  return { id: `a-${start}`, title: "Trip", start, end, allDay: true, ...overrides };
}

/** Runs a block as if the browser were in `tz`, so day-boundary logic is testable. */
function inTimezone(tz: string, fn: () => void) {
  const original = process.env.TZ;
  process.env.TZ = tz;
  try {
    fn();
  } finally {
    process.env.TZ = original;
  }
}

test("a timed event lands on its local calendar day", () => {
  inTimezone("America/New_York", () => {
    const map = groupExternalEventsByDate([timed("2026-03-10T14:00:00.000Z", "2026-03-10T15:00:00.000Z")]);
    assert.deepEqual([...map.keys()], ["2026-03-10"]);
  });
});

test("a late-evening event stays on the day the viewer sees it, not the UTC day", () => {
  // 21:00 New York on the 10th is 02:00 UTC on the 11th — it belongs to the 10th.
  inTimezone("America/New_York", () => {
    const map = groupExternalEventsByDate([timed("2026-03-11T01:00:00.000Z", "2026-03-11T02:00:00.000Z")]);
    assert.deepEqual([...map.keys()], ["2026-03-10"]);
  });
});

test("an all-day event fills every day it covers, excluding the iCalendar end", () => {
  const map = groupExternalEventsByDate([allDay("2026-03-12", "2026-03-15")]);
  assert.deepEqual([...map.keys()], ["2026-03-12", "2026-03-13", "2026-03-14"]);
});

test("a single-day all-day event occupies exactly one day", () => {
  const map = groupExternalEventsByDate([allDay("2026-03-12", "2026-03-13")]);
  assert.deepEqual([...map.keys()], ["2026-03-12"]);
});

test("a malformed all-day span still shows on its start day", () => {
  const map = groupExternalEventsByDate([allDay("2026-03-12", "2026-03-12")]);
  assert.deepEqual([...map.keys()], ["2026-03-12"]);
});

test("an absurdly long span is truncated rather than looping forever", () => {
  const map = groupExternalEventsByDate([allDay("2026-03-12", "2099-03-12")]);
  assert.ok(map.size > 0 && map.size <= 400, `expected a bounded span, got ${map.size} days`);
});

test("events on the same day are grouped and ordered by start", () => {
  const map = groupExternalEventsByDate([
    timed("2026-03-10T18:00:00.000Z", "2026-03-10T19:00:00.000Z", { id: "late", title: "Late" }),
    timed("2026-03-10T09:00:00.000Z", "2026-03-10T10:00:00.000Z", { id: "early", title: "Early" }),
  ]);
  assert.deepEqual(
    map.get("2026-03-10")?.map((e) => e.title),
    ["Early", "Late"],
  );
});

test("an empty list produces an empty map", () => {
  assert.equal(groupExternalEventsByDate([]).size, 0);
});

test("an all-day event is labelled without a time", () => {
  assert.equal(externalEventLabel(allDay("2026-03-12", "2026-03-13")), "All day");
});

test("a timed event is labelled with its local start and end", () => {
  inTimezone("America/New_York", () => {
    const label = externalEventLabel(timed("2026-03-10T14:00:00.000Z", "2026-03-10T15:30:00.000Z"));
    // 10 March is already EDT (UTC-4), so 14:00Z is 10:00 local.
    assert.equal(label, "10:00 – 11:30");
  });
});

test("a zero-length event is labelled with a single time", () => {
  inTimezone("America/New_York", () => {
    assert.equal(
      externalEventLabel(timed("2026-03-10T14:00:00.000Z", "2026-03-10T14:00:00.000Z")),
      "10:00",
    );
  });
});
