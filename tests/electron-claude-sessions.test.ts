import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import test, { mock } from "node:test";

const require = createRequire(import.meta.url);
const mod = require("../electron/claude-sessions.js");
const { scanClaudeSessions, createWaitTracker, waitingNotification, PROJECTS_SUBPATH } = mod;

type Line = Record<string, unknown>;
const NOW = new Date("2026-11-13T12:00:00.000Z");
const SINCE = new Date("2026-11-13T00:00:00.000Z");
const iso = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 13, h, m)).toISOString();

function user(ts: string, content: unknown, extra: Line = {}): Line {
  return { type: "user", timestamp: ts, cwd: "/work/alpha", gitBranch: "main", message: { role: "user", content }, ...extra };
}
function asst(ts: string, stop: string | null, extra: Line = {}): Line {
  return { type: "assistant", timestamp: ts, cwd: "/work/alpha", gitBranch: "main", message: { role: "assistant", stop_reason: stop, content: [{ type: "text", text: "ok" }] }, ...extra };
}

function fixture(files: Record<string, Line[] | string>, mtimes: Record<string, Date> = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "claude-sessions-"));
  for (const [rel, lines] of Object.entries(files)) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof lines === "string" ? lines : lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
    fs.utimesSync(file, mtimes[rel] ?? NOW, mtimes[rel] ?? NOW);
  }
  return root;
}
const scan = (root: string, over = {}) => scanClaudeSessions({ root, since: SINCE, now: NOW, ...over });

test("PROJECTS_SUBPATH", () => {
  assert.deepEqual(PROJECTS_SUBPATH, [".claude", "projects"]);
});

test("two project folders give the right fields", async () => {
  const root = fixture({
    "-work-alpha/s1.jsonl": [
      user(iso(9), "Fix the login bug"),
      asst(iso(9, 5), "tool_use"),
      user(iso(10), "Now add tests"),
      asst(iso(10, 30), "end_turn"),
    ],
    "-work-beta/s2.jsonl": [
      user(iso(11, 50), "Write docs", { cwd: "/work/beta", gitBranch: "docs" }),
      asst(iso(11, 55), "tool_use", { cwd: "/work/beta", gitBranch: "docs" }),
    ],
  });
  const out = await scan(root);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], {
    id: "s2", projectPath: "/work/beta", projectName: "beta", branch: "docs", lastPrompt: "Write docs",
    firstMessageAt: iso(11, 50), lastMessageAt: iso(11, 55), waiting: false, active: true,
  });
  assert.deepEqual(out[1], {
    id: "s1", projectPath: "/work/alpha", projectName: "alpha", branch: "main", lastPrompt: "Now add tests",
    firstMessageAt: iso(9), lastMessageAt: iso(10, 30), waiting: true, active: false,
  });
});

test("prompt is cut to 80 characters with whitespace collapsed", async () => {
  const long = "word   ".repeat(30) + "\n\tend";
  const root = fixture({ "p/s.jsonl": [user(iso(9), long), asst(iso(9, 1), "end_turn")] });
  const [s] = await scan(root);
  assert.equal(s.lastPrompt.length, 80);
  assert.equal(s.lastPrompt, ("word ".repeat(30)).slice(0, 80));
  assert.ok(!/\s{2}/.test(s.lastPrompt));
});

test("tool_result-only and command-name user lines are skipped for lastPrompt", async () => {
  const root = fixture({
    "p/s.jsonl": [
      user(iso(9), "Real prompt"),
      user(iso(9, 1), [{ type: "tool_result", tool_use_id: "x", content: "output" }]),
      user(iso(9, 2), "<command-name>/clear</command-name>"),
      user(iso(9, 3), "<local-command-stdout>hi</local-command-stdout>"),
      user(iso(9, 4), [{ type: "text", text: "<system-reminder>x</system-reminder>" }]),
      asst(iso(9, 5), "end_turn"),
    ],
  });
  const [s] = await scan(root);
  assert.equal(s.lastPrompt, "Real prompt");
});

