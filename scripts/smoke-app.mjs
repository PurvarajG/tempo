#!/usr/bin/env node
// App lifecycle smoke test for a packaged Doem.app.
//
//   node scripts/smoke-app.mjs <path-to-Doem.app> [--cycles N] [--only 1,3,6] [--keep-scratch]
//   npm run smoke:app -- <path-to-Doem.app>
//
// Safety rules this script encodes (the owner's real Doem may be running):
//  - The .app is copied to a scratch folder outside the repo and launched by
//    executing Contents/MacOS/Doem directly, never through `open`, osascript
//    or LaunchServices (those resolve by bundle id and would hit the owner's app).
//  - Every launch passes --user-data-dir=<scratch>/..., so userData, the
//    single-instance lock, the database and the log all live in the scratch
//    folder. Before anything is launched a tiny probe app proves that this
//    Electron version really moves app.getPath("userData"); if it does not,
//    the script stops.
//  - Only processes whose command line contains the unique scratch path are ever
//    signalled. Nothing is killed by name. The owner's Doem processes are
//    snapshotted up front and must all still be alive at the end.
//  - The port is read from the instance's own doem.log, never assumed.
//
// Case 6 seeds a Tempo database with scripts/demo-data.ts (PGLITE_DIR=<dir>).

import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOST = "127.0.0.1";

// ---------------------------------------------------------------- args
const argv = process.argv.slice(2);
function flag(name) {
  const i = argv.indexOf(name);
  if (i < 0) return null;
  const v = argv[i + 1];
  argv.splice(i, v && !v.startsWith("--") ? 2 : 1);
  return v && !v.startsWith("--") ? v : true;
}
const cyclesArg = flag("--cycles");
const onlyArg = flag("--only");
const keepScratch = argv.includes("--keep-scratch");
if (keepScratch) argv.splice(argv.indexOf("--keep-scratch"), 1);
const CYCLES = cyclesArg ? Number(cyclesArg) : 20;
const ONLY = onlyArg && onlyArg !== true ? new Set(String(onlyArg).split(",").map((s) => s.trim())) : null;
const appArg = argv.find((a) => !a.startsWith("--"));

if (!appArg || argv.includes("--help") || !Number.isInteger(CYCLES) || CYCLES < 1) {
  console.error("usage: node scripts/smoke-app.mjs <path-to-Doem.app> [--cycles N] [--only 1,2,3,4,5,6] [--keep-scratch]");
  process.exit(2);
}
if (process.platform !== "darwin") {
  console.error("smoke-app only runs on macOS.");
  process.exit(2);
}
const SOURCE_APP = path.resolve(appArg);
if (!fs.existsSync(path.join(SOURCE_APP, "Contents", "MacOS", "Doem"))) {
  console.error(`Not a Doem.app (no Contents/MacOS/Doem): ${SOURCE_APP}`);
  process.exit(2);
}

// ---------------------------------------------------------------- scratch + cleanup
const ROOT = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "doem-smoke-")));
const APP = path.join(ROOT, "app", "Doem.app");
const EXE = path.join(APP, "Contents", "MacOS", "Doem");
let cleaned = false;

function psTable() {
  const out = execFileSync("ps", ["-axww", "-o", "pid=,ppid=,command="], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  const rows = [];
  for (const line of out.split("\n")) {
    const m = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line);
    if (m) rows.push({ pid: Number(m[1]), ppid: Number(m[2]), command: m[3] });
  }
  return rows;
}
function descendants(rootPid, rows = psTable()) {
  const kids = new Map();
  for (const r of rows) (kids.get(r.ppid) ?? kids.set(r.ppid, []).get(r.ppid)).push(r);
  const out = [];
  const queue = [rootPid];
  while (queue.length) {
    for (const k of kids.get(queue.shift()) ?? []) {
      out.push(k);
      queue.push(k.pid);
    }
  }
  return out;
}
function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
}
// The only place a signal is sent: refuses any process that is not ours.
function signalScratch(pid, sig) {
  if (pid === process.pid) return false;
  const row = psTable().find((r) => r.pid === pid);
  if (!row || !row.command.includes(ROOT)) return false;
  try {
    process.kill(pid, sig);
    return true;
  } catch {
    return false;
  }
}
function sweepScratchProcesses() {
  let killed = 0;
  for (const r of psTable()) {
    if (r.pid !== process.pid && r.command.includes(ROOT)) {
      try {
        process.kill(r.pid, "SIGKILL");
        killed++;
      } catch {}
    }
  }
  return killed;
}
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  try {
    sweepScratchProcesses();
  } catch {}
  if (!keepScratch) {
    try {
      fs.rmSync(ROOT, { recursive: true, force: true });
    } catch {}
  } else {
    console.log(`scratch kept: ${ROOT}`);
  }
}
process.on("exit", cleanup);
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => {
    cleanup();
    process.exit(130);
  });
}

