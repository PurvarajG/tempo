"use strict";

// Read-only scanner for Claude Code session logs. No Electron import.
// It lists root/*/*.jsonl and streams each file with flags "r". It never
// changes anything on disk.
//
// @typedef {Object} ClaudeSession
// @property {string} id               file name without .jsonl, or the sessionId field
// @property {string} projectPath      cwd from the last line that has one, else the folder name
// @property {string} projectName      basename of projectPath
// @property {string|null} branch      gitBranch from the last line that has one
// @property {string} lastPrompt       last real user prompt, collapsed, first 80 characters
// @property {string} firstMessageAt   ISO time of the earliest message at or after `since`
// @property {string} lastMessageAt     ISO time of the latest message
// @property {boolean} waiting          last message is an assistant end_turn
// @property {boolean} active          last message within 15 minutes of `now`
//
// Matches: export type ClaudeSession = { id: string; projectPath: string;
// projectName: string; branch: string | null; lastPrompt: string;
// firstMessageAt: string; lastMessageAt: string; waiting: boolean;
// active: boolean };

const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");

const PROJECTS_SUBPATH = [".claude", "projects"];
const ACTIVE_MINUTES = 15;
const PROMPT_MAX = 80;
const NOTIFY_BODY_MAX = 200;
const KEY_CAP = 500;

function promptText(message) {
  if (!message) return null;
  const content = message.content;
  let text = null;
  if (typeof content === "string") {
    text = content;
  } else if (Array.isArray(content)) {
    const parts = content
      .filter((c) => c && typeof c.text === "string")
      .map((c) => c.text);
    if (parts.length === 0) return null;
    text = parts.join(" ");
  }
  if (text === null) return null;
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean || clean.startsWith("<")) return null;
  return clean.slice(0, PROMPT_MAX);
}

async function readSession(file, folderName, since, now) {
  let firstMs = null;
  let lastMs = null;
  let lastLine = null;
  let cwd = null;
  let branch = null;
  let sessionId = null;
  let lastPrompt = "";

  const stream = fs.createReadStream(file, { flags: "r", encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of rl) {
      if (!line.trim()) continue;
      let obj;
      try {
        obj = JSON.parse(line);
      } catch {
        continue;
      }
      if (!obj || typeof obj !== "object") continue;
      if (obj.type !== "user" && obj.type !== "assistant") continue;
      if (obj.isSidechain === true || obj.isMeta === true) continue;
      const ms = typeof obj.timestamp === "string" ? Date.parse(obj.timestamp) : NaN;
      if (Number.isNaN(ms)) continue;

      if (typeof obj.cwd === "string" && obj.cwd) cwd = obj.cwd;
      if (typeof obj.gitBranch === "string" && obj.gitBranch) branch = obj.gitBranch;
      if (typeof obj.sessionId === "string" && obj.sessionId) sessionId = obj.sessionId;

      if (ms >= since.getTime() && (firstMs === null || ms < firstMs)) firstMs = ms;
      if (lastMs === null || ms > lastMs) lastMs = ms;
      lastLine = obj;

      if (obj.type === "user") {
        const p = promptText(obj.message);
        if (p !== null) lastPrompt = p;
      }
    }
  } finally {
    rl.close();
    stream.destroy();
  }

  if (firstMs === null || lastMs === null) return null;
  const projectPath = cwd || folderName;
  const waiting =
    !!lastLine &&
    lastLine.type === "assistant" &&
    !!lastLine.message &&
    lastLine.message.stop_reason === "end_turn";
  return {
    id: sessionId || path.basename(file, ".jsonl"),
    projectPath,
    projectName: path.basename(projectPath),
    branch,
    lastPrompt,
    firstMessageAt: new Date(firstMs).toISOString(),
    lastMessageAt: new Date(lastMs).toISOString(),
    waiting,
    active: now.getTime() - lastMs <= ACTIVE_MINUTES * 60000,
  };
}

async function scanClaudeSessions({ root, since, now, maxFiles = 200 }) {
  const candidates = [];
  let folders;
  try {
    folders = await fs.promises.readdir(root);
  } catch {
    return [];
  }
  for (const folder of folders) {
    try {
      const dir = path.join(root, folder);
      const dirStat = await fs.promises.lstat(dir);
      if (!dirStat.isDirectory()) continue;
      const names = await fs.promises.readdir(dir);
      for (const name of names) {
        if (!name.endsWith(".jsonl")) continue;
        try {
          const file = path.join(dir, name);
          const st = await fs.promises.stat(file);
          if (!st.isFile() || st.mtime.getTime() < since.getTime()) continue;
          candidates.push({ file, folder, mtime: st.mtime.getTime() });
        } catch {
          // file vanished or unreadable: skip
        }
      }
    } catch {
      // folder vanished or unreadable: skip
    }
  }
  candidates.sort((a, b) => b.mtime - a.mtime);

  const sessions = [];
  for (const c of candidates.slice(0, maxFiles)) {
    try {
      const s = await readSession(c.file, c.folder, since, now);
      if (s) sessions.push(s);
    } catch {
      // skip this file
    }
  }
  sessions.sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt));
  return sessions;
}

function createWaitTracker({ freshMinutes = 10 } = {}) {
  const seen = new Set();
  return {
    update(sessions, now) {
      const out = [];
      for (const s of sessions) {
        if (!s.waiting) continue;
        if (now.getTime() - Date.parse(s.lastMessageAt) > freshMinutes * 60000) continue;
        const key = `${s.id}|${s.lastMessageAt}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(s);
      }
      while (seen.size > KEY_CAP) {
        seen.delete(seen.values().next().value);
      }
      return out;
    },
  };
}

function waitingNotification(session) {
  const body = session.branch ? `${session.branch}. ${session.lastPrompt}` : session.lastPrompt;
  return {
    title: `Claude is waiting in ${session.projectName}`,
    body: body.slice(0, NOTIFY_BODY_MAX),
  };
}

module.exports = { scanClaudeSessions, createWaitTracker, waitingNotification, PROJECTS_SUBPATH };
