import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const preload = readFileSync(path.join(import.meta.dirname, "../electron/preload.js"), "utf8");
const bridge = readFileSync(path.join(import.meta.dirname, "../lib/desktop-bridge.ts"), "utf8");

const CALLS = [
  'ipcRenderer.send("doem:set-reminders", reminders)',
  'ipcRenderer.send("doem:set-desktop-settings", settings)',
  'ipcRenderer.invoke("doem:get-capture-status")',
  'ipcRenderer.on("doem:capture-status", listener)',
  'ipcRenderer.invoke("doem:get-claude-sessions")',
  'ipcRenderer.on("doem:claude-sessions", listener)',
  'ipcRenderer.send("doem:capture-close")',
  'ipcRenderer.send("doem:capture-saved")',
];

test("preload carries each new literal channel call", () => {
  for (const call of CALLS) assert.ok(preload.includes(call), call);
  assert.match(preload, /removeListener\("doem:capture-status", listener\)/);
  assert.match(preload, /removeListener\("doem:claude-sessions", listener\)/);
});

test("every ipcRenderer send/invoke/on takes a string literal channel", () => {
  const all = preload.match(/ipcRenderer\.(send|invoke|on)\(/g) ?? [];
  const literal = preload.match(/ipcRenderer\.(send|invoke|on)\(\s*"[^"]+"/g) ?? [];
  assert.ok(all.length >= 10);
  assert.equal(literal.length, all.length);
});

test("ipcRenderer is never exposed as a value", () => {
  const start = preload.indexOf("exposeInMainWorld");
  const body = preload.slice(start);
  assert.doesNotMatch(body.split("\n")[0] ?? "", /ipcRenderer/);
  assert.doesNotMatch(body, /^\s*ipcRenderer\s*[,:]/m);
  assert.doesNotMatch(body, /:\s*ipcRenderer\s*[,}]/);
});

test("desktop-bridge declares the new commands, types and methods", () => {
  for (const t of ["refresh-tasks", "reminder-start", "reminder-tomorrow", "away"]) {
    assert.ok(bridge.includes(`type: "${t}"`), t);
  }
  for (const n of ["DoemReminder", "DoemDesktopSettings", "DoemCaptureStatus", "ClaudeSession"]) {
    assert.match(bridge, new RegExp(`export type ${n} =`));
  }
  for (const m of ["setReminders", "setDesktopSettings", "getCaptureStatus", "onCaptureStatus", "getClaudeSessions", "onClaudeSessions", "closeCapture", "captureSaved"]) {
    assert.match(bridge, new RegExp(`${m}: \\(`));
  }
  assert.match(bridge, /claudeAwareness: boolean/);
});
