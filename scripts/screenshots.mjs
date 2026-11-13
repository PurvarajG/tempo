// Screenshot tool: captures routes of a running Doem server as 2880x1800 PNGs
// (1440x900 CSS pixels at device scale factor 2), once per theme.
//
//   node scripts/screenshots.mjs --base=http://localhost:4700 --out=./shots
//   node scripts/screenshots.mjs --base=http://localhost:4701 --out=./shots --themes=dark --routes=/,/tracking,/projects/first
//
// Options (all optional):
//   --base=URL       server to capture (default http://localhost:4700)
//   --out=DIR        output folder, created if missing (default ./screenshots)
//   --themes=a,b     light, dark or both (default light,dark); --theme= is an alias
//   --routes=a,b     comma-separated paths, e.g. /,/calendar?view=week,/settings#desktop.
//                    "/projects/first" means the first project in /api/projects.
//                    Default: a standard list of every main screen plus the first project's board.
//   --theme-key=K    localStorage key the app reads its theme from (default "theme")
//   --list           print the default routes and their file slugs, then exit (no server needed)
//
// Files are named <slug>-<theme>.png, e.g. today-light.png, calendar-week-dark.png, project-dark.png.
// A run prints one JSON line {outDir, files, consoleErrors, failed}; exit code 1 if anything failed.
// Under node it re-launches itself inside the local Electron binary (hidden offscreen window,
// throwaway userData). It only reads from the server, it never writes to it.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const opt = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const DEFAULT_ROUTES = [
  "/",
  "/inbox",
  "/all",
  "/upcoming",
  "/calendar",
  "/calendar?view=week",
  "/calendar?view=month",
  "/calendar?view=day",
  "/completed",
  "/search",
  "/trash",
  "/settings",
  "/tracking",
  "/tracking/settings",
  "/wrap",
  "/?view=board",
  "/upcoming?view=board",
  "/projects/first",
];