test("array text prompt is read; no prompt gives empty string", async () => {
  const root = fixture({
    "a/one.jsonl": [user(iso(9), [{ type: "text", text: "From array" }])],
    "b/two.jsonl": [asst(iso(8), "end_turn")],
  });
  const out = await scan(root);
  assert.equal(out.find((s: { id: string }) => s.id === "one").lastPrompt, "From array");
  assert.equal(out.find((s: { id: string }) => s.id === "two").lastPrompt, "");
});

test("files older than since are skipped", async () => {
  const old = new Date("2026-11-10T00:00:00.000Z");
  const root = fixture(
    {
      "p/old.jsonl": [user("2026-11-10T00:00:00.000Z", "old"), asst("2026-11-10T00:01:00.000Z", "end_turn")],
      "p/new.jsonl": [user(iso(9), "new")],
      "p/oldlines.jsonl": [user("2026-11-10T00:00:00.000Z", "old line")],
    },
    { "p/old.jsonl": old },
  );
  const out = await scan(root);
  assert.deepEqual(out.map((s: { id: string }) => s.id).sort(), ["new"]);
});

test("firstMessageAt counts only lines at or after since", async () => {
  const root = fixture({ "p/s.jsonl": [user("2026-11-12T23:00:00.000Z", "yesterday"), asst(iso(1), "end_turn")] });
  const [s] = await scan(root);
  assert.equal(s.firstMessageAt, iso(1));
});

test("sidechain, meta and unparsable lines are ignored; non-jsonl and symlinks skipped", async () => {
  const root = fixture({
    "p/s.jsonl":
      [
        JSON.stringify(user(iso(9), "Main")),
        "not json {",
        JSON.stringify(asst(iso(10), "end_turn", { isSidechain: true })),
        JSON.stringify(user(iso(10, 5), "meta", { isMeta: true })),
        JSON.stringify({ type: "summary", timestamp: iso(11) }),
        JSON.stringify(asst(iso(9, 1), "tool_use")),
      ].join("\n") + "\n",
    "p/notes.txt": "x",
  });
  const outside = fixture({ "q/ghost.jsonl": [user(iso(9), "ghost")] });
  fs.symlinkSync(path.join(outside, "q"), path.join(root, "linked"));
  const out = await scan(root);
  assert.equal(out.length, 1);
  assert.equal(out[0].lastMessageAt, iso(9, 1));
  assert.equal(out[0].waiting, false);
  assert.equal(out[0].lastPrompt, "Main");
});

test("waiting only when the last message is an assistant end_turn", async () => {
  const root = fixture({
    "p/a.jsonl": [user(iso(9), "q"), asst(iso(9, 1), "end_turn")],
    "p/b.jsonl": [user(iso(9), "q"), asst(iso(9, 1), "tool_use")],
    "p/c.jsonl": [asst(iso(9, 1), "end_turn"), user(iso(9, 2), "again")],
  });
  const out = await scan(root);
  const by = (id: string) => out.find((s: { id: string }) => s.id === id).waiting;
  assert.equal(by("a"), true);
  assert.equal(by("b"), false);
  assert.equal(by("c"), false);
});

test("projectPath falls back to folder name; branch null; sessionId wins; maxFiles", async () => {
  const bare = (ts: string): Line => ({ type: "user", timestamp: ts, message: { content: "hi" } });
  const root = fixture(
    {
      "-work-gamma/g.jsonl": [bare(iso(9))],
      "-work-gamma/h.jsonl": [{ ...bare(iso(8)), sessionId: "sess-h" }],
    },
    { "-work-gamma/h.jsonl": new Date(NOW.getTime() - 1000) },
  );
  const out = await scan(root);
  assert.equal(out[0].projectPath, "-work-gamma");
  assert.equal(out[0].branch, null);
  assert.ok(out.some((s: { id: string }) => s.id === "sess-h"));
  assert.equal((await scan(root, { maxFiles: 1 })).length, 1);
});

test("missing root returns [] and is not created", async () => {
  const root = path.join(os.tmpdir(), "claude-sessions-missing-" + process.pid);
  assert.deepEqual(await scan(root), []);
  assert.equal(fs.existsSync(root), false);
});

