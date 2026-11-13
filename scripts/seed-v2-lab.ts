/**
 * Fictional data for the Doem v2 build lab: three projects, ~30 tasks in every
 * state the new UI has to render, and 28 days of tracked time. All dates are
 * relative to the day the script runs.
 *
 *   npm run seed:v2-lab
 *
 * Three guards, because this must never touch the real database: LAB_MODE=1,
 * a PGLITE_DIR that isn't the real local dev directory, and a PGLITE_DIR that
 * isn't under the app's real data folder. The caller deletes .data/v2-lab
 * first; this script never deletes anything.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";

export function requireV2LabGuards(env: Record<string, string | undefined> = process.env): void {
  if (env.LAB_MODE !== "1") {
    throw new Error("Refusing to seed: LAB_MODE=1 is not set. Run `npm run seed:v2-lab`, not this file directly.");
  }
  const dir = env.PGLITE_DIR;
  if (!dir || dir.endsWith("pglite")) {
    throw new Error("Refusing to seed: PGLITE_DIR must point at a lab-only directory, not the real dev database.");
  }
  if (dir.includes("Application " + "Support")) {
    throw new Error("Refusing to seed: PGLITE_DIR points into the real app data folder.");
  }
}

// Small seeded PRNG so reruns on the same day give the same shape of data.
let rngState = 20260101;
function rand(): number {
  rngState = (rngState * 1664525 + 1013904223) % 4294967296;
  return rngState / 4294967296;
}
function randInt(min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}
function pick<T>(items: T[]): T {
  return items[randInt(0, items.length - 1)];
}

function dayAt(offset: number, h = 0, min = 0): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset, h, min, 0, 0);
}
function ymd(offset: number): string {
  const d = dayAt(offset);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

async function main() {
  requireV2LabGuards();
  // Imported late so merely importing this file (e.g. from a test) never opens a database.
  const { store } = await import("../lib/store");
  type Task = Awaited<ReturnType<typeof store.addTask>>;

  const categories = await store.listCategories();
  const activities = await store.listActivities();
  const byName = (name: string) => {
    const found = categories.find((c) => c.name === name);
    if (!found) throw new Error(`Expected the default "${name}" category to already be seeded`);
    return found;
  };
  const sleep = byName("Sleep");
  const sleepActivity = activities.find((a) => a.categoryId === sleep.id && a.name === "Sleep")!;
  const admin = byName("Admin");

  const { project: atlas } = await store.addProject({ name: "Atlas Launch", defaultCategoryId: admin.id });
  const { project: homebase } = await store.addProject({ name: "Homebase" });
  const { project: notes } = await store.addProject({ name: "Field Notes" });

  const all: Task[] = [];
  const add = async (
    title: string,
    scheduled: number,
    opts: {
      projectId?: string;
      minutes?: number;
      priority?: 0 | 1 | 2 | 3;
      dueTime?: string;
      recurrence?: { freq: "daily" | "weekly" | "monthly"; interval: number };
      span?: number;
    } = {},
  ) => {
    const t = await store.addTask({
      title,
      scheduled: ymd(scheduled),
      minutes: opts.minutes ?? pick([15, 30, 60, 120]),
      priority: opts.priority ?? (randInt(0, 3) as 0 | 1 | 2 | 3),
      projectId: opts.projectId,
      dueTime: opts.dueTime,
      recurrence: opts.recurrence,
      isComplex: opts.span ? true : undefined,
      finishDate: opts.span ? ymd(scheduled + opts.span) : undefined,
    });
    all.push(t);
    return t;
  };

  // Today: several scheduled, some timed.
  const today = [
    await add("Draft the launch announcement", 0, { projectId: atlas.id, minutes: 60, priority: 3, dueTime: "10:00" }),
    await add("Review the pricing table", 0, { projectId: atlas.id, minutes: 30, priority: 2 }),
    await add("Book the plumber", 0, { projectId: homebase.id, minutes: 15, priority: 1, dueTime: "14:30" }),
    await add("Sort the garden photos", 0, { projectId: notes.id, minutes: 60, priority: 0 }),
    await add("Pay the council tax", 0, { minutes: 15, priority: 2 }),
    await add("Call the dentist", 0, { minutes: 15, priority: 1, dueTime: "16:00" }),
  ];

  // Next seven days.
  await add("Outline the onboarding emails", 1, { projectId: atlas.id, minutes: 120, priority: 2 });
  await add("Measure the spare room", 1, { projectId: homebase.id, minutes: 30, priority: 1 });
  await add("Transcribe the river walk notes", 2, { projectId: notes.id, minutes: 60, priority: 1 });
  await add("Order shelving brackets", 2, { projectId: homebase.id, minutes: 15, priority: 0, dueTime: "09:00" });
  await add("Test the signup flow", 3, { projectId: atlas.id, minutes: 120, priority: 3, dueTime: "11:00" });
  await add("Renew the car insurance", 4, { minutes: 30, priority: 2 });
  await add("Paint the hallway", 5, { projectId: homebase.id, minutes: 240, priority: 1 });
  await add("Edit the field recordings", 5, { projectId: notes.id, minutes: 120, priority: 2 });
  await add("Write the launch retro", 6, { projectId: atlas.id, minutes: 60, priority: 1 });
  await add("Plan the weekend trip", 7, { minutes: 30, priority: 0 });

  // Exactly four carried over: scheduled in the past, still open.
  await add("Reply to the vendor thread", -1, { projectId: atlas.id, minutes: 30, priority: 2 });
  await add("Fix the dripping tap", -3, { projectId: homebase.id, minutes: 60, priority: 1 });
  await add("Label the sample jars", -4, { projectId: notes.id, minutes: 30, priority: 0 });
  await add("Back up the laptop", -6, { minutes: 15, priority: 1 });

  // Repeating.
  await add("Water the plants", 0, { projectId: homebase.id, minutes: 15, priority: 0, recurrence: { freq: "weekly", interval: 1 } });
  await add("Daily shutdown review", 1, { minutes: 15, priority: 1, recurrence: { freq: "daily", interval: 1 } });
  await add("Monthly invoices", 3, { projectId: atlas.id, minutes: 60, priority: 2, recurrence: { freq: "monthly", interval: 1 } });

  // Multi-day spans.
  await add("Build the press kit", 1, { projectId: atlas.id, minutes: 480, priority: 2, span: 3 });
  await add("Sand and varnish the desk", 2, { projectId: homebase.id, minutes: 480, priority: 1, span: 4 });

  // Done today (completed through the store, so completedAt is real).
  const doneToday: Task[] = [];
  for (const [title, projectId] of [
    ["Send the weekly update", atlas.id],
    ["Take the bins out", homebase.id],
    ["File the trip receipts", undefined],
    ["Tag the morning's field notes", notes.id],
  ] as const) {
    const t = await add(title, 0, { projectId, minutes: 30, priority: 1 });
    await store.completeTask(t.id);
    doneToday.push(t);
  }

  // Subtasks: some done.
  const withSubs: Array<[Task, string[], number]> = [
    [today[0], ["Outline", "First draft", "Get a second pair of eyes", "Schedule it"], 2],
    [all.find((t) => t.title === "Paint the hallway")!, ["Tape the edges", "First coat", "Second coat"], 0],
    [all.find((t) => t.title === "Build the press kit")!, ["Logo pack", "Screenshots", "Boilerplate"], 1],
    [today[3], ["Pick the best 20", "Rename the files"], 1],
  ];
  let subtaskCount = 0;
  for (const [task, titles, doneCount] of withSubs) {
    for (let i = 0; i < titles.length; i++) {
      const s = await store.addSubtask(task.id, titles[i]);
      if (i < doneCount) await store.updateSubtask(s.id, { done: true });
      subtaskCount++;
    }
  }

  // Tasks without a project, for the record.
  const noProject = all.filter((t) => !t.projectId).length;

  // 28 days of tracked time. Segments cannot overlap, so each day is one cursor.
  const now = new Date();
  const taskPool = (offset: number) =>
    all.filter((t) => (t.scheduled !== null && t.scheduled <= ymd(offset)) || offset <= 0).filter((t) => t.status !== "trashed");
  const workKinds = ["work", "upkeep", "rest"];
  let segments = 0;
  let taskSegments = 0;
  const trackedDays = new Set<number>();

  for (let offset = -27; offset <= 0; offset++) {
    const prev = dayAt(offset - 1, 23, randInt(0, 20));
    const sleepEnd = dayAt(offset, randInt(6, 7), randInt(0, 40));
    if (sleepEnd < now) {
      await store.addManualSegment({
        startedAt: prev.toISOString(),
        endedAt: sleepEnd.toISOString(),
        categoryId: sleep.id,
        activityId: sleepActivity.id,
      });
      segments++;
    }

    const weekend = [0, 6].includes(dayAt(offset).getDay());
    const clean = offset % 3 === 0;
    let cursor = new Date(Math.max(sleepEnd.getTime(), dayAt(offset, 8, 0).getTime()));
    const dayEnd = weekend ? dayAt(offset, 18, 0) : dayAt(offset, 18, 30);
    const limit = dayEnd < now ? dayEnd : now;
    const pool = taskPool(offset);

    while (cursor < limit) {
      const minutes = clean ? randInt(45, 120) : randInt(20, 60);
      const end = new Date(cursor.getTime() + minutes * 60_000);
      if (end > limit) break;
      const linkToTask = !weekend && pool.length > 0 && rand() < 0.55;
      if (linkToTask) {
        await store.addManualSegment({ startedAt: cursor.toISOString(), endedAt: end.toISOString(), taskId: pick(pool).id });
        taskSegments++;
      } else {
        const options = activities.filter((a) => {
          const c = categories.find((x) => x.id === a.categoryId);
          return c && c.name !== "Sleep" && workKinds.includes(c.kind);
        });
        const a = pick(options);
        await store.addManualSegment({ startedAt: cursor.toISOString(), endedAt: end.toISOString(), categoryId: a.categoryId, activityId: a.id });
      }
      segments++;
      trackedDays.add(offset);
      cursor = new Date(end.getTime() + randInt(0, clean ? 5 : 20) * 60_000);
    }
  }

  const everything = await store.allTasks();
  const open = everything.filter((t) => t.status === "open");
  console.log("Seeded v2 lab:");
  console.log(`  projects:        3`);
  console.log(`  tasks:           ${everything.length} (${open.length} open, ${everything.filter((t) => t.status === "done").length} done)`);
  console.log(`  scheduled today: ${open.filter((t) => t.scheduled === ymd(0)).length} open, ${doneToday.length} done today`);
  console.log(`  next 7 days:     ${open.filter((t) => t.scheduled !== null && t.scheduled > ymd(0) && t.scheduled <= ymd(7)).length}`);
  console.log(`  carried over:    ${open.filter((t) => t.scheduled !== null && t.scheduled < ymd(0)).length}`);
  console.log(`  repeating:       ${open.filter((t) => t.recurrence).length}`);
  console.log(`  timed (dueTime): ${open.filter((t) => t.dueTime).length}`);
  console.log(`  multi-day:       ${open.filter((t) => t.isComplex).length}`);
  console.log(`  with subtasks:   ${everything.filter((t) => t.subtasks.length > 0).length} (${subtaskCount} subtasks)`);
  console.log(`  no project:      ${noProject}`);
  console.log(`  segments:        ${segments} over ${trackedDays.size} tracked days (${taskSegments} linked to tasks)`);
}

const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === entry) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
