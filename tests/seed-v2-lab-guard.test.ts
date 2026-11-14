import assert from "node:assert/strict";
import test from "node:test";
import { requireV2LabGuards } from "../scripts/seed-v2-lab";

const REAL = "/Users/x/Library/Application " + "Support/Doem/pglite-data";

test("throws without LAB_MODE", () => {
  assert.throws(() => requireV2LabGuards({ PGLITE_DIR: ".data/v2-lab" }), /LAB_MODE/);
});

test("throws for a PGLITE_DIR ending in pglite", () => {
  assert.throws(() => requireV2LabGuards({ LAB_MODE: "1", PGLITE_DIR: ".data/pglite" }), /lab-only/);
});

test("throws for a path inside the real app data folder", () => {
  assert.throws(() => requireV2LabGuards({ LAB_MODE: "1", PGLITE_DIR: REAL }), /real app data/);
});

test("throws when PGLITE_DIR is unset", () => {
  assert.throws(() => requireV2LabGuards({ LAB_MODE: "1" }));
});

test("passes for .data/v2-lab with LAB_MODE=1", () => {
  assert.doesNotThrow(() => requireV2LabGuards({ LAB_MODE: "1", PGLITE_DIR: ".data/v2-lab" }));
});
