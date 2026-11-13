import { loadExternalEvents } from "@/lib/external-events";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string | null): value is string {
  if (!value || !ISO_DATE.test(value)) return false;
  // Rejects the ones that match the shape but aren't real, like 2026-13-01.
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/**
 * Unlike the export feed, this is an in-app request served only by Doem's
 * loopback-only desktop server, so it needs no separate URL token.
 *
 * It never 500s: a broken or unconfigured iCloud connection must not take the
 * calendar page down with it.
 */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const start = params.get("start");
  const end = params.get("end");

  if (!validDate(start) || !validDate(end) || start > end) {
    return Response.json({ error: "Expected a start and end date, as YYYY-MM-DD" }, { status: 400 });
  }

  return Response.json(await loadExternalEvents(start, end));
}