// slugOf:start
const slugOf = (route) => {
  const [noHash, hash = ""] = route.split("#");
  const [pathPart, query = ""] = noHash.split("?");
  if (pathPart.startsWith("/projects/")) return "project";
  const params = new URLSearchParams(query);
  const view = params.get("view") ?? (params.get("reset") === "1" ? "reset" : null);
  const base = pathPart === "/" ? "today" : pathPart.slice(1).replace(/\//g, "-");
  const tail = view ?? (hash || null);
  return tail ? `${base}-${tail.replace(/[^a-z0-9]+/gi, "-")}` : base;
};
// slugOf:end

if (args.includes("--list")) {
  for (const r of DEFAULT_ROUTES) console.log(`${slugOf(r)}\t${r}`);
  process.exit(0);
}

if (!process.versions.electron) {
  const electronPath = (await import("electron")).default;
  const child = spawn(electronPath, [fileURLToPath(import.meta.url), ...args], {
    stdio: "inherit",
    env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
  });
  child.on("exit", (code) => process.exit(code ?? 1));
  child.on("error", (e) => {
    console.error("could not start electron:", e.message);
    process.exit(1);
  });
} else {
  const { app, BrowserWindow, nativeTheme } = await import("electron");
  const ORIGIN = (opt("base") ?? "http://localhost:4700").replace(/\/+$/, "");
  const OUT = path.resolve(opt("out") ?? "screenshots");
  const THEMES = (opt("themes") ?? opt("theme") ?? "light,dark").split(",").map((s) => s.trim()).filter(Boolean);
  const THEME_KEY = opt("theme-key") ?? "theme";
  const routeArg = opt("routes");
  const ROUTES = routeArg ? routeArg.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_ROUTES;
  const W = 1440, H = 900, SCALE = 2;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  app.setPath("userData", fs.mkdtempSync(path.join(os.tmpdir(), "doem-shots-")));
  app.commandLine.appendSwitch("disable-gpu");

  const result = { outDir: OUT, files: [], consoleErrors: [], failed: [] };

  async function waitForServer() {
    const end = Date.now() + 30000;
    while (Date.now() < end) {
      try {
        if ((await fetch(`${ORIGIN}/api/projects`)).ok) return;
      } catch {}
      await sleep(500);
    }
    throw new Error(`No server answered at ${ORIGIN} within 30 s. Start it first.`);
  }

  async function firstProjectId() {
    const data = await (await fetch(`${ORIGIN}/api/projects`)).json();
    const list = Array.isArray(data) ? data : data.projects ?? [];
    return list[0]?.id ?? null;
  }

  let win, wc;
  let label = "";
  const wire = () => {
  wc.on("console-message", (...a) => {
    // Electron 35+ passes one details object; older passes (event, level, message).
    const d = a[0] && typeof a[0] === "object" && "level" in a[0] && a.length === 1 ? a[0] : null;
    const level = d ? d.level : a[1];
    if (level === "error" || level === 3) result.consoleErrors.push({ shot: label, message: String(d ? d.message : a[2]) });
  });
  wc.on("did-fail-load", (_e, code, desc, u, isMain) => {
    if (isMain) result.failed.push(`${label}: ${desc} (${code}) ${u}`);
  });
  };

  // Fixed 1440x900 viewport at device scale factor 2, whatever the host display is.
  async function emulate() {
    if (!wc.debugger.isAttached()) wc.debugger.attach("1.3");
    await wc.debugger.sendCommand("Emulation.setDeviceMetricsOverride", {
      width: W, height: H, deviceScaleFactor: SCALE, mobile: false,
    });
  }

  // Fonts loaded, then the page's text stops changing (data has arrived and rendered).
  async function settle() {
    await wc.executeJavaScript("document.fonts.ready.then(() => true)");
    const probe = "document.body ? document.body.innerText.length + ':' + document.querySelectorAll('img,svg').length : ''";
    let prev = "";
    let stable = 0;
    const end = Date.now() + 10000;
    while (Date.now() < end && stable < 3) {
      const now = await wc.executeJavaScript(probe);
      stable = now === prev ? stable + 1 : 0;
      prev = now;
      await sleep(300);
    }
    await wc.executeJavaScript("document.fonts.ready.then(() => true)");
    await sleep(400);
  }

  const dbg = (m) => { if (process.env.SHOTS_DEBUG) console.error("[shots]", Date.now() % 100000, m); };
  async function shoot(route, theme, file) {
    label = `${route} (${theme})`;
    try {
      dbg('start');
      nativeTheme.themeSource = theme;
      await win.loadURL("about:blank");
      // localStorage is per origin, so set the theme from a same-origin page before the real load.
      await emulate();
      await win.loadURL(`${ORIGIN}/api/projects`);
      await wc.executeJavaScript(`localStorage.setItem(${JSON.stringify(THEME_KEY)}, ${JSON.stringify(theme)})`);
      await win.loadURL(ORIGIN + route);
      await wc.insertCSS("nextjs-portal{display:none!important}"); // Next dev indicator, if any
      dbg('loaded');
      await settle();
      dbg('settled');
      dbg('capturing');
      const { data } = await Promise.race([
        wc.debugger.sendCommand("Page.captureScreenshot", { format: "png", fromSurface: true }),
        sleep(20000).then(() => { throw new Error("capture timed out"); }),
      ]);
      const buf = Buffer.from(data, "base64");
      if (buf.length < 1000) throw new Error("empty capture");
      fs.writeFileSync(file, buf);
      result.files.push({ file, bytes: buf.length, width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) });
    } catch (e) {
      result.failed.push(`${label}: ${e.message}`);
    }
  }

  async function main() {
    for (const t of THEMES) if (t !== "light" && t !== "dark") throw new Error(`unknown theme "${t}" (use light or dark)`);
    await waitForServer();
    win = new BrowserWindow({ show: false, width: W, height: H, useContentSize: true, webPreferences: { offscreen: true } });
    wc = win.webContents;
    wire();
    fs.mkdirSync(OUT, { recursive: true });
    const routes = [];
    for (const r of ROUTES) {
      if (r === "/projects/first") {
        const id = await firstProjectId();
        if (id) routes.push(`/projects/${id}`);
        else result.failed.push("project: /api/projects returned no projects");
      } else routes.push(r);
    }
    for (const route of routes)
      for (const theme of THEMES) await shoot(route, theme, path.join(OUT, `${slugOf(route)}-${theme}.png`));
  }

  app.whenReady().then(async () => {
    let code = 0;
    try {
      await main();
      if (result.failed.length) code = 1;
    } catch (e) {
      console.error(e.message);
      result.failed.push(e.message);
      code = 1;
    }
    console.log(JSON.stringify(result));
    app.quit();
    setTimeout(() => process.exit(code), 500);
  });
}
