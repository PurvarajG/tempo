"use strict";

// Carries an install's data across app renames. Pure Node (no Electron
// import) so it can be unit tested against a temp directory.
//
// The app was DayPlan, then Tempo, now Doem. Electron derives the userData
// folder from the product name (~/Library/Application Support/<name>), so
// each rename points the app at a new, empty folder unless the old one is
// moved across.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

// Earlier names, newest first: if both exist, the newer data wins.
const LEGACY_NAMES = ["Tempo", "DayPlan"];

// What the second branch rescues when the new folder already exists: the
// database, the desktop settings, and Chromium's localStorage (theme choice,
// sidebar state; lib/storage-key.ts then renames the tempo.* keys). The
// origin is the fixed 127.0.0.1 port, so the stored values stay readable.
const CARRIED_ENTRIES = ["pglite", "settings.json", "Local Storage"];

/**
 * True when a running copy of the old app (`name`) owns `legacy`.
 *
 * Chromium's SingletonLock in the userData folder is a symlink to
 * "<hostname>-<pid>". The new app's own single-instance lock lives in its own
 * folder, so it cannot see the old app; without this check a launch next to a
 * running Tempo would move the database out from under it and leave two PGlite
 * writers on one directory. postmaster.pid is no use here: PGlite writes a
 * placeholder PID into it.
 *
 * The PID is checked by name as well, so a stale lock whose PID has been
 * reused by some other process does not block the move forever.
 */
function legacyInUse(legacy, name, deps = {}) {
  const hostname = deps.hostname ?? os.hostname();
  const processName = deps.processName ?? defaultProcessName;
  let target;
  try {
    target = fs.readlinkSync(path.join(legacy, "SingletonLock"));
  } catch {
    return false; // No lock: the old app is not running.
  }
  const dash = target.lastIndexOf("-");
  const host = target.slice(0, dash);
  const pid = Number(target.slice(dash + 1));
  if (dash < 0 || host !== hostname || !Number.isInteger(pid) || pid <= 0) return false;
  const command = processName(pid);
  return command !== null && command.includes(name);
}

// Full command path of a live PID, or null when no such process exists.
function defaultProcessName(pid) {
  try {
    return execFileSync("ps", ["-p", String(pid), "-o", "comm="], { encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
}

/** The first earlier name whose folder a running old app still owns, or null. */
function legacyAppRunning(dir, legacyNames = LEGACY_NAMES, deps = {}) {
  for (const name of legacyNames) {
    const legacy = path.join(path.dirname(dir), name);
    if (legacy !== dir && fs.existsSync(legacy) && legacyInUse(legacy, name, deps)) return name;
  }
  return null;
}

/**
 * Move each earlier folder into `dir` once, newest name first.
 *
 * - `dir` missing: rename the whole legacy folder to `dir`.
 * - `dir` present (Chromium creates userData early in startup, so by the time
 *   anything of ours runs it often exists already): move only the database,
 *   settings.json and Local Storage, each into a slot nothing has claimed.
 *   Never overwrite.
 *
 * A folder still owned by a running old app is never touched (see
 * legacyInUse); main.js refuses to start in that case before calling this.
 *
 * A failed move is never fatal; it just means starting from an empty database.
 * Returns a list of what was moved, for the log.
 */
function migrateLegacyUserData(dir, legacyNames = LEGACY_NAMES, deps = {}) {
  const moved = [];
  for (const name of legacyNames) {
    const legacy = path.join(path.dirname(dir), name);
    if (legacy === dir || !fs.existsSync(legacy)) continue;
    if (legacyInUse(legacy, name, deps)) continue;
    try {
      if (!fs.existsSync(dir)) {
        fs.renameSync(legacy, dir);
        moved.push(`${name}/ -> ${path.basename(dir)}/`);
        continue;
      }
      for (const entry of CARRIED_ENTRIES) {
        const from = path.join(legacy, entry);
        const to = path.join(dir, entry);
        if (fs.existsSync(from) && !fs.existsSync(to)) {
          fs.renameSync(from, to);
          moved.push(`${name}/${entry} -> ${path.basename(dir)}/${entry}`);
        }
      }
    } catch {
      // Keep going with the next name; the app still starts.
    }
  }
  return moved;
}

module.exports = { migrateLegacyUserData, legacyAppRunning, legacyInUse, LEGACY_NAMES, CARRIED_ENTRIES };
