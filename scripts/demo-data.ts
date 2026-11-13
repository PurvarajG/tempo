/**
 * Demo data for screenshots and the launch animation: a believable week for a
 * product designer. Four projects, about thirty tasks (overdue, today, the
 * next seven days, a few done today, a few in the inbox), subtasks, a running
 * timer and seven days of tracked time across categories. Every date is
 * relative to the day the script runs. Fictional; no real people.
 *
 *   PGLITE_DIR=<empty scratch dir> npx tsx scripts/demo-data.ts
 *
 * Environment: PGLITE_DIR only. LAB_MODE is NOT needed.
 *
 * Guards, because this must never touch real data. It refuses when
 * PGLITE_DIR is unset, is "memory://", sits inside ~/Library/Application
 * Support, or is the dev default (<anything>/.data/pglite). It does NOT reject
 * a directory merely because its name ends in "pglite" (unlike the v2-lab
 * seed), so a scratch folder with any other name is fine. It also refuses a
 * directory that already holds tasks: it only fills an empty database, and
 * never deletes anything.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";

export function requireDemoGuards(env: Record<string, string | undefined> = process.env): void {
  const dir = env.PGLITE_DIR;
  if (!dir || dir === "memory://") {
    throw new Error("Refusing to seed: set PGLITE_DIR to an empty scratch directory.");
  }
  if (dir.includes("Application " + "Support")) {
    throw new Error("Refusing to seed: PGLITE_DIR points into the real app data folder.");
  }
  if (path.resolve(dir).endsWith(path.join(".data", "pglite"))) {
    throw new Error("Refusing to seed: PGLITE_DIR is the dev database, not a scratch directory.");
  }
}

function dayAt(offset: number, h = 0, min = 0): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset, h, min, 0, 0);
}
function ymd(offset: number): string {
  const d = dayAt(offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function main() {
  requireDemoGuards();
  // Imported late so merely importing this file (e.g. from a test) never opens a database.
  const { store } = await import("../lib/store");
  const { db } = await import("../lib/store/rows");
  type Task = Awaited<ReturnType<typeof store.addTask>>;

  if ((await store.allTasks()).length > 0) {
    throw new Error("Refusing to seed: this database already has tasks. Point PGLITE_DIR at an empty directory.");
  }

  const categories = await store.listCategories();
  const activities = await store.listActivities();
  const cat = (name: string) => {
    const c = categories.find((x) => x.name === name);
    if (!c) throw new Error(`Expected the default "${name}" category to exist`);
    return c;
  };
  const act = (catName: string, name: string) => {
    const a = activities.find((x) => x.categoryId === cat(catName).id && x.name === name);
    if (!a) throw new Error(`Expected the "${name}" activity under "${catName}"`);
    return a;
  };

  const { project: onboarding } = await store.addProject({ name: "Onboarding Revamp", color: "#0052ff" });
  const { project: pricing } = await store.addProject({ name: "Pricing Page", color: "#7c3aed" });
  const { project: system } = await store.addProject({ name: "Design System", color: "#16a34a" });
  const { project: brand } = await store.addProject({ name: "Brand Refresh", color: "#ea580c", defaultCategoryId: cat("Admin").id });

  const all: Task[] = [];
  const add = async (
    title: string,
    scheduled: number | null,
    projectId: string | undefined,
    minutes: number,
    priority: 0 | 1 | 2 | 3,
    opts: { dueTime?: string; span?: number; recurrence?: { freq: "daily" | "weekly" | "monthly"; interval: number }; notes?: string } = {},
  ) => {
    const t = await store.addTask({
      title,
      scheduled: scheduled === null ? null : ymd(scheduled),
      projectId,
      minutes,
      priority,
      dueTime: opts.dueTime,
      notes: opts.notes,
      recurrence: opts.recurrence,
      isComplex: opts.span ? true : undefined,
      finishDate: opts.span && scheduled !== null ? ymd(scheduled + opts.span) : undefined,
    });
    all.push(t);
    return t;
  };

  // Overdue: scheduled in the past, still open.
  await add("Send usability notes to engineering", -1, onboarding.id, 30, 2);
  await add("Audit the icon set for duplicates", -2, system.id, 60, 1);
  await add("Reply to the agency about logo exports", -3, brand.id, 15, 2);
  await add("Book the dentist", -2, undefined, 15, 1);

  // Today.
  const reviewFlow = await add("Review onboarding flow", 0, onboarding.id, 60, 3, {
    dueTime: "10:30",
    notes: "Walk the five screens on a small phone first, then the empty states.",
  });
  const pricingCopy = await add("Ship pricing page copy", 0, pricing.id, 90, 3);
  const buttonStates = await add("Update button states in the Figma library", 0, system.id, 45, 2);
  await add("Prep for the design critique", 0, onboarding.id, 30, 2, { dueTime: "15:00" });
  await add("Reply to feedback on the mood boards", 0, brand.id, 30, 1);
  await add("Book flights for the conference", 0, undefined, 20, 1);

  // Next seven days.
  await add("Sketch empty states for the inbox", 1, onboarding.id, 120, 2);
  await add("Write alt text for the hero images", 1, pricing.id, 30, 1);
  await add("Run usability sessions", 2, onboarding.id, 180, 3, { dueTime: "14:00" });
  await add("Document the colour tokens", 2, system.id, 60, 1);
  await add("Finalise the pricing tiers layout", 3, pricing.id, 120, 3);
  await add("Renew the passport", 3, undefined, 30, 0);
  await add("Pick typeface pairings", 4, brand.id, 90, 2);
  await add("Present the brand refresh to leadership", 4, brand.id, 60, 3, { dueTime: "11:00" });
  await add("Write the Tooltip component spec", 5, system.id, 120, 2);
  await add("Plan the quarter roadmap", 6, undefined, 60, 1);
  await add("Call the landlord about the lease", 7, undefined, 15, 1);
  await add("Redesign the settings screens", 1, onboarding.id, 480, 2, { span: 3 });
  await add("Weekly design review", 2, undefined, 45, 1, { dueTime: "11:00", recurrence: { freq: "weekly", interval: 1 } });

  // Inbox: no date.
  await add("Look into variable fonts", null, undefined, 30, 0);
  await add("Ideas for the onboarding checklist", null, onboarding.id, 30, 1);
  await add("Read the accessibility audit", null, undefined, 45, 2);

  // Done today (completed through the store so completedAt is real).
  const doneToday: Task[] = [];
  for (const [title, projectId, minutes] of [
    ["Export the onboarding illustrations", onboarding.id, 30],
    ["Sync with the PM on launch scope", pricing.id, 30],
    ["Fix spacing tokens in the cards", system.id, 45],
    ["Order business cards", undefined, 15],
  ] as const) {
    const t = await add(title, 0, projectId, minutes, 1);
    await store.completeTask(t.id);
    doneToday.push(t);
  }

  // Today's three committed tasks (the default cap).
  for (const t of [reviewFlow, pricingCopy, buttonStates]) await store.commitTask(t.id, ymd(0));

  // Subtasks.
  const subs: Array<[Task, string[], number]> = [
    [reviewFlow, ["Welcome screen", "Account setup", "First project", "Empty states"], 2],
    [pricingCopy, ["Headline options", "Tier descriptions", "FAQ answers"], 1],
    [all.find((t) => t.title === "Run usability sessions")!, ["Recruit five people", "Prepare the script", "Book the room"], 2],
    [all.find((t) => t.title === "Present the brand refresh to leadership")!, ["Slides", "Rehearse", "Print the boards"], 0],
  ];
  for (const [task, titles, doneCount] of subs)
    for (let i = 0; i < titles.length; i++) {
      const s = await store.addSubtask(task.id, titles[i]);
      if (i < doneCount) await store.updateSubtask(s.id, { done: true });
    }

  // Spread some board cards across columns so project boards have shape.
  for (const project of [onboarding, pricing, system, brand]) {
    const stages = (await store.listStages(project.id)).filter((s) => s.kind === "backlog" || s.kind === "active");
    const open = all.filter((t) => t.projectId === project.id && t.status !== "done" && !doneToday.includes(t));
    for (let i = 0; i < open.length; i++) {
      const stage = stages[i % Math.max(1, stages.length)];
      if (stage) await store.moveTaskToStage(open[i].id, stage.id, 0);
    }
  }

  // Seven days of tracked time. Blocks are fixed per day (small deterministic
  // jitter); task blocks cycle through the project tasks, the rest use categories.
  const now = new Date();
  const limitToday = new Date(now.getTime() - 30 * 60_000); // leave room for the running timer
  const workTasks = all.filter((t) => t.projectId && t.status !== "trashed");
  type Spec = { task: true } | { cat: string; act?: string };
  const weekday: Array<[number, number, Spec]> = [
    [7 * 60 + 15, 45, { cat: "Health", act: "Exercise" }],
    [8 * 60 + 30, 20, { cat: "Travel", act: "Commute" }],
    [9 * 60 + 10, 90, { task: true }],
    [10 * 60 + 50, 45, { cat: "Focus Work", act: "Meetings" }],
    [11 * 60 + 45, 70, { task: true }],
    [13 * 60, 45, { cat: "Health", act: "Meals" }],
    [14 * 60, 100, { task: true }],
    [16 * 60 + 5, 30, { cat: "Focus Work", act: "Email" }],
    [16 * 60 + 45, 30, { cat: "Admin", act: "Planning" }],
    [19 * 60, 90, { cat: "Personal", act: "Family" }],
  ];
  const weekend: Array<[number, number, Spec]> = [
    [9 * 60, 60, { cat: "Health", act: "Exercise" }],
    [11 * 60, 90, { cat: "Personal", act: "Leisure" }],
    [15 * 60, 120, { cat: "Personal", act: "Social" }],
  ];
  let segments = 0;
  let lastEndToday: Date | null = null;
  for (let offset = -6; offset <= 0; offset++) {
    const seed = (offset + 7) * 7;
    const sleepStart = dayAt(offset - 1, 23, (seed * 3) % 25);
    const sleepEnd = dayAt(offset, 6, 30 + (seed % 25));
    const blocks: Array<{ start: Date; end: Date; spec: Spec | "sleep" }> = [{ start: sleepStart, end: sleepEnd, spec: "sleep" }];
    const isWeekend = [0, 6].includes(dayAt(offset).getDay());
    (isWeekend ? weekend : weekday).forEach(([startMin, mins, spec], i) => {
      const jitter = ((seed + i * 5) % 9);
      const start = dayAt(offset, 0, startMin + jitter);
      blocks.push({ start, end: new Date(start.getTime() + (mins - ((seed + i) % 6)) * 60_000), spec });
    });
    let taskCursor = seed;
    for (const b of blocks) {
      const limit = offset === 0 ? limitToday : now;
      if (b.end > limit) continue;
      if (b.spec === "sleep") {
        await store.addManualSegment({
          startedAt: b.start.toISOString(), endedAt: b.end.toISOString(),
          categoryId: cat("Sleep").id, activityId: act("Sleep", "Sleep").id,
        });
      } else if ("task" in b.spec) {
        const task = workTasks[taskCursor++ % workTasks.length];
        await store.addManualSegment({ startedAt: b.start.toISOString(), endedAt: b.end.toISOString(), taskId: task.id });
      } else {
        await store.addManualSegment({
          startedAt: b.start.toISOString(), endedAt: b.end.toISOString(),
          categoryId: cat(b.spec.cat).id, activityId: b.spec.act ? act(b.spec.cat, b.spec.act).id : undefined,
        });
      }
      segments++;
      if (offset === 0) lastEndToday = b.end;
    }
  }

  // One running timer on "Review onboarding flow", started about 25 minutes ago
  // (but never before the last tracked block ended).
  await store.startSegment({ taskId: reviewFlow.id });
  const wanted = new Date(now.getTime() - 25 * 60_000);
  const startedAt = lastEndToday && lastEndToday > wanted ? lastEndToday : wanted;
  await db.query(`update segments set started_at = $1 where ended_at is null`, [startedAt.toISOString()]);

  const everything = await store.allTasks();
  const open = everything.filter((t) => t.status === "open");
  console.log("Seeded demo data:");
  console.log(`  projects:   4`);
  console.log(`  tasks:      ${everything.length} (${open.length} open, ${everything.filter((t) => t.status === "done").length} done)`);
  console.log(`  today:      ${open.filter((t) => t.scheduled === ymd(0)).length} open, ${doneToday.length} done`);
  console.log(`  next 7 days: ${open.filter((t) => t.scheduled && t.scheduled > ymd(0) && t.scheduled <= ymd(7)).length}`);
  console.log(`  overdue:    ${open.filter((t) => t.scheduled && t.scheduled < ymd(0)).length}`);
  console.log(`  inbox:      ${open.filter((t) => !t.scheduled).length}`);
  console.log(`  segments:   ${segments} + 1 running timer`);
}

const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === entry) {
  main().then(
    () => process.exit(0),
    (error) => {
      console.error(error);
      process.exit(1);
    },
  );
}
