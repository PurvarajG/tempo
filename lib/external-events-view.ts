import { fmtTime } from "./format";
import type { ExternalEvent } from "./icloud";
import { toISODate } from "./parse";

/**
 * Client-side shaping for imported events. Deliberately separate from
 * `lib/icloud.ts` so the browser bundle never pulls in the CalDAV stack — only
 * the `ExternalEvent` type crosses over, and types are erased at build.
 *
 * Timed events are placed by the *viewer's* local day. The server that fetched
 * them is probably UTC, so doing this on the server would put a 21:00 meeting on
 * tomorrow's square.
 */

/** A runaway or corrupt DTEND shouldn't be able to spin the grid loop forever. */
const MAX_SPAN_DAYS = 366;

function nextDay(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

function daysCovered(event: ExternalEvent): string[] {
  if (!event.allDay) return [toISODate(new Date(event.start))];

  const days: string[] = [];
  let cursor = event.start;
  // DTEND is exclusive in iCalendar, so the end date itself isn't covered.
  while (cursor < event.end && days.length < MAX_SPAN_DAYS) {
    days.push(cursor);
    cursor = nextDay(cursor);
  }
  // A zero-length or backwards span is still worth showing on its start day.
  return days.length > 0 ? days : [event.start];
}

export function groupExternalEventsByDate(events: ExternalEvent[]): Map<string, ExternalEvent[]> {
  const map = new Map<string, ExternalEvent[]>();

  for (const event of events) {
    for (const iso of daysCovered(event)) {
      const list = map.get(iso) ?? [];
      list.push(event);
      map.set(iso, list);
    }
  }

  for (const list of map.values()) list.sort((a, b) => a.start.localeCompare(b.start));
  return map;
}

/** "09:00 to 10:30" (24-hour, via fmtTime), or "All day". Local to whoever is looking at it. */
export function externalEventLabel(event: ExternalEvent): string {
  if (event.allDay) return "All day";

  const start = new Date(event.start);
  const end = new Date(event.end);
  const asTime = (date: Date) =>
    fmtTime(`${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`);

  const from = asTime(start);
  return start.getTime() === end.getTime() ? from : `${from} – ${asTime(end)}`;
}