// ---------------------------------------------------------------- small helpers
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, timeoutMs, intervalMs = 150) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) return null;
    await sleep(intervalMs);
  }
}
function assert(cond, message) {
  if (!cond) throw new Error(message);
}
async function api(port, method, route, body) {
  const res = await fetch(`http://${HOST}:${port}${route}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}
function readLogFrom(dataDir, offset = 0) {
  try {
    return fs.readFileSync(path.join(dataDir, "doem.log")).subarray(offset).toString("utf8");
  } catch {
    return "";
  }
}
function logSize(dataDir) {
  try {
    return fs.statSync(path.join(dataDir, "doem.log")).size;
  } catch {
    return 0;
  }
}
const ERROR_RE = /\b(error|exception|unhandled|fatal|EADDRINUSE|ECONNREFUSED|ELIFECYCLE|could not)\b|exited with code/i;
function errorLines(text) {
  return text.split("\n").filter((l) => ERROR_RE.test(l));
}

// The owner's running Doem: every Doem main/server process outside our scratch.
function ownerPids() {
  return psTable()
    .filter((r) => r.command.includes("/Doem.app/Contents/MacOS/Doem") && !r.command.includes(ROOT))
    .map((r) => r.pid);
}
const ownerBefore = ownerPids();
function assertOwnerAlive(where) {
  const dead = ownerBefore.filter((p) => !isAlive(p));
  assert(dead.length === 0, `${where}: the owner's Doem process(es) ${dead.join(", ")} are gone`);
}

// ---------------------------------------------------------------- instances
const allInstances = [];
function launch(label, dataDir, extraArgs = []) {
  fs.mkdirSync(path.dirname(dataDir), { recursive: true });
  const env = { ...process.env, DOEM_NO_UPDATE_CHECK: "1" };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.PGLITE_DIR;
  const proc = spawn(EXE, [`--user-data-dir=${dataDir}`, ...extraArgs], { env, stdio: ["ignore", "ignore", "pipe"] });
  const inst = { label, proc, pid: proc.pid, dataDir, logOffset: logSize(dataDir), stderr: "", exited: false, exitCode: null, signal: null, port: null };
  proc.stderr.on("data", (c) => (inst.stderr = (inst.stderr + c.toString()).slice(-4000)));
  inst.exitPromise = new Promise((resolve) => {
    proc.on("exit", (code, signal) => {
      inst.exited = true;
      inst.exitCode = code;
      inst.signal = signal;
      resolve();
    });
  });
  allInstances.push(inst);
  return inst;
}
function diag(inst) {
  const tail = readLogFrom(inst.dataDir, inst.logOffset).trim().split("\n").slice(-6).join(" | ");
  return `exit=${inst.exitCode ?? inst.signal ?? "running"} stderr="${inst.stderr.trim().slice(-300)}" log="${tail.slice(-500)}"`;
}
async function waitReady(inst, timeoutMs = 90000) {
  const port = await waitFor(() => {
    if (inst.exited) throw new Error(`${inst.label} exited before it was ready (${diag(inst)}). If the log folder is empty, the --user-data-dir isolation did not apply.`);
    const m = [...readLogFrom(inst.dataDir, inst.logOffset).matchAll(/starting server on port (\d+)/g)].pop();
    return m ? Number(m[1]) : null;
  }, timeoutMs);
  assert(port, `${inst.label}: no "starting server on port" line in ${path.join(inst.dataDir, "doem.log")} within ${timeoutMs / 1000}s (${diag(inst)})`);
  inst.port = port;
  const ok = await waitFor(async () => {
    if (inst.exited) throw new Error(`${inst.label} exited while starting (${diag(inst)})`);
    try {
      const res = await fetch(`http://${HOST}:${port}/`, { signal: AbortSignal.timeout(3000) });
      await res.arrayBuffer();
      return res.status === 200;
    } catch {
      return false;
    }
  }, timeoutMs, 300);
  assert(ok, `${inst.label}: server on port ${port} did not answer 200 in time (${diag(inst)})`);
  const tree = descendants(inst.pid);
  assert(
    tree.some((r) => r.command.includes(` -p ${port}`)),
    `${inst.label}: logged port ${port} but no child process of pid ${inst.pid} runs "-p ${port}"`,
  );
  return port;
}
function instanceTree(inst) {
  return descendants(inst.pid);
}
async function gracefulQuit(inst) {
  const tree = instanceTree(inst);
  process.kill(inst.pid, "SIGTERM");
  const gone = await waitFor(() => inst.exited, 20000);
  if (!gone) {
    signalScratch(inst.pid, "SIGKILL");
    throw new Error(`${inst.label}: main process ignored SIGTERM for 20s`);
  }
  const survivors = await waitFor(async () => (tree.every((r) => !isAlive(r.pid)) ? [] : null), 8000);
  if (!survivors) {
    const left = tree.filter((r) => isAlive(r.pid));
    for (const r of left) signalScratch(r.pid, "SIGKILL");
    throw new Error(
      `${inst.label}: main exited on SIGTERM but ${left.length} child process(es) survived (${left.map((r) => `${r.pid}:${r.command.split("/").pop().slice(0, 40)}`).join(", ")}). ` +
        `SIGTERM is not Cmd+Q: if the app has no SIGTERM handler the Next server is orphaned and keeps the database open.`,
    );
  }
}
// kill -9 the whole app the way a crash would: main first (as Force Quit does),
// then report whether the server child survived, then clear the rest so the
// next launch starts from a known state.
async function crashKill(inst, warnings, note) {
  const tree = instanceTree(inst);
  process.kill(inst.pid, "SIGKILL");
  await waitFor(() => inst.exited, 10000);
  await sleep(2500);
  const orphans = tree.filter((r) => isAlive(r.pid) && r.command.includes(" -p "));
  if (orphans.length) {
    warnings.push(`${note}: kill -9 of the main process left the Next server running (pid ${orphans.map((r) => r.pid).join(", ")}); it keeps the database open, so a relaunch would run a second server on the same data folder`);
  }
  for (const r of tree) signalScratch(r.pid, "SIGKILL");
  await waitFor(() => tree.every((r) => !isAlive(r.pid)), 8000);
}
async function stopInstance(inst) {
  if (inst.exited && !instanceTree(inst).length) return;
  for (const r of instanceTree(inst)) signalScratch(r.pid, "SIGKILL");
  if (!inst.exited) signalScratch(inst.pid, "SIGKILL");
  await waitFor(() => inst.exited, 5000);
}

// ---------------------------------------------------------------- case runner
const results = [];
const warnings = [];
async function runCase(id, name, fn) {
  if (ONLY && !ONLY.has(String(id))) return;
  const started = Date.now();
  const before = allInstances.length;
  let ok = true;
  let detail = "";
  try {
    detail = (await fn()) ?? "";
    assertOwnerAlive(`case ${id}`);
  } catch (e) {
    ok = false;
    detail = e.message;
  } finally {
    for (const inst of allInstances.slice(before)) await stopInstance(inst).catch(() => {});
  }
  const ms = Date.now() - started;
  results.push({ id, name, ok, skipped: false, ms, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}. ${name}  (${(ms / 1000).toFixed(1)}s)${detail ? `  ${detail}` : ""}`);
}
function skipCase(id, name, why) {
  results.push({ id, name, ok: true, skipped: true, ms: 0, detail: why });
  console.log(`SKIP  ${id}. ${name}  ${why}`);
}

const PAGES = ["/", "/inbox", "/upcoming", "/calendar", "/tracking", "/settings"];
const dataRoot = (n) => path.join(ROOT, "data", n);

// ---------------------------------------------------------------- preflight
async function preflight() {
  // 1. Prove --user-data-dir moves userData in this Electron, with a probe app.
  let electronBin;
  try {
    electronBin = createRequire(path.join(REPO, "package.json"))("electron");
  } catch {
    throw new Error("Cannot find node_modules/electron to run the isolation probe. Run the harness from a checkout with dependencies installed.");
  }
  const probeDir = path.join(ROOT, "probe");
  fs.mkdirSync(probeDir, { recursive: true });
  fs.writeFileSync(path.join(probeDir, "package.json"), JSON.stringify({ name: "doem-smoke-probe", main: "main.js" }));
  fs.writeFileSync(
    path.join(probeDir, "main.js"),
    `const { app } = require("electron");
app.setName("Doem");
process.stdout.write("USERDATA=" + app.getPath("userData") + "\\nVERSION=" + process.versions.electron + "\\n");
app.exit(0);\n`,
  );
  const want = path.join(ROOT, "probe-ud", "Doem");
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  let out = "";
  try {
    out = execFileSync(electronBin, [probeDir, `--user-data-dir=${want}`], { env, encoding: "utf8", timeout: 60000, stdio: ["ignore", "pipe", "ignore"] });
  } catch (e) {
    throw new Error(`Isolation probe failed to run (${e.message}).`);
  }
  const got = /USERDATA=(.*)/.exec(out)?.[1]?.trim();
  const probeVersion = /VERSION=(.*)/.exec(out)?.[1]?.trim();
  const same = (a, b) => {
    try {
      return fs.realpathSync(a) === fs.realpathSync(b);
    } catch {
      return path.resolve(a) === path.resolve(b);
    }
  };
  if (!got || !(same(got, want) || got === want)) {
    throw new Error(
      `--user-data-dir does NOT move app.getPath("userData") in this Electron (probe wanted ${want}, got ${got}). ` +
        `Stopping: the packaged app would use the real ~/Library/Application Support/Doem.`,
    );
  }
  // 2. The packaged app must run the same Electron as the probe.
  let appVersion = null;
  try {
    appVersion = execFileSync(
      "plutil",
      ["-extract", "CFBundleVersion", "raw", "-o", "-", path.join(APP, "Contents", "Frameworks", "Electron Framework.framework", "Resources", "Info.plist")],
      { encoding: "utf8" },
    ).trim();
  } catch {}
  if (appVersion && probeVersion && appVersion !== probeVersion) {
    throw new Error(`Packaged app runs Electron ${appVersion} but the isolation probe proved ${probeVersion}; isolation is unproven for the packaged version.`);
  }
  return `isolation probe ok (Electron ${probeVersion}; packaged ${appVersion ?? "version unreadable"})`;
}

// ---------------------------------------------------------------- cases
async function case1() {
  const dir = dataRoot("case1") + "/Doem";
  const inst = launch("first launch", dir);
  const port = await waitReady(inst);
  assert(fs.existsSync(path.join(dir, "doem.log")), "no doem.log in the isolated data folder");
  for (const p of PAGES) {
    const res = await fetch(`http://${HOST}:${port}${p}`, { signal: AbortSignal.timeout(60000) });
    await res.arrayBuffer();
    assert(res.status === 200, `GET ${p} returned ${res.status}`);
  }
  await sleep(1500);
  const bad = errorLines(readLogFrom(dir, 0));
  assert(bad.length === 0, `error lines in doem.log: ${bad.slice(0, 3).join(" | ")}`);
  await gracefulQuit(inst);
  return `port ${port}, ${PAGES.length} pages 200, log clean`;
}

async function case2() {
  const dir = dataRoot("case2") + "/Doem";
  const title = `smoke-persist-${Date.now()}`;
  const times = [];
  for (let c = 1; c <= CYCLES; c++) {
    const t0 = Date.now();
    const inst = launch(`cycle ${c}`, dir);
    const port = await waitReady(inst);
    if (c === 1) {
      const r = await api(port, "POST", "/api/tasks", { title, scheduled: null, minutes: 30 });
      assert(r.status === 201, `cycle 1: creating the task returned ${r.status}`);
    } else {
      const r = await api(port, "GET", "/api/tasks");
      const found = Array.isArray(r.json) && r.json.some((t) => t.title === title);
      assert(found, `cycle ${c}: the task written in cycle 1 is missing`);
    }
    await gracefulQuit(inst);
    times.push(Date.now() - t0);
  }
  assertOwnerAlive("after the quit cycles");
  const ownerNote = ownerBefore.length ? `owner Doem still running (${ownerBefore.length} proc)` : "owner Doem was not running (nothing to prove)";
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  return `${CYCLES} cycles, avg ${(avg / 1000).toFixed(1)}s, max ${(Math.max(...times) / 1000).toFixed(1)}s, task present at the end, ${ownerNote}`;
}

function mainProcesses() {
  return psTable().filter(
    (r) => r.command.startsWith(EXE) && !r.command.includes("--type=") && !r.command.includes("child-bootstrap") && !r.command.includes("ELECTRON_RUN_AS_NODE"),
  );
}
async function case3() {
  const dir = dataRoot("case3") + "/Doem";
  const a = launch("running instance", dir);
  const port = await waitReady(a);
  const startsBefore = (readLogFrom(dir, 0).match(/starting server on port/g) ?? []).length;
  const b = launch("second launch", dir);
  const exited = await waitFor(() => b.exited, 20000);
  assert(exited, "second launch is still running after 20s (it should hand off and exit)");
  assert(!a.exited, "the first instance died when the second launched");
  await sleep(1500);
  const mains = mainProcesses();
  assert(mains.length === 1 && mains[0].pid === a.pid, `expected exactly one instance, found pids ${mains.map((r) => r.pid).join(", ")}`);
  const startsAfter = (readLogFrom(dir, 0).match(/starting server on port/g) ?? []).length;
  assert(startsAfter === startsBefore, "the second launch started another server");
  const res = await fetch(`http://${HOST}:${port}/`, { signal: AbortSignal.timeout(5000) });
  assert(res.status === 200, `server answered ${res.status} after the second launch`);
  await gracefulQuit(a);
  return `second process exited (code ${b.exitCode}), one instance, no second server. Window focus itself is a hand check`;
}

async function writeTask(port, title) {
  const r = await api(port, "POST", "/api/tasks", { title, scheduled: null, minutes: 30 });
  assert(r.status === 201, `creating task returned ${r.status}`);
  return r.json.id;
}
async function case4() {
  const dir = dataRoot("case4") + "/Doem";
  const title = `smoke-idle-${Date.now()}`;
  const a = launch("before crash", dir);
  const port = await waitReady(a);
  await writeTask(port, title);
  await sleep(3000);
  await crashKill(a, warnings, "case 4");
  const b = launch("after crash", dir);
  const port2 = await waitReady(b);
  const r = await api(port2, "GET", "/api/tasks");
  assert(Array.isArray(r.json) && r.json.some((t) => t.title === title), "the task is gone after kill -9");
  await gracefulQuit(b);
  return `database reopened on port ${port2}, task present`;
}

async function case5() {
  const dir = dataRoot("case5") + "/Doem";
  const title = `smoke-timer-${Date.now()}`;
  const a = launch("before crash", dir);
  const port = await waitReady(a);
  const taskId = await writeTask(port, title);
  const t0 = Date.now();
  const s = await api(port, "POST", "/api/time-entries", { taskId });
  assert(s.status === 201, `starting the timer returned ${s.status}`);
  await sleep(4000);
  await crashKill(a, warnings, "case 5");
  const b = launch("after crash", dir);
  const port2 = await waitReady(b);
  const r = await api(port2, "GET", "/api/time-entries");
  assert(r.status === 200 && r.json && Array.isArray(r.json.entries), "GET /api/time-entries failed after the crash");
  const entries = r.json.entries;
  const open = entries.filter((e) => !e.endedAt);
  assert(open.length <= 1, `${open.length} entries are open at once`);
  for (const e of entries) {
    assert(Number.isFinite(Date.parse(e.startedAt)), `entry ${e.id} has an invalid startedAt`);
    assert(Date.parse(e.startedAt) <= Date.now() + 5000, `entry ${e.id} starts in the future`);
    if (e.endedAt) assert(Date.parse(e.endedAt) >= Date.parse(e.startedAt), `entry ${e.id} ends before it starts`);
  }
  const mine = entries.filter((e) => e.taskId === taskId);
  assert(mine.length === 1, `expected 1 entry for the task, found ${mine.length}`);
  assert(Date.parse(mine[0].startedAt) >= t0 - 5000, "the entry's start time is off");
  const state = mine[0].endedAt ? "closed by the app on recovery" : "still running";
  if (!mine[0].endedAt) {
    assert(r.json.running && r.json.running.id === mine[0].id, "an open entry exists but runningEntry does not report it");
    const stop = await api(port2, "POST", "/api/time-entries/stop");
    assert(stop.status === 200 && stop.json && stop.json.endedAt, `stopping the recovered timer returned ${stop.status}`);
    assert(Date.parse(stop.json.endedAt) >= Date.parse(stop.json.startedAt), "stopped entry ends before it starts");
    const after = await api(port2, "GET", "/api/time-entries");
    assert(!after.json.running, "a timer is still running after stop");
  }
  await gracefulQuit(b);
  return `no crash, one sane entry (${state})`;
}

async function case6() {
  const demo = path.join(REPO, "scripts", "demo-data.ts");
  if (!fs.existsSync(demo)) return skipCase(6, "upgrade from Tempo", "scripts/demo-data.ts does not exist yet, cannot seed a Tempo database");
  const tsx = path.join(REPO, "node_modules", ".bin", "tsx");
  if (!fs.existsSync(tsx)) return skipCase(6, "upgrade from Tempo", "node_modules/.bin/tsx missing, cannot run the demo seeder");
  await runCase(6, "upgrade from Tempo", async () => {
    const root = dataRoot("case6");
    const seed = path.join(ROOT, "demo-seed"); // must not end in "pglite"
    fs.mkdirSync(seed, { recursive: true });
    execFileSync(tsx, [demo], { cwd: REPO, env: { ...process.env, PGLITE_DIR: seed }, stdio: ["ignore", "pipe", "pipe"], timeout: 300000 });
    assert(fs.readdirSync(seed).length > 0, "the demo seeder wrote nothing");
    const tempo = path.join(root, "Tempo");
    fs.mkdirSync(tempo, { recursive: true });
    fs.cpSync(seed, path.join(tempo, "pglite"), { recursive: true });
    fs.writeFileSync(path.join(tempo, "settings.json"), JSON.stringify({ smokeMarker: "from-tempo" }));
    fs.mkdirSync(path.join(tempo, "Local Storage", "leveldb"), { recursive: true });
    fs.writeFileSync(path.join(tempo, "Local Storage", "leveldb", "marker"), "x");
    const doemDir = path.join(root, "Doem");
    assert(!fs.existsSync(doemDir), "Doem folder unexpectedly exists before launch");

    const inst = launch("upgrade launch", doemDir);
    const port = await waitReady(inst);
    assert(fs.existsSync(path.join(doemDir, "pglite")), "pglite did not arrive in the Doem folder");
    const left = ["pglite", "settings.json"].filter((e) => fs.existsSync(path.join(tempo, e)));
    assert(left.length === 0, `Tempo folder still holds ${left.join(", ")}`);
    const settingsFile = path.join(doemDir, "settings.json");
    assert(fs.existsSync(settingsFile) && fs.readFileSync(settingsFile, "utf8").includes("from-tempo"), "settings.json did not move across intact");
    assert(readLogFrom(doemDir, 0).includes("[doem] migrated"), "no '[doem] migrated' line in the log");
    const r = await api(port, "GET", "/api/tasks");
    assert(Array.isArray(r.json) && r.json.length > 0, "no tasks after the upgrade: the seeded data did not come across");
    const lsLeft = fs.existsSync(path.join(tempo, "Local Storage"));
    if (lsLeft) warnings.push("case 6: Local Storage stayed in the Tempo folder (Chromium had already created its own)");
    await gracefulQuit(inst);
    return `${r.json.length} seeded tasks present, pglite and settings.json moved, Tempo kept nothing it should not`;
  });
}

// ---------------------------------------------------------------- main
async function main() {
  const t0 = Date.now();
  console.log(`Doem lifecycle smoke test\n  app:     ${SOURCE_APP}\n  scratch: ${ROOT}\n  owner Doem processes seen: ${ownerBefore.length}`);
  execFileSync("ditto", ["--noqtn", SOURCE_APP, APP]);
  console.log(`  ${await preflight()}`);

  await runCase(1, "first launch on an empty data folder", case1);
  await runCase(2, `${CYCLES} launch/quit cycles keep data`, case2);
  await runCase(3, "second launch while running", case3);
  await runCase(4, "kill -9 while idle", case4);
  await runCase(5, "kill -9 while a timer runs", case5);
  if (!ONLY || ONLY.has("6")) await case6();

  try {
    assertOwnerAlive("end of run");
  } catch (e) {
    results.push({ id: "-", name: "owner Doem untouched", ok: false, ms: 0, detail: e.message });
    console.log(`FAIL  owner Doem untouched  ${e.message}`);
  }
  const failed = results.filter((r) => !r.ok);
  const skipped = results.filter((r) => r.skipped);
  console.log(`\n${results.length - failed.length - skipped.length} passed, ${failed.length} failed, ${skipped.length} skipped in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  for (const w of warnings) console.log(`WARN  ${w}`);
  return failed.length ? 1 : 0;
}

let code = 1;
try {
  code = await main();
} catch (e) {
  console.error(`STOP  ${e.message}`);
}
cleanup();
const stillThere = (() => {
  try {
    return psTable().filter((r) => r.command.includes(ROOT)).length;
  } catch {
    return 0;
  }
})();
if (stillThere) console.error(`WARN  ${stillThere} scratch process(es) still alive after cleanup`);
process.exit(code);
