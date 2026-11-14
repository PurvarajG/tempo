import assert from "node:assert/strict";
import test from "node:test";
import { buildIcsFeed, escapeIcsText, foldLine } from "../lib/ics";
import type { Task } from "../lib/types";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "A task",
    boardOrder: 0,
    tags: [],
    scheduled: "2026-03-01",
    minutes: 30,
    priority: 0,
    status: "open",
    isComplex: false,
    sortOrder: 0,
    createdAt: "2026-02-01T00:00:00.000Z",
    subtasks: [],
    ...overrides,
  };
}

/** Unfolds the 75-octet line breaks so assertions can talk about logical lines. */
function lines(feed: string): string[] {
  return feed.replace(/\r\n[ \t]/g, "").split("\r\n");
}

test("the feed is a well-formed VCALENDAR with CRLF line endings", () => {
  const feed = buildIcsFeed([task()]);
  assert.ok(feed.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(feed.endsWith("END:VCALENDAR\r\n"));
  assert.ok(!/(^|[^\r])\n/.test(feed), "every newline is preceded by a carriage return");

  const l = lines(feed);
  assert.ok(l.includes("VERSION:2.0"));
  assert.ok(l.includes("PRODID:-//Doem//Task Feed//EN"));
  assert.ok(l.includes("BEGIN:VEVENT"));
  assert.ok(l.includes("END:VEVENT"));
});

test("a task's UID is stable so Apple Calendar updates rather than duplicates", () => {
  const t = task();
  const first = lines(buildIcsFeed([t])).find((line) => line.startsWith("UID:"));
  const second = lines(buildIcsFeed([t])).find((line) => line.startsWith("UID:"));
  assert.equal(first, `UID:${t.id}@dayplan`);
  assert.equal(first, second);
});

test("a task with a due time becomes a floating timed event of its duration", () => {
  const l = lines(buildIcsFeed([task({ dueTime: "09:30", minutes: 60 })]));
  assert.ok(l.includes("DTSTART:20260301T093000"), l.join("\n"));
  assert.ok(l.includes("DTEND:20260301T103000"), l.join("\n"));
  // Floating local time: no TZID parameter and no trailing Z.
  assert.ok(!l.some((line) => line.startsWith("DTSTART;TZID") || line === "DTSTART:20260301T093000Z"));
});

test("a timed event that runs past midnight carries into the next day", () => {
  const l = lines(buildIcsFeed([task({ scheduled: "2026-03-01", dueTime: "23:30", minutes: 60 })]));
  assert.ok(l.includes("DTSTART:20260301T233000"));
  assert.ok(l.includes("DTEND:20260302T003000"));
});

test("a task without a due time is a single all-day event", () => {
  const l = lines(buildIcsFeed([task()]));
  assert.ok(l.includes("DTSTART;VALUE=DATE:20260301"), l.join("\n"));
  assert.ok(l.includes("DTEND;VALUE=DATE:20260302"), "DTEND is exclusive");
});

test("a complex task spans scheduled through finishDate with an exclusive DTEND", () => {
  const l = lines(buildIcsFeed([task({ isComplex: true, scheduled: "2026-03-01", finishDate: "2026-03-04" })]));
  assert.ok(l.includes("DTSTART;VALUE=DATE:20260301"));
  assert.ok(l.includes("DTEND;VALUE=DATE:20260305"));
});

test("a complex task without a finish date falls back to a single all-day event", () => {
  const l = lines(buildIcsFeed([task({ isComplex: true })]));
  assert.ok(l.includes("DTSTART;VALUE=DATE:20260301"));
  assert.ok(l.includes("DTEND;VALUE=DATE:20260302"));
});

test("only open tasks reach the feed", () => {
  const feed = buildIcsFeed([
    task({ id: "open-1", title: "Still open" }),
    task({ id: "done-1", title: "Finished", status: "done" }),
    task({ id: "trash-1", title: "Deleted", status: "trashed" }),
  ]);
  assert.ok(feed.includes("Still open"));
  assert.ok(!feed.includes("Finished"));
  assert.ok(!feed.includes("Deleted"));
  assert.equal(feed.match(/BEGIN:VEVENT/g)?.length, 1);
});

test("title and notes are escaped per RFC 5545", () => {
  const l = lines(buildIcsFeed([task({ title: "Pay; rent, now\\then", notes: "line one\nline two" })]));
  assert.ok(l.includes("SUMMARY:Pay\\; rent\\, now\\\\then"), l.join("\n"));
  assert.ok(l.includes("DESCRIPTION:line one\\nline two"), l.join("\n"));
});

test("notes are omitted when the task has none", () => {
  assert.ok(!buildIcsFeed([task()]).includes("DESCRIPTION"));
});

test("DTSTAMP is a UTC timestamp", () => {
  const stamp = lines(buildIcsFeed([task()])).find((line) => line.startsWith("DTSTAMP:"));
  assert.match(stamp ?? "", /^DTSTAMP:\d{8}T\d{6}Z$/);
});

test("escapeIcsText handles every reserved character", () => {
  assert.equal(escapeIcsText("a\\b;c,d\ne"), "a\\\\b\\;c\\,d\\ne");
  assert.equal(escapeIcsText("plain"), "plain");
});

test("foldLine wraps at 75 octets with a leading space on continuations", () => {
  const folded = foldLine(`SUMMARY:${"x".repeat(200)}`).split("\r\n");
  assert.ok(folded.length > 1);
  assert.ok(folded[0].length <= 75);
  for (const continuation of folded.slice(1)) {
    assert.ok(continuation.startsWith(" "));
    assert.ok(continuation.length <= 76, "75 octets of content plus the leading space");
  }
  assert.equal(folded.map((part, i) => (i === 0 ? part : part.slice(1))).join(""), `SUMMARY:${"x".repeat(200)}`);
});

test("folding counts octets, not characters, so multi-byte titles stay valid", () => {
  // "é" is two octets in UTF-8, so 60 of them exceed the 75-octet budget.
  const folded = foldLine(`SUMMARY:${"é".repeat(60)}`).split("\r\n");
  assert.ok(folded.length > 1);
  for (const line of folded) {
    assert.ok(Buffer.byteLength(line, "utf8") <= 76, `line is ${Buffer.byteLength(line, "utf8")} octets`);
  }
});

test("a long title is folded in the emitted feed", () => {
  const feed = buildIcsFeed([task({ title: "y".repeat(200) })]);
  assert.ok(feed.includes("\r\n "), "the feed contains a folded continuation line");
  assert.ok(lines(feed).includes(`SUMMARY:${"y".repeat(200)}`), "unfolding restores the title");
});

test("an undated task produces no VEVENT while a dated one still does", () => {
  const dated = task({ id: "22222222-2222-4222-8222-222222222222", title: "Dated one" });
  const undated = task({ id: "33333333-3333-4333-8333-333333333333", title: "Inbox one", scheduled: null });
  const feed = buildIcsFeed([undated, dated]);
  assert.equal(lines(feed).filter((line) => line === "BEGIN:VEVENT").length, 1);
  assert.ok(feed.includes("Dated one"));
  assert.ok(!feed.includes("Inbox one"));
  assert.ok(!feed.includes(undated.id));
  assert.ok(!lines(feed).some((line) => /^DTSTART[:;]\s*$/.test(line) || line === "DTSTART:" || line === "DTSTART;VALUE=DATE:"));
});
