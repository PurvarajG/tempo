import {
  CATEGORY_KINDS,
  DURATIONS,
  STAGE_KINDS,
  type CategoryKind,
  type DayEnergy,
  type Duration,
  type Priority,
  type Recurrence,
  type StageKind,
} from "./types";

/**
 * Hand-rolled because the payloads are small and the app ships no validation
 * dependency. Every helper returns a value or throws `Invalid`, which route
 * handlers turn into a specific 400.
 */
export class Invalid extends Error {}

export function fail(message: string): never {
  throw new Invalid(message);
}

export function body(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("Expected an object");
  return value as Record<string, unknown>;
}

export function str(value: unknown, field: string, max = 10_000): string {
  if (typeof value !== "string") fail(`${field} must be text`);
  return value.slice(0, max);
}

export function nonEmpty(value: unknown, field: string, max = 500): string {
  const s = str(value, field, max).trim();
  if (!s) fail(`${field} can't be empty`);
  return s;
}

export function optionalStr(value: unknown, field: string, max = 10_000): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return str(value, field, max);
}

export function uuid(value: unknown, field: string): string {
  const s = str(value, field, 64);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    fail(`${field} isn't a valid id`);
  }
  return s;
}

export function optionalUuid(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return uuid(value, field);
}

export function uuidList(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) fail(`${field} must be a list`);
  return value.map((v) => uuid(v, field));
}

/** Local YYYY-MM-DD, validated as a real calendar date rather than a shape. */
export function isoDate(value: unknown, field: string): string {
  const s = str(value, field, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) fail(`${field} must look like YYYY-MM-DD`);
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    fail(`${field} isn't a real date`);
  }
  return s;
}

export function isoTimestamp(value: unknown, field: string): string {
  const s = str(value, field, 40);
  const t = Date.parse(s);
  if (Number.isNaN(t)) fail(`${field} isn't a valid time`);
  return new Date(t).toISOString();
}

export function optionalTime(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const s = str(value, field, 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) fail(`${field} must look like HH:MM`);
  return s;
}

/** Any whole number of minutes — estimates are not capped, see DURATIONS. */
export function duration(value: unknown, field: string): Duration {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) fail(`${field} must be a whole number of minutes, at least 1`);
  return n;
}

export function priority(value: unknown, field: string): Priority {
  const n = Number(value);
  if (![0, 1, 2, 3].includes(n)) fail(`${field} must be 0-3`);
  return n as Priority;
}

export function stageKind(value: unknown, field: string): StageKind {
  const s = str(value, field, 20);
  if (!STAGE_KINDS.includes(s as StageKind)) fail(`${field} must be one of ${STAGE_KINDS.join(", ")}`);
  return s as StageKind;
}

export function minutes(value: unknown, field: string, max = Number.MAX_SAFE_INTEGER): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > max) {
    fail(
      max === Number.MAX_SAFE_INTEGER
        ? `${field} must be a whole number, at least 1`
        : `${field} must be 1-${max}`,
    );
  }
  return n;
}

export function index(value: unknown, field: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) fail(`${field} must be a position`);
  return n;
}

export function bool(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") fail(`${field} must be true or false`);
  return value;
}

export function tags(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) fail(`${field} must be a list`);
  return value.map((v) => nonEmpty(v, field, 60).toLowerCase()).slice(0, 25);
}

export function categoryKind(value: unknown, field: string): CategoryKind {
  const s = str(value, field, 20);
  if (!CATEGORY_KINDS.includes(s as CategoryKind)) {
    fail(`${field} must be one of ${CATEGORY_KINDS.join(", ")}`);
  }
  return s as CategoryKind;
}

export function hour(value: unknown, field: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 23) fail(`${field} must be an hour, 0-23`);
  return n;
}

/**
 * Cap for keys in stringList fields (moduleOrder, hiddenModules,
 * collapsedModules, hiddenNavItems). Must comfortably fit the longest key
 * any caller actually builds: `board-backlog-${stageId}` where stageId is a
 * randomUUID (14 + 36 = 50 chars), plus headroom for future prefixes of
 * similar shape. DO NOT tighten this back toward the literal module-name
 * keys ("now", "records", ...) without checking every collapsedModules /
 * hiddenModules writer for UUID-derived keys first — a lower cap silently
 * truncates such a key into a different, valid-looking key instead of
 * rejecting it, which is exactly how this class of bug went unnoticed
 * (see board-backlog collapse-key truncation).
 */
const STRING_LIST_ITEM_MAX = 80;

export function stringList(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) fail(`${field} must be a list`);
  return value.map((v) => {
    if (typeof v !== "string") fail(`${field} must be text`);
    if (v.length > STRING_LIST_ITEM_MAX) {
      fail(`${field} entries must be ${STRING_LIST_ITEM_MAX} characters or fewer`);
    }
    return v;
  });
}

export function nullableIsoDate(value: unknown, field: string): string | null {
  if (value === null) return null;
  return isoDate(value, field);
}

export function optionalNullableIsoDate(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  return nullableIsoDate(value, field);
}

export function recurrence(value: unknown, field: string): Recurrence {
  const r = body(value);
  const freq = str(r.freq, `${field}.freq`, 10);
  if (!["daily", "weekly", "monthly"].includes(freq)) fail(`${field}.freq is invalid`);
  const out: Recurrence = {
    freq: freq as Recurrence["freq"],
    interval: minutes(r.interval ?? 1, `${field}.interval`, 365),
  };
  if (r.from !== undefined) {
    const from = str(r.from, `${field}.from`, 10);
    if (from !== "schedule" && from !== "done") fail(`${field}.from is invalid`);
    out.from = from;
  }
  return out;
}

export function energy(value: unknown, field: string): DayEnergy | null {
  if (value === null) return null;
  if (value !== 1 && value !== 2 && value !== 3) fail(`${field} must be 1, 2 or 3`);
  return value as DayEnergy;
}

export function weekday(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 6) {
    fail(`${field} must be a weekday, 0-6`);
  }
  return value;
}

export function oneOf<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    fail(`${field} must be one of ${allowed.join(", ")}`);
  }
  return value as T;
}

export function nullablePositiveInt(value: unknown, field: string, max: number): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > max) {
    fail(`${field} must be a whole number, 1-${max}`);
  }
  return value;
}

/** Electron accelerator style, for example "Control+Alt+Space". */
export function shortcut(value: unknown, field: string): string {
  const s = str(value, field, 200);
  if (!s.trim()) fail(`${field} can't be empty`);
  if (s.length > 60) fail(`${field} must be 60 characters or fewer`);
  if (!/^[A-Za-z0-9]+(\+[A-Za-z0-9]+)*$/.test(s)) {
    fail(`${field} must look like Control+Alt+Space`);
  }
  return s;
}
