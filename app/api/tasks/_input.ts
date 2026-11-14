import { store } from "@/lib/store";
import { parseQuickAdd, toISODate } from "@/lib/parse";
import type { DateOrder, TaskInput } from "@/lib/types";
import * as v from "@/lib/validate";

/**
 * Turns one request item (a raw line or explicit fields) into a store input.
 * `fallback` is used for a text item with no day token: undefined means today.
 */
export async function toInput(
  raw: unknown,
  opts: { dateOrder: DateOrder | undefined; fallback: string | null | undefined },
): Promise<{ input: TaskInput; commit: boolean }> {
  const b = v.body(raw);
  const today = toISODate(new Date());

  // Two ways in: a raw line to parse (web quick-add, Telegram) or explicit fields.
  const parsed = b.text
    ? parseQuickAdd(v.nonEmpty(b.text, "text", 1000), new Date(), { dateOrder: opts.dateOrder })
    : null;

  const projectName = parsed?.projectName ?? v.optionalStr(b.projectName, "projectName", 120);
  const projectId = projectName
    ? (await store.findOrCreateProjectByName(projectName)).id
    : v.optionalUuid(b.projectId, "projectId");

  let scheduled: string | null;
  if (parsed) {
    if (parsed.scheduled !== undefined) scheduled = parsed.scheduled;
    else if (b.scheduled !== undefined) scheduled = v.nullableIsoDate(b.scheduled, "scheduled");
    else scheduled = opts.fallback !== undefined ? opts.fallback : today;
  } else {
    if (b.scheduled === undefined) v.fail("scheduled is required (a date or null)");
    scheduled = v.nullableIsoDate(b.scheduled, "scheduled");
  }

  const input: TaskInput = {
    title: parsed?.title ?? v.nonEmpty(b.title, "Title", 500),
    notes: parsed?.notes ?? v.optionalStr(b.notes, "notes"),
    projectId,
    // A named column only makes sense alongside the project that owns it.
    stageId: projectId ? v.optionalUuid(b.stageId, "stageId") : undefined,
    tags: parsed?.tags ?? (b.tags !== undefined ? v.tags(b.tags, "tags") : []),
    scheduled,
    dueTime: parsed?.dueTime ?? v.optionalTime(b.dueTime, "dueTime"),
    minutes: parsed?.minutes ?? v.duration(b.minutes, "minutes"),
    priority: parsed?.priority ?? (b.priority !== undefined ? v.priority(b.priority, "priority") : 0),
    recurrence: parsed?.recurrence ?? (b.recurrence ? v.recurrence(b.recurrence, "recurrence") : undefined),
    startOn: parsed?.startOn ?? v.optionalNullableIsoDate(b.startOn, "startOn"),
    expiresOn: parsed?.expiresOn ?? v.optionalNullableIsoDate(b.expiresOn, "expiresOn"),
    isComplex: b.isComplex !== undefined ? v.bool(b.isComplex, "isComplex") : undefined,
    finishDate: b.finishDate ? v.isoDate(b.finishDate, "finishDate") : undefined,
  };
  return { input, commit: parsed?.commit === true };
}
