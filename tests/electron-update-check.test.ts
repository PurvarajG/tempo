import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { compareVersions, parseVersion, createUpdateChecker, DAY_MS } = require("../electron/update-check.js");

test("compareVersions", () => {
  assert.equal(compareVersions("1.0.0", "1.0.0"), 0);
  assert.equal(compareVersions("1.0.1", "1.0.0"), 1);
  assert.equal(compareVersions("1.0.0", "1.0.1"), -1);
  assert.equal(compareVersions("1.10.0", "1.9.0"), 1);
  assert.equal(compareVersions("v1.2.0", "1.1.9"), 1);
  assert.equal(compareVersions("v1.0.0", "1.0.0"), 0);
});

test("pre-releases and junk are ignored", () => {
  assert.equal(parseVersion("1.1.0-beta.1"), null);
  assert.equal(compareVersions("2.0.0-rc.1", "1.0.0"), null);
  assert.equal(parseVersion("latest"), null);
  assert.equal(parseVersion(undefined), null);
});

function setup(opts: { settings?: Record<string, unknown>; body?: unknown; fail?: boolean; status?: number; now?: number } = {}) {
  const settings: Record<string, unknown> = { ...(opts.settings ?? {}) };
  const calls = { fetch: 0, notify: [] as string[], menu: [] as string[], log: [] as string[] };
  const checker = createUpdateChecker({
    currentVersion: "1.0.0",
    now: () => opts.now ?? 1_000_000_000_000,
    readSettings: () => ({ ...settings }),
    writeSettings: (p: Record<string, unknown>) => Object.assign(settings, p),
    log: (t: string) => calls.log.push(t),
    notify: (v: string) => calls.notify.push(v),
    setMenuUpdate: (v: string) => calls.menu.push(v),
    fetch: async () => {
      calls.fetch += 1;
      if (opts.fail) throw new Error("offline");
      return {
        ok: (opts.status ?? 200) === 200,
        status: opts.status ?? 200,
        json: async () => opts.body,
      };
    },
  });
  return { checker, settings, calls };
}

const release = (tag: string) => ({ tag_name: tag, html_url: "https://github.com/PurvarajG/doem/releases/tag/" + tag });

test("newer release notifies once and adds a menu item", async () => {
  const { checker, settings, calls } = setup({ body: release("v1.0.1") });
  assert.equal(await checker.check(), "available");
  assert.deepEqual(calls.notify, ["1.0.1"]);
  assert.deepEqual(calls.menu, ["1.0.1"]);
  assert.equal(settings.updateNotifiedVersion, "1.0.1");
});

test("same version does nothing", async () => {
  const { checker, calls } = setup({ body: release("v1.0.0") });
  assert.equal(await checker.check(), "none");
  assert.equal(calls.notify.length, 0);
  assert.equal(calls.menu.length, 0);
});

test("at most one fetch per day", async () => {
  const now = 1_000_000_000_000;
  const { checker, calls } = setup({ settings: { updateLastCheck: now - 1000 }, body: release("v1.0.1"), now });
  assert.equal(await checker.check(), "skipped");
  assert.equal(calls.fetch, 0);
  const later = setup({ settings: { updateLastCheck: now - DAY_MS - 1 }, body: release("v1.0.1"), now });
  assert.equal(await later.checker.check(), "available");
  assert.equal(later.calls.fetch, 1);
});

test("a known update keeps its menu item without refetching", async () => {
  const now = 1_000_000_000_000;
  const { checker, calls } = setup({
    now,
    settings: { updateLastCheck: now - 1000, updateAvailable: { version: "1.0.1", url: "https://github.com/x" } },
  });
  await checker.check();
  assert.deepEqual(calls.menu, ["1.0.1"]);
  assert.equal(calls.fetch, 0);
});

test("notifies once per version, again for a newer one", async () => {
  const a = setup({ settings: { updateNotifiedVersion: "1.0.1" }, body: release("v1.0.1") });
  await a.checker.check();
  assert.equal(a.calls.notify.length, 0);
  assert.deepEqual(a.calls.menu, ["1.0.1"]);
  const b = setup({ settings: { updateNotifiedVersion: "1.0.1" }, body: release("v1.0.2") });
  await b.checker.check();
  assert.deepEqual(b.calls.notify, ["1.0.2"]);
});

test("pre-release and draft releases are ignored", async () => {
  const p = setup({ body: { ...release("v1.1.0"), prerelease: true } });
  assert.equal(await p.checker.check(), "none");
  const t = setup({ body: release("v1.1.0-beta.1") });
  assert.equal(await t.checker.check(), "none");
  assert.equal(p.calls.notify.length + t.calls.notify.length, 0);
});

test("network error, 404 and bad JSON are silent apart from a log line", async () => {
  const offline = setup({ fail: true });
  assert.equal(await offline.checker.check(), "failed");
  const missing = setup({ status: 404 });
  assert.equal(await missing.checker.check(), "failed");
  const bad = setup({ body: "nonsense" });
  await bad.checker.check();
  for (const s of [offline, missing, bad]) {
    assert.equal(s.calls.notify.length, 0);
    assert.equal(s.calls.menu.length, 0);
  }
  assert.equal(offline.calls.log.length, 1);
  assert.equal(missing.calls.log.length, 1);
});
