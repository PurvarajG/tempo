import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const preload = readFileSync(path.join(import.meta.dirname, "../electron/preload.js"), "utf8");
const main = readFileSync(path.join(import.meta.dirname, "../electron/main.js"), "utf8");

test("preload sends attention on the literal channel", () => {
  assert.match(preload, /ipcRenderer\.send\("doem:attention", payload\)/);
});

test("main registers exactly one doem:attention handler", () => {
  const matches = main.match(/ipcMain\.on\("doem:attention"/g) ?? [];
  assert.equal(matches.length, 1);
});

test("attention handler bounces the Dock once, informational only", () => {
  const start = main.indexOf('ipcMain.on("doem:attention"');
  const end = main.indexOf("async function createWindow", start);
  const handler = main.slice(start, end);
  assert.match(handler, /dock\.bounce\("informational"\)/);
  assert.doesNotMatch(handler, /critical/);
  assert.equal((handler.match(/dock\.bounce\(/g) ?? []).length, 1);
  assert.doesNotMatch(handler, /setInterval|setTimeout/);
});
