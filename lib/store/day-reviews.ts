import type { DayEnergy, DayReview } from "../types";
import { db, rowToDayReview, type DayReviewRow } from "./rows";

const COLS = `day::text as day, energy, note, updated_at`;

export async function getDayReview(day: string): Promise<DayReview | null> {
  const rows = await db.query<DayReviewRow>(`select ${COLS} from day_reviews where day = $1`, [day]);
  return rows.length ? rowToDayReview(rows[0]) : null;
}

export async function saveDayReview(
  day: string,
  input: { energy: DayEnergy | null; note: string | null },
): Promise<DayReview> {
  const rows = await db.query<DayReviewRow>(
    `insert into day_reviews (day, energy, note, updated_at) values ($1, $2, $3, now())
     on conflict (day) do update set energy = excluded.energy, note = excluded.note, updated_at = now()
     returning ${COLS}`,
    [day, input.energy, input.note],
  );
  return rowToDayReview(rows[0]);
}

/** Reviews from `fromISO` to `toISO`, both inclusive, oldest first. */
export async function listDayReviews(fromISO: string, toISO: string): Promise<DayReview[]> {
  const rows = await db.query<DayReviewRow>(
    `select ${COLS} from day_reviews where day >= $1 and day <= $2 order by day asc`,
    [fromISO, toISO],
  );
  return rows.map(rowToDayReview);
}
