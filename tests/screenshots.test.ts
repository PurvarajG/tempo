import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// scripts/screenshots.mjs launches Electron on import, so pull slugOf out of its source.
const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "screenshots.mjs"), "utf8");
const m = src.match(/\/\/ slugOf:start\n([\s\S]*?)\/\/ slugOf:end/);
assert.ok(m, "slugOf markers present");
const slugOf = new Function(`${m[1]}; return slugOf;`)() as (r: string) => string;

test("existing slugs are unchanged", () => {
  const cases: Record<string, string> = {
    "/": "today",
    "/inbox": "inbox",
    "/all": "all",
    "/upcoming": "upcoming",
    "/calendar": "calendar",
    "/calendar?view=month": "calendar-month",
    "/calendar?view=day": "calendar-day",
    "/completed": "completed",
    "/search": "search",
    "/trash": "trash",
    "/settings": "settings",
    "/tracking": "tracking",
    "/tracking/settings": "tracking-settings",
    "/wrap": "wrap",
    "/wrap?reset=1": "wrap-reset",
    "/projects/abc123": "project",
  };
  for (const [route, slug] of Object.entries(cases)) assert.equal(slugOf(route), slug, route);
});

test("new slugs", () => {
  assert.equal(slugOf("/?view=board"), "today-board");
  assert.equal(slugOf("/upcoming?view=board"), "upcoming-board");
  assert.equal(slugOf("/capture"), "capture");
  assert.equal(slugOf("/settings#desktop"), "settings-desktop");
});

test("no leftover rebuild paths or removed modes", () => {
  assert.ok(!src.includes("rebuild/"), "no rebuild/ path");
  assert.ok(!src.includes("v2-style-check"), "no style-check import");
  assert.ok(!src.includes("--reference") && !src.includes("--compare"), "old modes removed");
});

test("captures 1440x900 at device scale factor 2", () => {
  assert.match(src, /const W = 1440, H = 900, SCALE = 2;/);
});