test("source has no write API and every open uses flags r", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "electron", "claude-sessions.js"), "utf8");
  const banned = [
    "writeFile", "appendFile", "mkdir", "rmSync", "rm(", "unlink", "rename", "copyFile",
    "createWriteStream", "truncate", "chmod", "utimes",
    '"w"', '"a"', '"r+"', '"w+"', '"a+"',
  ];
  for (const b of banned) assert.ok(!src.includes(b), `source contains ${b}`);
  const opens = src.match(/(createReadStream|\.open)\s*\([^)]*\)/g) ?? [];
  assert.ok(opens.length > 0);
  for (const o of opens) assert.ok(/flags:\s*"r"/.test(o), `open without flags r: ${o}`);
});

test("a scan calls no write API and leaves mtimes alone", async () => {
  const root = fixture({ "p/s.jsonl": [user(iso(9), "hi"), asst(iso(9, 1), "end_turn")] });
  const file = path.join(root, "p", "s.jsonl");
  const before = fs.statSync(file).mtimeMs;
  const calls: string[] = [];
  const names = ["writeFile", "appendFile", "mkdir", "rm", "unlink", "rename", "createWriteStream"];
  const mocks: { mock: { restore(): void } }[] = [];
  for (const n of names) {
    for (const target of [fs, fs.promises] as unknown as Record<string, (...a: unknown[]) => unknown>[]) {
      if (typeof target[n] === "function") {
        mocks.push(mock.method(target, n, () => { calls.push(n); throw new Error("write API called"); }) as never);
      }
    }
  }
  const openFlags: unknown[] = [];
  const realOpen = fs.open;
  mock.method(fs, "open", ((...args: unknown[]) => { openFlags.push(args[1]); return (realOpen as (...a: unknown[]) => unknown)(...args); }) as never);
  try {
    const out = await scan(root);
    assert.equal(out.length, 1);
  } finally {
    mock.restoreAll();
  }
  assert.deepEqual(calls, []);
  for (const f of openFlags) assert.equal(f, "r");
  assert.equal(fs.statSync(file).mtimeMs, before);
});

test("createWaitTracker notifies once per wait and again after a new lastMessageAt", () => {
  const t = createWaitTracker();
  const s = { id: "s", waiting: true, lastMessageAt: iso(11, 55) };
  assert.equal(t.update([s], NOW).length, 1);
  assert.equal(t.update([s], NOW).length, 0);
  const s2 = { ...s, lastMessageAt: iso(11, 58) };
  assert.equal(t.update([s2], NOW).length, 1);
  assert.equal(t.update([{ ...s2, waiting: false, lastMessageAt: iso(11, 59) }], NOW).length, 0);
});

test("createWaitTracker ignores stale waits and honours freshMinutes", () => {
  const t = createWaitTracker();
  assert.equal(t.update([{ id: "a", waiting: true, lastMessageAt: iso(11, 40) }], NOW).length, 0);
  const t2 = createWaitTracker({ freshMinutes: 30 });
  assert.equal(t2.update([{ id: "a", waiting: true, lastMessageAt: iso(11, 40) }], NOW).length, 1);
});

test("createWaitTracker caps remembered keys", () => {
  const t = createWaitTracker();
  const mk = (i: number) => ({ id: `s${i}`, waiting: true, lastMessageAt: iso(11, 55) });
  for (let i = 0; i < 600; i++) t.update([mk(i)], NOW);
  assert.equal(t.update([mk(0)], NOW).length, 1); // dropped, notifies again
  assert.equal(t.update([mk(599)], NOW).length, 0); // still remembered
});

test("waitingNotification copy", () => {
  const base = { projectName: "alpha", branch: "main", lastPrompt: "Fix it" };
  assert.deepEqual(waitingNotification(base), { title: "Claude is waiting in alpha", body: "main. Fix it" });
  assert.deepEqual(waitingNotification({ ...base, branch: null }), { title: "Claude is waiting in alpha", body: "Fix it" });
  assert.equal(waitingNotification({ ...base, lastPrompt: "x".repeat(300) }).body.length, 200);
  const n = waitingNotification(base);
  assert.ok(!/[–—·]/.test(n.title + n.body));
});
