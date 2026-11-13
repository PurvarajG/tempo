import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const hookSource = readFileSync(path.join(import.meta.dirname, "../scripts/electron-after-pack.js"), "utf8");

async function runAfterPack(platform: string) {
  const codesignCalls: unknown[][] = [];
  const mod = { exports: {} as { default?: (context: unknown) => Promise<void> } };
  vm.runInNewContext(hookSource, {
    module: mod,
    exports: mod.exports,
    console: { log() {} },
    require(id: string) {
      if (id === "node:fs") return { existsSync: () => false };
      if (id === "node:path") return path;
      if (id === "node:child_process") {
        return { execFileSync: (...args: unknown[]) => codesignCalls.push(args) };
      }
      throw new Error(`unexpected require: ${id}`);
    },
  });

  await mod.exports.default!({
    electronPlatformName: platform,
    appOutDir: "/tmp/package-output",
    packager: {
      projectDir: "/tmp/project-without-next-node-modules",
      appInfo: { productFilename: "Doem" },
    },
  });
  return JSON.parse(JSON.stringify(codesignCalls)) as unknown[][];
}

test("afterPack seals every macOS app even when .next/node_modules is absent", async () => {
  const calls = await runAfterPack("darwin");
  assert.deepEqual(calls, [
    ["codesign", ["--force", "--deep", "--sign", "-", "/tmp/package-output/Doem.app"], { stdio: "inherit" }],
  ]);
});

test("afterPack does not codesign non-macOS bundles", async () => {
  assert.deepEqual(await runAfterPack("linux"), []);
});
