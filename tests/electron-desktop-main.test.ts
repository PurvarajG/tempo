import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const main = readFileSync(path.join(import.meta.dirname, "../electron/main.js"), "utf8");

function count(re: RegExp): number {
  return (main.match(re) ?? []).length;
}

test("capture shortcut registers and unregisters on will-quit", () => {
  assert.match(main, /globalShortcut\.register\(/);
  const start = main.indexOf('app.on("will-quit"');
  assert.ok(start > -1);
  const end = main.indexOf("});", start);
  assert.match(main.slice(start, end), /globalShortcut\.unregisterAll\(\)/);
  assert.match(main, /captureShortcut: "Control\+Alt\+Space"/);
});

test("capture window is a 560x64 frameless always-on-top bar loading /capture", () => {
  const start = main.indexOf("async function ensureCaptureWindow");
  const body = main.slice(start, main.indexOf("let captureBusy", start));
  assert.match(body, /width: 560/);
  assert.match(body, /height: 64/);
  assert.match(body, /frame: false/);
  assert.match(body, /alwaysOnTop: true/);
  assert.match(body, /transparent: true/);
  assert.doesNotMatch(body, /vibrancy/);
  assert.match(body, /\/capture`/);
});

test("desktop ipc handlers are registered once each", () => {
  for (const channel of ["doem:set-reminders", "doem:set-desktop-settings", "doem:capture-close", "doem:capture-saved"]) {
    assert.equal(count(new RegExp(`ipcMain\\.on\\("${channel}"`, "g")), 1, channel);
  }
  assert.equal(count(/ipcMain\.handle\("doem:get-capture-status"/g), 1);
});

test("main uses the wave-1 modules", () => {
  for (const mod of ["./reminder-schedule", "./nudge", "./away-watcher"]) {
    assert.ok(main.includes(`require("${mod}")`), mod);
  }
});

test("reminder notification carries the three actions", () => {
  assert.match(main, /text: "Start"/);
  assert.match(main, /text: "Snooze 15m"/);
  assert.match(main, /text: "Tomorrow"/);
});

test("either tray click pops up a freshly built menu", () => {
  assert.match(main, /tray\.popUpContextMenu\(buildTrayMenu\(/);
  assert.doesNotMatch(main, /tray\.setContextMenu\(/);
  assert.match(main, /tray\.on\("click", \(\) => openTrayMenu\(\)\)/);
  assert.match(main, /tray\.on\("right-click", \(\) => openTrayMenu\(\)\)/);
  assert.match(main, /label: "Quick Add Task…"/);
  assert.match(main, /label: "Open Doem"/);
  assert.match(main, /label: "Quit Doem"/);
});

test("View menu has Inbox on CmdOrCtrl+0, and nothing else claims it", () => {
  assert.match(main, /label: "Inbox", accelerator: "CmdOrCtrl\+0"/);
  assert.equal(count(/CmdOrCtrl\+0/g), 1);
  assert.doesNotMatch(main, /resetZoom/);
});

test("power monitor lock and unlock are watched", () => {
  assert.match(main, /powerMonitor\.on\("lock-screen"/);
  assert.match(main, /powerMonitor\.on\("unlock-screen"/);
});

test("file writes stay inside the settings writer and the log", () => {
  const fnBody = (name: string) => {
    const start = main.indexOf(`function ${name}(`);
    return main.slice(start, main.indexOf("\n}\n", start));
  };
  assert.equal(count(/writeFile/g), 1);
  assert.match(fnBody("writeSettingsFile"), /writeFileSync/);
  assert.equal(count(/appendFile/g), 1);
  assert.match(fnBody("logLine"), /appendFileSync/);
});

test("attention handler stays directly before createWindow", () => {
  const start = main.indexOf('ipcMain.on("doem:attention"');
  const rest = main.slice(start);
  assert.match(rest, /^[\s\S]*?\}\);\n\nasync function createWindow/);
});

test("claude awareness is off by default and polled only while on", () => {
  assert.match(main, /require\("\.\/claude-sessions"\)/);
  assert.match(main, /let claudeAwareness = false;/);
  assert.match(main, /ipcMain\.handle\("doem:get-claude-sessions"/);
  assert.match(main, /send\("doem:claude-sessions"/);
  assert.match(main, /waitingNotification\(session\)/);
  const start = main.indexOf('ipcMain.on("doem:set-desktop-settings"');
  const end = main.indexOf("\n});", start);
  const handler = main.slice(start, end);
  assert.match(handler, /settings\.claudeAwareness === true/);
  assert.match(handler, /clearInterval\(claudeInterval\)/);
  assert.match(handler, /setInterval\(refreshClaudeSessions, 60_000\)/);
});

test("claude interval is cleared on quit", () => {
  const start = main.indexOf('app.on("before-quit"');
  const end = main.indexOf("});", start);
  assert.match(main.slice(start, end), /clearInterval\(claudeInterval\)/);
});

test("main.js never writes near the claude root", () => {
  const bad = main
    .split("\n")
    .filter((l) => /claude/i.test(l) && /writeFile|appendFile|mkdir|rm|unlink|rename|createWriteStream/.test(l));
  assert.deepEqual(bad, []);
});
