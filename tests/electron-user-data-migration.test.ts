import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
const { migrateLegacyUserData, legacyAppRunning, LEGACY_NAMES } = require("../electron/user-data-migration.js");

// One "Application Support" per test, holding whichever app folders the case needs.
function support(t: test.TestContext) {
  const root = mkdtempSync(path.join(tmpdir(), "doem-migrate-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const make = (name: string, tag: string, entries = ["pglite", "settings.json", "Local Storage", "app.log"]) => {
    const dir = path.join(root, name);
    mkdirSync(dir, { recursive: true });
    for (const e of entries) {
      if (e === "pglite" || e === "Local Storage") {
        mkdirSync(path.join(dir, e));
        writeFileSync(path.join(dir, e, "PG_VERSION"), tag);
      } else writeFileSync(path.join(dir, e), tag);
    }
  };
  const read = (...p: string[]) => readFileSync(path.join(root, ...p), "utf8");
  const has = (...p: string[]) => existsSync(path.join(root, ...p));
  return { root, doem: path.join(root, "Doem"), make, read, has };
}

test("earlier names are tried newest first", () => {
  assert.deepEqual(LEGACY_NAMES, ["Tempo", "DayPlan"]);
});

test("fresh install: nothing to move, nothing created", (t) => {
  const s = support(t);
  assert.deepEqual(migrateLegacyUserData(s.doem), []);
  assert.equal(s.has("Doem"), false);
});

test("Tempo only: the whole folder becomes Doem", (t) => {
  const s = support(t);
  s.make("Tempo", "tempo");
  migrateLegacyUserData(s.doem);
  assert.equal(s.has("Tempo"), false);
  assert.equal(s.read("Doem", "pglite", "PG_VERSION"), "tempo");
  assert.equal(s.read("Doem", "settings.json"), "tempo");
  assert.equal(s.read("Doem", "app.log"), "tempo");
});

test("DayPlan only: the whole folder becomes Doem", (t) => {
  const s = support(t);
  s.make("DayPlan", "dayplan");
  migrateLegacyUserData(s.doem);
  assert.equal(s.has("DayPlan"), false);
  assert.equal(s.read("Doem", "pglite", "PG_VERSION"), "dayplan");
});

test("Tempo and DayPlan both present: Tempo wins, DayPlan is left untouched", (t) => {
  const s = support(t);
  s.make("Tempo", "tempo");
  s.make("DayPlan", "dayplan");
  migrateLegacyUserData(s.doem);
  assert.equal(s.read("Doem", "pglite", "PG_VERSION"), "tempo");
  assert.equal(s.read("Doem", "settings.json"), "tempo");
  assert.equal(s.read("DayPlan", "pglite", "PG_VERSION"), "dayplan");
  assert.equal(s.read("DayPlan", "settings.json"), "dayplan");
});

test("Doem already created (empty, as Chromium leaves it): database, settings and localStorage move, nothing else", (t) => {
  const s = support(t);
  s.make("Tempo", "tempo");
  s.make("Doem", "doem", []);
  migrateLegacyUserData(s.doem);
  assert.equal(s.read("Doem", "pglite", "PG_VERSION"), "tempo");
  assert.equal(s.read("Doem", "settings.json"), "tempo");
  assert.equal(s.read("Doem", "Local Storage", "PG_VERSION"), "tempo");
  assert.equal(s.has("Doem", "app.log"), false);
  assert.equal(s.read("Tempo", "app.log"), "tempo");
});

test("Doem already has data: nothing is overwritten", (t) => {
  const s = support(t);
  s.make("Tempo", "tempo");
  s.make("DayPlan", "dayplan");
  s.make("Doem", "doem");
  assert.deepEqual(migrateLegacyUserData(s.doem), []);
  assert.equal(s.read("Doem", "pglite", "PG_VERSION"), "doem");
  assert.equal(s.read("Doem", "settings.json"), "doem");
  assert.equal(s.read("Doem", "Local Storage", "PG_VERSION"), "doem");
  assert.equal(s.read("Tempo", "pglite", "PG_VERSION"), "tempo");
  assert.equal(s.read("Tempo", "Local Storage", "PG_VERSION"), "tempo");
  assert.equal(s.read("DayPlan", "pglite", "PG_VERSION"), "dayplan");
});

test("Doem has a database but no settings: only settings.json moves", (t) => {
  const s = support(t);
  s.make("Tempo", "tempo");
  s.make("Doem", "doem", ["pglite"]);
  migrateLegacyUserData(s.doem);
  assert.equal(s.read("Doem", "pglite", "PG_VERSION"), "doem");
  assert.equal(s.read("Doem", "settings.json"), "tempo");
  assert.equal(s.read("Tempo", "pglite", "PG_VERSION"), "tempo");
});

// A running old app: its SingletonLock points at this host and a live PID
// whose command is the old app's binary.
const HOST = "Test-Mac.local";
const lock = (s: ReturnType<typeof support>, name: string, target: string) =>
  symlinkSync(target, path.join(s.root, name, "SingletonLock"));
const running = (names: Record<number, string>) => ({
  hostname: HOST,
  processName: (pid: number) => names[pid] ?? null,
});

test("a running Tempo blocks the move and is reported", (t) => {
  const s = support(t);
  s.make("Tempo", "tempo");
  s.make("Doem", "doem", []);
  lock(s, "Tempo", `${HOST}-4242`);
  const deps = running({ 4242: "/Applications/Tempo.app/Contents/MacOS/Tempo" });
  assert.equal(legacyAppRunning(s.doem, LEGACY_NAMES, deps), "Tempo");
  assert.deepEqual(migrateLegacyUserData(s.doem, LEGACY_NAMES, deps), []);
  assert.equal(s.read("Tempo", "pglite", "PG_VERSION"), "tempo");
  assert.equal(s.has("Doem", "pglite"), false);
});

test("a stale lock (dead PID) does not block the move", (t) => {
  const s = support(t);
  s.make("Tempo", "tempo");
  s.make("Doem", "doem", []);
  lock(s, "Tempo", `${HOST}-4242`);
  const deps = running({});
  assert.equal(legacyAppRunning(s.doem, LEGACY_NAMES, deps), null);
  migrateLegacyUserData(s.doem, LEGACY_NAMES, deps);
  assert.equal(s.read("Doem", "pglite", "PG_VERSION"), "tempo");
});

test("a reused PID that belongs to another program does not block the move", (t) => {
  const s = support(t);
  s.make("Tempo", "tempo");
  s.make("Doem", "doem", []);
  lock(s, "Tempo", `${HOST}-4242`);
  const deps = running({ 4242: "/usr/bin/vim" });
  assert.equal(legacyAppRunning(s.doem, LEGACY_NAMES, deps), null);
  migrateLegacyUserData(s.doem, LEGACY_NAMES, deps);
  assert.equal(s.read("Doem", "pglite", "PG_VERSION"), "tempo");
});

test("a lock from another machine does not block the move", (t) => {
  const s = support(t);
  s.make("Tempo", "tempo");
  s.make("Doem", "doem", []);
  lock(s, "Tempo", "Other-Mac.local-4242");
  const deps = running({ 4242: "/Applications/Tempo.app/Contents/MacOS/Tempo" });
  assert.equal(legacyAppRunning(s.doem, LEGACY_NAMES, deps), null);
});
