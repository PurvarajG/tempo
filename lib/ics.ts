import type { Task } from "./types";

/**
 * Open tasks as an iCalendar feed Apple Calendar can subscribe to. Read-only by
 * design: Apple polls this on its own schedule and never writes back, so the
 * only contract that matters is that a task keeps the same `UID` across
 * refetches — otherwise every poll would duplicate the event instead of
 * updating it.
 */

const PRODID = "-//Doem//Task Feed//EN";

/** RFC 5545 §3.3.11: backslash, semicolon, comma and newline are reserved in TEXT. */
export function escapeIcsText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\r\n", "\\n")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\n");
}

/**
 * RFC 5545 §3.1 content-line folding: no line exceeds 75 *octets*, and
 * continuations start with a single space. Split points land on whole
 * characters so a multi-byte character is never cut in half.
 */
export function foldLine(line: string): string {
  if (Buffer.byteLength(line, "utf8") <= 75) return line;

  const out: string[] = [];
  let current = "";
  let limit = 75;

  for (const char of line) {
    const next = current + char;
    if (Buffer.byteLength(next, "utf8") > limit) {
      out.push(current);
      current = char;
      limit = 74; // continuation lines spend one octet on the leading space
    } else {
      current = next;
    }
  }
  out.push(current);

  return out.map((part, i) => (i === 0 ? part : ` ${part}`)).join("\r\n");
}

function compactDate(iso: string): string {
  return iso.replaceAll("-", "");
}

/** `YYYY-MM-DD` plus whole days, staying in date arithmetic (no timezone involved). */
function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

/**
 * A floating local timestamp (`YYYYMMDDTHHMMSS`, no `TZID`, no `Z`) — read as
 * the viewing device's local time, which is what a single-timezone personal
 * calendar wants.
 */
function floatingStamp(iso: string, time: string, addMinutes = 0): string {
  const [year, month, day] = iso.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute + addMinutes));
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00`
  );
}

function utcStamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
}

function eventLines(task: Task & { scheduled: string }, dtstamp: string): string[] {
  const lines = [
    "BEGIN:VEVENT",
    // Deliberately still "@dayplan" after the Tempo and Doem renames: the UID has to be
    // stable across refetches, and changing it would make Apple Calendar
    // duplicate every event it has already imported.
    `UID:${task.id}@dayplan`,
    `DTSTAMP:${dtstamp}`,
  ];

  if (task.isComplex && task.finishDate) {
    // DTEND is exclusive, so a task finishing on the 4th ends on the 5th.
    lines.push(`DTSTART;VALUE=DATE:${compactDate(task.scheduled)}`);
    lines.push(`DTEND;VALUE=DATE:${compactDate(addDays(task.finishDate, 1))}`);
  } else if (task.dueTime) {
    lines.push(`DTSTART:${floatingStamp(task.scheduled, task.dueTime)}`);
    lines.push(`DTEND:${floatingStamp(task.scheduled, task.dueTime, task.minutes)}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${compactDate(task.scheduled)}`);
    lines.push(`DTEND;VALUE=DATE:${compactDate(addDays(task.scheduled, 1))}`);
  }

  lines.push(`SUMMARY:${escapeIcsText(task.title)}`);
  if (task.notes) lines.push(`DESCRIPTION:${escapeIcsText(task.notes)}`);
  lines.push("END:VEVENT");

  return lines;
}

/**
 * No `RRULE`: recurrence here is virtual — completing a task spawns the next
 * occurrence as its own row (`lib/store/tasks.ts`) — so every occurrence that
 * exists is already its own VEVENT.
 */
export function buildIcsFeed(tasks: Task[], now = new Date()): string {
  const dtstamp = utcStamp(now);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Doem Tasks",
    // Undated (inbox) tasks have no day to put on a calendar, so they never get a VEVENT.
    ...tasks
      .filter((task): task is Task & { scheduled: string } => task.status === "open" && !!task.scheduled)
      .flatMap((task) => eventLines(task, dtstamp)),
    "END:VCALENDAR",
  ];

  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
