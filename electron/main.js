// Electron wrapper: runs the Next.js server as a child process (using
// Electron's own bundled Node via ELECTRON_RUN_AS_NODE, so end users don't
// need Node.js installed) and shows it in a native window. Always forces the
// offline PGlite path — see the explicit database directory below.
const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  shell,
  screen,
  ipcMain,
  Tray,
  nativeImage,
  Notification,
  globalShortcut,
  powerMonitor,
} = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");
const os = require("node:os");
const net = require("node:net");
const fs = require("node:fs");
const http = require("node:http");
const crypto = require("node:crypto");
const { createServerLifecycle } = require("./server-lifecycle");
const { createReminderSchedule } = require("./reminder-schedule");
const { createNudgeCounter, nudgeMessage } = require("./nudge");
const { createAwayWatcher, awayPromptText } = require("./away-watcher");
const { scanClaudeSessions, createWaitTracker, waitingNotification, PROJECTS_SUBPATH } = require("./claude-sessions");
const { createUpdateChecker } = require("./update-check");
const { migrateLegacyUserData, legacyAppRunning } = require("./user-data-migration");

app.setName("Doem");

// PGlite has no real cross-process lock (postmaster.pid holds its own
// placeholder PID, not a usable advisory lock), so two Doem processes
// pointed at the same PGLITE_DIR silently corrupt it rather than refusing to
// start — this is the single biggest risk in the whole app. Refuse to be
// the second instance; hand off to the one already running instead.
if (!app.requestSingleInstanceLock()) {
  // app.quit() is async and this file runs top-to-bottom rather than inside
  // an else-branch, so without an immediate exit the rest of it — spawning
  // a second server against the same PGLITE_DIR — would run anyway before
  // quit takes effect.
  app.quit();
  process.exit(0);
}
// activateOrCreateWindow is a hoisted function declaration defined further
// down, so this is safe even though it's referenced before that point.
app.on("second-instance", () => activateOrCreateWindow());

const isDev = !app.isPackaged;
// Packaged builds take the icon from the bundle (build/icon.icns); an
// unpackaged `electron .` run would otherwise show the default Electron logo.
const iconPath = path.join(__dirname, "..", "build", "icon.png");
// electron-builder (with asar disabled) unpacks app files to resources/app.
const projectRoot = isDev ? path.join(__dirname, "..") : path.join(process.resourcesPath, "app");

// Always the literal IPv4 loopback, never "localhost": Next binds IPv4 only,
// while Chromium resolves "localhost" to ::1 first — which is why the window
// showed "This page couldn't load" against a server that was up and healthy.
// It also keeps the server off the local network.
const HOST = "127.0.0.1";

let serverProcess = null;
let mainWindow = null;
let quitting = false;
// Held at module scope on purpose — a Tray with no other reference is
// garbage-collected and silently disappears from the menu bar.
let tray = null;
let trayTickInterval = null;
let trayPollInterval = null;
let trayTimerStatus = null; // { label, startedAtMs } | null
let toggleTimerMenuItem = null;
// The quick-capture bar. Never the "main window": activate, the tray click and
// window-all-closed keep acting on mainWindow only.
let captureWindow = null;
let mainLoaded = false;
const pendingCommands = [];

// Shown immediately on window creation, before the local server is even
// spawned, so the app doesn't sit on a blank white window for however long
// waitForServer() takes to resolve.
// Respects the OS colour scheme via a media query in the inline CSS (rather
// than nativeTheme.shouldUseDarkColors) so the splash never has to be
// re-rendered if the OS theme changes between launches — the same query the
// app's own dark palette uses in app/globals.css.
const SPLASH_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
html, body { margin: 0; height: 100%; }
body { display: flex; align-items: center; justify-content: center; background: #f6f6f3; }
.mark { width: 56px; height: 56px; }
.tile { fill: #141519; }
.glyph { fill: #f6f6f3; }
@media (prefers-color-scheme: dark) {
  body { background: #121318; }
  .tile { fill: #ededef; }
  .glyph { fill: #121318; }
}
</style></head><body><svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><rect class="tile" width="32" height="32" rx="10"/><path class="glyph" transform="translate(5.9 5.6) scale(0.1)" d="M 150 22 C 150 10 158 4 172 4 C 186 4 194 10 194 22 L 194 126 C 194 176 165 204 118 204 L 28 204 C 16 204 10 197 10 186 C 10 175 17 168 28 168 L 110 168 C 139 168 153 151 153 133 C 153 114 137 98 110 98 L 30 98 C 18 98 12 91 12 80 C 12 69 19 62 30 62 L 125 62 C 135 62 143 64 150 69 Z M 27 114 L 102 114 C 114 114 121 121 121 131 C 121 141 114 148 102 148 L 27 148 C 15 148 8 141 8 131 C 8 121 15 114 27 114 Z"/></svg></body></html>`;
const SPLASH_URL = `data:text/html;charset=utf-8,${encodeURIComponent(SPLASH_HTML)}`;

// The app was DayPlan, then Tempo, now Doem, and the userData path is derived
// from the app name, so an existing install's data sits under an earlier
// name. Move it across once (DayPlan -> Tempo -> Doem; see
// user-data-migration.js).
//
// This runs at load rather than inside userDataDir(). In practice the Doem
// folder always exists by now (requestSingleInstanceLock above creates its
// lock files there), so the module's second branch is the one that runs: it
// moves the database, settings and localStorage into unclaimed slots.
//
// Our single-instance lock lives in the Doem folder and cannot see a running
// Tempo. Moving the database out from under it would leave two PGlite writers
// on one directory, so refuse to start until the old app is quit.
const runningLegacyApp = legacyAppRunning(app.getPath("userData"));
if (runningLegacyApp) {
  dialog.showErrorBox(
    `Quit ${runningLegacyApp} first`,
    `${runningLegacyApp} is still open and using your data. Quit it (also from its menu bar icon), then open Doem again. Your tasks move across on that launch.`,
  );
  app.exit(0);
  process.exit(0);
}
const migratedUserData = migrateLegacyUserData(app.getPath("userData"));

/**
 * ~/Library/Application Support/Doem on macOS. Chromium only creates this
 * lazily, so anything of ours that writes there has to make it first.
 */
function userDataDir() {
  const dir = app.getPath("userData");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * The desktop build gets no `.env` files — it ships as a bundle, and the
 * explicit local PGlite directory makes its data independent of a developer
 * checkout. Calendar integration still needs real values, so
 * they live in a JSON file in userData that the user (or the app) can write.
 *
 * `calendarFeedSecret` is generated on first run so subscribing from Apple
 * Calendar works out of the box; the iCloud fields start empty and stay
 * inert until filled in, exactly like the unset env vars they stand in for.
 */
function settingsFile() {
  return path.join(userDataDir(), "settings.json");
}

/**
 * Writes via a temp file + rename so a crash or force-quit mid-write can
 * never leave settings.json half-written — a torn write here would look
 * like a corrupt file on next launch and silently regenerate the calendar
 * feed secret, killing every existing Apple Calendar subscription.
 */
function writeSettingsFile(file, data) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data, { mode: 0o600 });
  fs.renameSync(tmp, file);
}

function readDesktopSettings() {
  const file = settingsFile();
  let settings = {};
  try {
    if (fs.existsSync(file)) settings = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    // A hand-edited file with a syntax error must not stop the app booting —
    // fall through and rewrite it with defaults below.
    settings = {};
  }
  if (typeof settings !== "object" || settings === null) settings = {};

  const defaults = {
    calendarFeedSecret: crypto.randomBytes(32).toString("base64url"),
    icloudAppleId: "",
    icloudAppPassword: "",
    windowBounds: null,
    captureShortcut: "Control+Alt+Space",
  };
  const merged = { ...defaults, ...settings };
  // Only rewrite when something actually changed, so an untouched file keeps
  // its mtime (and any comments-by-key ordering the user gave it).
  if (JSON.stringify(merged) !== JSON.stringify(settings)) {
    try {
      writeSettingsFile(file, `${JSON.stringify(merged, null, 2)}\n`);
    } catch (err) {
      logLine(`[doem] could not write ${file}: ${err.message}`);
    }
  }
  return merged;
}

/**
 * Merges `patch` into the settings file, reusing readDesktopSettings()'s
 * defaults-merge and 0o600 contract rather than writing raw JSON here.
 */
function writeDesktopSettings(patch) {
  const file = settingsFile();
  const current = readDesktopSettings();
  const merged = { ...current, ...patch };
  if (JSON.stringify(merged) === JSON.stringify(current)) return;
  try {
    writeSettingsFile(file, `${JSON.stringify(merged, null, 2)}\n`);
  } catch (err) {
    logLine(`[doem] could not write ${file}: ${err.message}`);
  }
}

/**
 * A hand-edited settings.json can be syntactically valid JSON but carry a
 * nonsense windowBounds (wrong type, truncated object, negative size) —
 * screen.getDisplayMatching throws on that, which used to reject
 * createWindow() and quit the app on every subsequent launch. Anything that
 * doesn't look like a real rect is treated as "no saved bounds" instead.
 */
function isValidBounds(bounds) {
  return (
    bounds &&
    typeof bounds === "object" &&
    Number.isFinite(bounds.x) &&
    Number.isFinite(bounds.y) &&
    Number.isFinite(bounds.width) &&
    Number.isFinite(bounds.height) &&
    bounds.width > 0 &&
    bounds.height > 0
  );
}

/**
 * screen.getDisplayMatching always returns a real, currently-connected
 * display (falling back to the nearest one when the given rect doesn't
 * intersect any), so this both handles "saved on a monitor that's since been
 * unplugged" and simple resolution changes in one pass.
 */
function clampBoundsToDisplay(bounds) {
  const { workArea } = screen.getDisplayMatching(bounds);
  const width = Math.min(bounds.width, workArea.width);
  const height = Math.min(bounds.height, workArea.height);
  const x = Math.min(Math.max(bounds.x, workArea.x), workArea.x + workArea.width - width);
  const y = Math.min(Math.max(bounds.y, workArea.y), workArea.y + workArea.height - height);
  return { x, y, width, height };
}

function logFile() {
  return path.join(userDataDir(), "doem.log");
}

function logLine(text) {
  process.stdout.write(text);
  try {
    fs.appendFileSync(logFile(), text.endsWith("\n") ? text : `${text}\n`);
  } catch {
    // Logging must never take the app down.
  }
}

/**
 * The feed URL Apple Calendar stores has the port in it, and Apple re-polls
 * that exact URL for the life of the subscription — so an ephemeral port meant
 * every subscription died at the next launch. Claim a fixed port instead, with
 * a couple of neighbours as fallback for the rare case something else holds it
 * (a stale Doem mid-shutdown, mostly). Only if all of them are taken do we
 * fall back to a random port, which still runs the app — the subscription is
 * what breaks, not the window.
 */
const PREFERRED_PORTS = [39847, 39848, 39849];

function tryPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => resolve(null));
    server.listen(port, HOST, () => {
      const actual = server.address().port;
      server.close(() => resolve(actual));
    });
  });
}

async function getFreePort() {
  for (const candidate of PREFERRED_PORTS) {
    const port = await tryPort(candidate);
    if (port) return port;
  }
  logLine(`[doem] ports ${PREFERRED_PORTS.join(", ")} are all in use; falling back to a random one — an existing calendar subscription will not reach this session`);
  // Port 0 asks the OS for anything free, and never fails the way a fixed
  // port can, so this resolves or the app had bigger problems.
  return tryPort(0);
}

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  let timer = null;
  let reject;
  const promise = new Promise((res, rej) => {
    reject = rej;
    const attempt = () => {
      const req = http.get(url, (response) => {
        response.resume();
        res();
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          rej(new Error("Timed out waiting for the local server to start"));
          return;
        }
        timer = setTimeout(attempt, 300);
      });
    };
    attempt();
  });
  // Lets startServer's exit/error handlers cut this short instead of
  // leaving the splash on screen for the rest of the 30s timeout.
  promise.cancel = (err) => {
    if (timer) clearTimeout(timer);
    reject(err);
  };
  return promise;
}

// Set while a createWindow() call is between spawning the server and the
// window finishing its load, so a server death in that window can reject the
// in-flight waitForServer() instead of leaving it to time out 30s later and
// then show a second, redundant dialog on top of the crash one.
let pendingServerStartup = null;

function failStartup(err) {
  if (pendingServerStartup) {
    pendingServerStartup.cancel(err);
    pendingServerStartup = null;
  } else {
    showStartupError(err.message);
  }
}

const serverLifecycle = createServerLifecycle(async () => {
  const port = await getFreePort();
  startServer(port);
  const url = `http://${HOST}:${port}`;
  const wait = waitForServer(url);
  pendingServerStartup = wait;
  try {
    await wait;
    return url;
  } finally {
    if (pendingServerStartup === wait) pendingServerStartup = null;
  }
});

function startServer(port) {
  logLine(`[doem] starting server on port ${port} from ${projectRoot}`);
  const settings = readDesktopSettings();
  const nextBin = require.resolve("next/dist/bin/next", { paths: [projectRoot] });

  serverProcess = spawn(
    process.execPath,
    [
      // See electron/child-bootstrap.js: stops the child from taking its own
      // Dock tile.
      "--require",
      path.join(__dirname, "child-bootstrap.js"),
      nextBin,
      isDev ? "dev" : "start",
      "-H",
      HOST,
      "-p",
      String(port),
    ],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        NODE_ENV: isDev ? "development" : "production",
        PORT: String(port),
        HOSTNAME: HOST,
        // The local database path is explicit, so the app never depends on
        // a developer checkout's environment configuration.
        // ...except the calendar values, which come from settings.json in
        // userData (see readDesktopSettings) rather than any ambient .env.
        CALENDAR_FEED_SECRET: settings.calendarFeedSecret || "",
        ICLOUD_APPLE_ID: settings.icloudAppleId || "",
        ICLOUD_APP_PASSWORD: settings.icloudAppPassword || "",
        PGLITE_DIR: path.join(userDataDir(), "pglite"),
      },
      // A GUI launch has nowhere to inherit stdout to, so the server's output
      // (including the reason it died) used to vanish. Tee it to a log file
      // next to the database instead.
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  serverProcess.stdout.on("data", (chunk) => logLine(chunk.toString()));
  serverProcess.stderr.on("data", (chunk) => logLine(chunk.toString()));

  serverProcess.on("error", (err) => {
    serverProcess = null;
    serverLifecycle.reset();
    failStartup(new Error(`Could not start the local server: ${err.message}`));
  });

  serverProcess.on("exit", (code) => {
    serverProcess = null;
    serverLifecycle.reset();
    // A null code means we killed it ourselves on quit.
    if (code !== null && code !== 0) {
      failStartup(new Error(`The local server exited with code ${code}.`));
    }
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  serverLifecycle.reset();
}

/**
 * A dead server used to surface as Chromium's blank "This page couldn't load"
 * screen, which says nothing about what actually broke. Show the reason
 * instead, in the window if there is one and in a dialog if there isn't.
 */
function showStartupError(message) {
  logLine(`[doem] ${message}`);
  if (quitting) return;
  dialog.showErrorBox("Doem couldn't start", `${message}\n\nDetails: ${logFile()}`);
}

/**
 * Renderer commands travel over one fixed channel as a tagged object —
 * never a caller-supplied channel name — so DesktopBridge on the other end
 * has a single, typed onCommand subscription to maintain.
 */
function sendCommand(command) {
  mainWindow?.webContents.send("doem:command", command);
}

/**
 * The iCloud credentials have no in-app editor, so give the settings file a
 * way to be opened that doesn't involve knowing the userData path. Built on
 * top of the default menu rather than replacing it — the standard Edit/Window
 * items (copy, paste, minimise) are load-bearing on macOS. View and Task are
 * app-specific menus rather than everything living under File — that's a
 * large part of what makes the menu bar read as a native app's, not a
 * website's.
 */
let availableUpdate = null;
function openUpdatePage() {
  if (availableUpdate) shell.openExternal(availableUpdate.url);
}

function showUpdateInMenu(version, url) {
  availableUpdate = { version, url };
  const item = Menu.getApplicationMenu()?.getMenuItemById("update-available");
  if (item) {
    item.label = `Update to ${version}…`;
    item.visible = true;
  }
}

function startUpdateCheck() {
  if (isDev || process.env.DOEM_NO_UPDATE_CHECK === "1") return;
  createUpdateChecker({
    currentVersion: app.getVersion(),
    fetch: globalThis.fetch,
    now: Date.now,
    readSettings: readDesktopSettings,
    writeSettings: writeDesktopSettings,
    log: logLine,
    setMenuUpdate: showUpdateInMenu,
    notify: (version) => {
      if (!Notification.isSupported()) return;
      const n = new Notification({ title: `Doem ${version} is available`, body: "Click to open the release page.", icon: iconPath });
      liveNotifications.add(n);
      n.on("click", openUpdatePage);
      n.on("close", () => liveNotifications.delete(n));
      n.show();
    },
  }).start();
}

function installMenu() {
  const template = [
    ...(process.platform === "darwin" ? [{ role: "appMenu" }] : []),
    {
      role: "fileMenu",
      submenu: [
        {
          label: "Calendar Integration Settings…",
          click: async () => {
            readDesktopSettings();
            await shell.openPath(settingsFile());
          },
        },
        { id: "update-available", label: "Update…", visible: false, click: () => openUpdatePage() },
        { type: "separator" },
        { role: process.platform === "darwin" ? "close" : "quit" },
      ],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { label: "Search", accelerator: "CmdOrCtrl+F", click: () => sendCommand({ type: "focus-search" }) },
        { type: "separator" },
        { label: "Inbox", accelerator: "CmdOrCtrl+0", click: () => sendCommand({ type: "navigate", path: "/inbox" }) },
        { label: "Today", accelerator: "CmdOrCtrl+1", click: () => sendCommand({ type: "navigate", path: "/" }) },
        { label: "Calendar", accelerator: "CmdOrCtrl+2", click: () => sendCommand({ type: "navigate", path: "/calendar" }) },
        { label: "Tracking", accelerator: "CmdOrCtrl+3", click: () => sendCommand({ type: "navigate", path: "/tracking" }) },
        { label: "Next 7 Days", accelerator: "CmdOrCtrl+4", click: () => sendCommand({ type: "navigate", path: "/upcoming" }) },
        { label: "All Tasks", accelerator: "CmdOrCtrl+5", click: () => sendCommand({ type: "navigate", path: "/all" }) },
        { label: "Wrap Up the Day", accelerator: "CmdOrCtrl+Shift+E", click: () => sendCommand({ type: "navigate", path: "/wrap" }) },
        { type: "separator" },
        { label: "Settings…", accelerator: "CmdOrCtrl+,", click: () => sendCommand({ type: "navigate", path: "/settings" }) },
      ],
    },
    {
      label: "Task",
      submenu: [
        { label: "New Task", accelerator: "CmdOrCtrl+N", click: () => sendCommand({ type: "new-task" }) },
        { type: "separator" },
        {
          id: "toggle-timer",
          label: "Start/Stop Timer",
          accelerator: "CmdOrCtrl+Shift+T",
          // Disabled until the renderer reports a running timer or an open
          // task to act on — otherwise this fires with nothing to toggle
          // and gives the user no indication anything happened.
          enabled: false,
          click: () => sendCommand({ type: "toggle-timer" }),
        },
      ],
    },
    { role: "windowMenu" },
  ];
  const menu = Menu.buildFromTemplate(template);
  toggleTimerMenuItem = menu.getMenuItemById("toggle-timer");
  Menu.setApplicationMenu(menu);
}

/**
 * Cheapest native win after the titlebar: a right-click in a text field gets
 * Cut/Copy/Paste, a right-click on selected text gets Copy — instead of
 * Chromium's built-in menu (or nothing at all).
 */
function installContextMenu() {
  app.on("web-contents-created", (_event, contents) => {
    contents.on("context-menu", (_e, params) => {
      const items = [];
      if (params.isEditable) {
        items.push({ role: "cut", enabled: params.editFlags.canCut });
        items.push({ role: "copy", enabled: params.editFlags.canCopy });
        items.push({ role: "paste", enabled: params.editFlags.canPaste });
      } else if (params.selectionText) {
        items.push({ role: "copy" });
      }
      if (items.length === 0) return;
      Menu.buildFromTemplate(items).popup();
    });
  });
}

// Tray ----------------------------------------------------------------------
//
// The menu bar item is Doem's tracking remote: what is being timed and for how
// long, one click to stop it, one click to start an activity or one of today's
// tasks. Quick add has its own global shortcut, so it is one row here, not the
// point. The tray reads and writes the local API itself instead of asking the
// window, so it works with the window closed and never brings it forward.

/** "12:34" under an hour, "1:02:34" past it. */
function formatTrayElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "3h 20m", "45m", "0m". */
function formatTrayDuration(minutes) {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  if (h === 0) return `${m}m`;
  return m % 60 === 0 ? `${h}h` : `${h}h ${m % 60}m`;
}

// A raw task title can run to a full sentence, and the menu bar has no
// wrapping — left unbounded it pushes Doem's own View/Task menus off the
// right edge of the screen on a 13" display.
const TRAY_LABEL_MAX = 24;
// Menu rows have more room than the bar, but a paragraph-long title still
// makes the whole menu as wide as the screen.
const TRAY_MENU_LABEL_MAX = 48;
const TRAY_TASKS_MAX = 8;
const TRAY_ACTIVITIES_MAX = 8;
const TRAY_RECENT_MAX = 5;

function truncateTrayLabel(label, max = TRAY_LABEL_MAX) {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

function updateTrayTitle() {
  if (!tray) return;
  if (!trayTimerStatus) {
    tray.setTitle("");
    return;
  }
  const elapsed = formatTrayElapsed(Date.now() - trayTimerStatus.startedAtMs);
  tray.setTitle(` ${truncateTrayLabel(trayTimerStatus.label)} · ${elapsed}`, { fontType: "monospacedDigit" });
}

function localISODate(d = new Date()) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function localTimeLabel(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** Last good read of the workspace; the menu falls back to it if a read fails. */
let trayData = null;
let trayRefreshing = null;
let trayRefreshTimer = null;

async function trayApi(pathname, init) {
  // Never the one to spawn the server: after a crash, a background read
  // restarting it every minute would loop the startup-error dialog.
  if (!serverProcess) throw new Error("server not running");
  const base = await serverLifecycle.getUrl();
  const res = await fetch(`${base}${pathname}`, {
    ...init,
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${pathname} failed (${res.status})`);
  return res.json();
}

function segmentLabel(segment, data) {
  if (segment.taskId) {
    const task = data.tasksById.get(segment.taskId);
    if (task) return task.title;
  }
  if (segment.activityId) {
    const activity = data.activitiesById.get(segment.activityId);
    if (activity) return activity.name;
  }
  return data.categoriesById.get(segment.categoryId)?.name ?? "Tracking";
}

async function loadTrayData() {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [tasks, categories, activities, segs] = await Promise.all([
    trayApi("/api/tasks"),
    trayApi("/api/categories"),
    trayApi("/api/activities"),
    trayApi(
      `/api/segments?from=${encodeURIComponent(midnight.toISOString())}&to=${encodeURIComponent(now.toISOString())}`,
    ),
  ]);
  const data = {
    tasksById: new Map(tasks.map((t) => [t.id, t])),
    categoriesById: new Map(categories.map((c) => [c.id, c])),
    activitiesById: new Map(activities.map((a) => [a.id, a])),
    running: segs.running,
    todayMinutes: 0,
    todayTasks: [],
    recentTasks: [],
    pinnedActivities: [],
    categories: categories.filter((c) => !c.archived).sort((a, b) => a.sortOrder - b.sortOrder),
    activitiesByCategory: new Map(),
  };

  // Only the part of each segment that falls inside today counts.
  const nowMs = now.getTime();
  for (const s of segs.segments) {
    const from = Math.max(new Date(s.startedAt).getTime(), midnight.getTime());
    const to = s.endedAt ? new Date(s.endedAt).getTime() : nowMs;
    if (to > from) data.todayMinutes += (to - from) / 60_000;
  }
  if (segs.running && !segs.segments.some((s) => s.id === segs.running.id)) {
    data.todayMinutes += Math.max(0, nowMs - Math.max(new Date(segs.running.startedAt).getTime(), midnight.getTime())) / 60_000;
  }

  const today = localISODate(now);
  const open = (t) => t.status === "open" && !t.deletedAt && (!t.startOn || t.startOn <= today);
  data.todayTasks = tasks
    .filter((t) => open(t) && ((t.scheduled && t.scheduled <= today) || t.committedOn === today))
    .sort(
      (a, b) =>
        Number(b.committedOn === today) - Number(a.committedOn === today) ||
        b.priority - a.priority ||
        (a.scheduled ?? "").localeCompare(b.scheduled ?? "") ||
        a.sortOrder - b.sortOrder,
    );

  // Tasks timed earlier today that aren't on today's list (inbox, another
  // day's task picked up early): newest first, one row each.
  const listed = new Set(data.todayTasks.map((t) => t.id));
  const seen = new Set();
  for (const s of [...segs.segments].sort((a, b) => b.startedAt.localeCompare(a.startedAt))) {
    if (!s.taskId || listed.has(s.taskId) || seen.has(s.taskId)) continue;
    const task = data.tasksById.get(s.taskId);
    if (!task || !open(task)) continue;
    seen.add(s.taskId);
    data.recentTasks.push(task);
    if (data.recentTasks.length >= TRAY_RECENT_MAX) break;
  }

  const liveCategory = new Map(data.categories.map((c, i) => [c.id, i]));
  const liveActivities = activities
    .filter((a) => !a.archived && liveCategory.has(a.categoryId))
    .sort((a, b) => liveCategory.get(a.categoryId) - liveCategory.get(b.categoryId) || a.sortOrder - b.sortOrder);
  data.pinnedActivities = liveActivities.filter((a) => a.pinned).slice(0, TRAY_ACTIVITIES_MAX);
  for (const a of liveActivities) {
    if (!data.activitiesByCategory.has(a.categoryId)) data.activitiesByCategory.set(a.categoryId, []);
    data.activitiesByCategory.get(a.categoryId).push(a);
  }
  return data;
}

/** One read in flight at a time; every caller gets that read's result. */
function refreshTray() {
  if (quitting) return Promise.resolve(trayData);
  if (!trayRefreshing) {
    trayRefreshing = loadTrayData()
      .then((data) => {
        trayData = data;
        trayTimerStatus = data.running
          ? { label: segmentLabel(data.running, data), startedAtMs: new Date(data.running.startedAt).getTime() }
          : null;
        updateTrayTitle();
        return data;
      })
      .catch((err) => {
        logLine(`[doem] tray refresh failed: ${err.message}`);
        return trayData;
      })
      .finally(() => {
        trayRefreshing = null;
      });
  }
  return trayRefreshing;
}

/** The window reports every start/stop/switch; coalesce bursts into one read. */
function scheduleTrayRefresh() {
  if (trayRefreshTimer) clearTimeout(trayRefreshTimer);
  trayRefreshTimer = setTimeout(() => {
    trayRefreshTimer = null;
    refreshTray();
  }, 150);
}

async function trayTrack(body) {
  try {
    if (body) await trayApi("/api/segments", { method: "POST", body: JSON.stringify({ ...body, replaceRunning: true }) });
    else await trayApi("/api/segments/stop", { method: "POST" });
  } catch (err) {
    logLine(`[doem] tray tracking failed: ${err.message}`);
    if (Notification.isSupported()) {
      new Notification({ title: "Doem couldn't change the timer", body: "Open Doem and try again there.", icon: iconPath }).show();
    }
  }
  await refreshTray();
  // The window keeps its own copy of the running timer; tell it to re-read.
  if (mainWindow && mainLoaded) sendCommand({ type: "tracking-changed" });
}

// Section headers are a macOS 14 menu item; earlier systems get a plain
// greyed-out row in the same place.
const TRAY_HEADERS = parseInt(process.getSystemVersion(), 10) >= 14;

function trayHeader(label) {
  return TRAY_HEADERS ? { type: "header", label } : { label, enabled: false };
}

function buildTrayMenu(data) {
  const items = [];
  if (!data) {
    items.push({ label: "Doem is starting…", enabled: false });
  } else {
    const running = data.running;
    if (running) {
      const category = data.categoriesById.get(running.categoryId)?.name;
      const label = segmentLabel(running, data);
      const elapsed = formatTrayDuration((Date.now() - new Date(running.startedAt).getTime()) / 60_000);
      items.push({ label: truncateTrayLabel(label, TRAY_MENU_LABEL_MAX), enabled: false });
      items.push({
        label: [category && category !== label ? category : null, `since ${localTimeLabel(running.startedAt)}`, elapsed]
          .filter(Boolean)
          .join(" · "),
        enabled: false,
      });
      items.push({ label: "Stop Tracking", click: () => trayTrack(null) });
    } else {
      items.push({ label: "Not tracking", enabled: false });
    }
    items.push({ label: `Today: ${formatTrayDuration(data.todayMinutes)} tracked`, enabled: false });

    const isRunning = (match) => Boolean(running && match(running));
    const taskItem = (task) => ({
      label: truncateTrayLabel(task.title, TRAY_MENU_LABEL_MAX),
      type: "checkbox",
      checked: isRunning((r) => r.taskId === task.id),
      click: () => (isRunning((r) => r.taskId === task.id) ? undefined : trayTrack({ taskId: task.id })),
    });
    const activityItem = (activity) => ({
      label: truncateTrayLabel(activity.name, TRAY_MENU_LABEL_MAX),
      type: "checkbox",
      checked: isRunning((r) => !r.taskId && r.activityId === activity.id),
      click: () =>
        isRunning((r) => !r.taskId && r.activityId === activity.id)
          ? undefined
          : trayTrack({ categoryId: activity.categoryId, activityId: activity.id }),
    });

    if (data.categories.length > 0) {
      items.push({ type: "separator" }, trayHeader("Activities"));
      for (const a of data.pinnedActivities) items.push(activityItem(a));
      items.push({
        label: data.pinnedActivities.length > 0 ? "More Activities" : "Start an Activity",
        submenu: data.categories.map((c) => {
          const acts = data.activitiesByCategory.get(c.id) ?? [];
          const justCategory = {
            label: c.name,
            type: "checkbox",
            checked: isRunning((r) => !r.taskId && !r.activityId && r.categoryId === c.id),
            click: () => trayTrack({ categoryId: c.id }),
          };
          if (acts.length === 0) return justCategory;
          return { label: c.name, submenu: [justCategory, { type: "separator" }, ...acts.map(activityItem)] };
        }),
      });
    }

    items.push({ type: "separator" }, trayHeader("Today’s Tasks"));
    if (data.todayTasks.length === 0) {
      items.push({ label: "Nothing scheduled today", enabled: false });
    } else {
      for (const t of data.todayTasks.slice(0, TRAY_TASKS_MAX)) items.push(taskItem(t));
      if (data.todayTasks.length > TRAY_TASKS_MAX) {
        items.push({
          label: `${data.todayTasks.length - TRAY_TASKS_MAX} More`,
          submenu: data.todayTasks.slice(TRAY_TASKS_MAX).map(taskItem),
        });
      }
    }
    if (data.recentTasks.length > 0) {
      items.push({ type: "separator" }, trayHeader("Tracked Earlier Today"));
      for (const t of data.recentTasks) items.push(taskItem(t));
    }
  }

  items.push(
    { type: "separator" },
    {
      label: "Quick Add Task…",
      accelerator: captureStatus.registered ? captureStatus.shortcut : undefined,
      registerAccelerator: false,
      click: () => toggleCaptureWindow(true),
    },
    {
      label: "Open Tracking",
      click: () => {
        activateOrCreateWindow();
        sendCommandReliably({ type: "navigate", path: "/tracking" });
      },
    },
    { label: "Open Doem", click: () => activateOrCreateWindow() },
    { type: "separator" },
    { label: "Quit Doem", role: "quit" },
  );
  return Menu.buildFromTemplate(items);
}

let trayMenuOpening = false;

async function openTrayMenu() {
  if (!tray || trayMenuOpening) return;
  trayMenuOpening = true;
  try {
    // A local read is a few milliseconds; don't hold the click hostage to a
    // server that is still starting — show what we have.
    const data = await Promise.race([refreshTray(), new Promise((r) => setTimeout(() => r(trayData), 400))]);
    tray.popUpContextMenu(buildTrayMenu(data));
  } finally {
    trayMenuOpening = false;
  }
}

function createTray() {
  if (process.platform !== "darwin") return;
  // Monochrome template mark (black + alpha). Electron picks up the @2x file
  // beside it by name, and macOS tints a template image white in a dark
  // menu bar.
  const trayImage = nativeImage.createFromPath(path.join(__dirname, "..", "build", "trayTemplate.png"));
  trayImage.setTemplateImage(true);
  tray = new Tray(trayImage);
  tray.setToolTip("Doem");
  // No permanent setContextMenu: the menu is rebuilt on every open so the
  // running timer, today's total and the task list are current. Either click
  // opens it, like every other menu bar timer.
  tray.on("click", () => openTrayMenu());
  tray.on("right-click", () => openTrayMenu());
  trayTickInterval = setInterval(updateTrayTitle, 1000);
  // The window reports its own starts and stops; this catches the rest (a
  // window that is closed, the day rolling over).
  trayPollInterval = setInterval(refreshTray, 60 * 1000);
  refreshTray();
}

ipcMain.on("doem:set-badge", (_event, count) => {
  if (process.platform !== "darwin" || !app.dock) return;
  app.dock.setBadge(count > 0 ? String(count) : "");
});

// The window says something started, stopped or switched. The tray re-reads
// the running segment itself rather than trusting the payload, so activity
// tracking (no task) shows in the menu bar too.
ipcMain.on("doem:timer-status", () => {
  scheduleTrayRefresh();
});

ipcMain.on("doem:can-toggle-timer", (_event, canToggle) => {
  if (toggleTimerMenuItem) toggleTimerMenuItem.enabled = Boolean(canToggle);
});

ipcMain.on("doem:notify", (_event, title, options) => {
  if (!Notification.isSupported()) return;
  new Notification({ title, body: options?.body, icon: iconPath }).show();
});

// Focus countdown finished: one notification and one Dock bounce.
// "informational" bounces the Dock icon a single time; no loops or timers.
ipcMain.on("doem:attention", (_event, payload) => {
  if (!payload || typeof payload !== "object") return;
  const { title, body } = payload;
  if (typeof title !== "string" || title.length === 0) return;
  const safeTitle = title.slice(0, 120);
  const safeBody = typeof body === "string" ? body.slice(0, 300) : undefined;
  if (Notification.isSupported()) {
    new Notification({ title: safeTitle, body: safeBody, icon: iconPath }).show();
  }
  if (process.platform === "darwin" && app.dock) {
    app.dock.bounce("informational");
  }
});

async function createWindow() {
  const settings = readDesktopSettings();
  const restoredBounds = isValidBounds(settings.windowBounds)
    ? clampBoundsToDisplay(settings.windowBounds)
    : null;

  mainWindow = new BrowserWindow({
    ...(restoredBounds ?? { width: 1280, height: 860 }),
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: "Doem",
    icon: iconPath,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 20 },
    vibrancy: "sidebar",
    visualEffectState: "followWindow",
    // The vibrancy material needs to show through, so the window itself must
    // not paint an opaque background behind the page — the opaque paint
    // moves onto the content pane in CSS instead.
    backgroundColor: "#00000000",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  // The preload bridge (window.doem) is attached to this window, not to an
  // origin — anything that navigated the window itself off-origin would
  // carry that bridge to a remote page. Nothing renders an external link
  // today, but this closes the door before something does.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
    if (!targetUrl.startsWith(`http://${HOST}:`)) {
      event.preventDefault();
      shell.openExternal(targetUrl);
    }
  });

  mainWindow.on("close", () => {
    if (!mainWindow || mainWindow.isFullScreen() || mainWindow.isMinimized()) return;
    // Synchronous write on purpose: this runs during window teardown, and an
    // async write here could get torn down mid-write by app quit.
    writeDesktopSettings({ windowBounds: mainWindow.getBounds() });
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
    mainLoaded = false;
    // Off macOS the app quits with its last window; a hidden capture bar
    // must not keep it alive.
    if (process.platform !== "darwin" && captureWindow && !captureWindow.isDestroyed()) {
      captureWindow.destroy();
    }
  });

  // Shows the window immediately with a branded placeholder rather than
  // leaving it blank for however long the server takes to come up.
  await mainWindow.loadURL(SPLASH_URL);

  await mainWindow.loadURL(await serverLifecycle.getUrl());
  mainLoaded = true;
  flushPendingCommands();
}

/**
 * `mainWindow` is assigned synchronously as the first thing createWindow()
 * does, before its first await, so by the time this function returns there
 * is no window in one call it doesn't already know about — a second Dock
 * click or Tray click while startup is still in flight always lands in the
 * `mainWindow` branch below instead of spawning a second Next.js server on a
 * second port with the same PGLITE_DIR.
 */
function activateOrCreateWindow() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  createWindow().catch((err) => {
    showStartupError(`Failed to start Doem: ${err.message}`);
    app.quit();
  });
}

// ---------------------------------------------------------------------------
// Desktop extras: capture bar, reminders, not-tracking nudge, away prompt.
// ---------------------------------------------------------------------------

/**
 * Like sendCommand, but never drops: when there is no loaded main window the
 * command is queued, the window is created, and the queue is flushed once the
 * app page has loaded.
 */
function sendCommandReliably(command) {
  if (mainWindow && mainLoaded) {
    mainWindow.webContents.send("doem:command", command);
    return;
  }
  pendingCommands.push(command);
  if (!mainWindow) activateOrCreateWindow();
}

function flushPendingCommands() {
  // Give the page a moment to subscribe to onCommand after its load event.
  setTimeout(() => {
    while (pendingCommands.length > 0 && mainWindow && mainLoaded) {
      mainWindow.webContents.send("doem:command", pendingCommands.shift());
    }
  }, 1000);
}

function showMainWindow() {
  activateOrCreateWindow();
}

// Capture shortcut ----------------------------------------------------------

let captureStatus = { shortcut: "Control+Alt+Space", registered: false };

function publishCaptureStatus() {
  mainWindow?.webContents.send("doem:capture-status", captureStatus);
}

function registerCaptureShortcut(shortcut) {
  let registered = false;
  try {
    registered = globalShortcut.register(shortcut, () => toggleCaptureWindow());
  } catch (err) {
    logLine(`[doem] could not register ${shortcut}: ${err.message}`);
  }
  captureStatus = { shortcut, registered };
  publishCaptureStatus();
}

function unregisterCaptureShortcut() {
  if (!captureStatus.registered) return;
  try {
    globalShortcut.unregister(captureStatus.shortcut);
  } catch {
    // Nothing to undo if it was never held.
  }
  captureStatus = { ...captureStatus, registered: false };
}

function positionCaptureWindow() {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { x, y, width, height } = display.workArea;
  const bounds = captureWindow.getBounds();
  captureWindow.setPosition(
    Math.round(x + (width - bounds.width) / 2),
    Math.round(y + height / 4),
  );
}

async function ensureCaptureWindow() {
  if (captureWindow && !captureWindow.isDestroyed()) return captureWindow;
  const win = new BrowserWindow({
    width: 560,
    height: 64,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    // A non-activating panel on macOS, like Spotlight: it takes typing without
    // making Doem the active app, so opening or closing it never brings the
    // main window forward and focus stays with the app you were in.
    type: process.platform === "darwin" ? "panel" : undefined,
    transparent: true,
    backgroundColor: "#00000000",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  captureWindow = win;
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, targetUrl) => {
    if (!targetUrl.startsWith(`http://${HOST}:`)) {
      event.preventDefault();
      shell.openExternal(targetUrl);
    }
  });
  win.on("blur", () => {
    if (!win.isDestroyed() && win.isVisible()) win.hide();
  });
  win.on("closed", () => {
    if (captureWindow === win) captureWindow = null;
  });
  try {
    await win.loadURL(`${await serverLifecycle.getUrl()}/capture`);
  } catch (err) {
    logLine(`[doem] could not load the capture window: ${err.message}`);
    if (!win.isDestroyed()) win.destroy();
    if (captureWindow === win) captureWindow = null;
    return null;
  }
  return win;
}

let captureBusy = false;

function hideCaptureWindow() {
  if (captureWindow && !captureWindow.isDestroyed() && captureWindow.isVisible()) captureWindow.hide();
}

async function toggleCaptureWindow(forceShow = false) {
  if (quitting || captureBusy) return;
  if (!forceShow && captureWindow && !captureWindow.isDestroyed() && captureWindow.isVisible()) {
    hideCaptureWindow();
    return;
  }
  captureBusy = true;
  try {
    const win = await ensureCaptureWindow();
    if (!win || win.isDestroyed()) return;
    positionCaptureWindow();
    win.show();
    win.focus();
  } finally {
    captureBusy = false;
  }
}

ipcMain.on("doem:capture-close", () => {
  hideCaptureWindow();
});

ipcMain.on("doem:capture-saved", () => {
  sendCommand({ type: "refresh-tasks" });
});

ipcMain.handle("doem:get-capture-status", () => captureStatus);

// Settings is recording a new shortcut: let the keys reach the page instead of
// opening the capture bar, then take the shortcut back.
ipcMain.on("doem:pause-capture-shortcut", (_event, paused) => {
  if (paused === true) unregisterCaptureShortcut();
  else if (!captureStatus.registered) registerCaptureShortcut(captureStatus.shortcut);
});

// Reminders -----------------------------------------------------------------

const reminderSchedule = createReminderSchedule();
// Live notifications stay referenced until closed or acted on, or they can be
// garbage collected and never fire their handlers.
const liveNotifications = new Set();
let reminderInterval = null;

function sanitiseReminders(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list.slice(0, 500)) {
    if (!item || typeof item !== "object") continue;
    const { taskId, title, scheduled, dueTime, leadMinutes } = item;
    if (typeof taskId !== "string" || typeof title !== "string") continue;
    if (typeof scheduled !== "string" || typeof dueTime !== "string") continue;
    const lead = Number.isFinite(leadMinutes) ? Math.min(Math.max(Math.round(leadMinutes), 0), 1440) : 0;
    out.push({
      taskId: taskId.slice(0, 80),
      title: title.slice(0, 200),
      scheduled: scheduled.slice(0, 10),
      dueTime: dueTime.slice(0, 5),
      leadMinutes: lead,
    });
  }
  return out;
}

ipcMain.on("doem:set-reminders", (_event, list) => {
  reminderSchedule.setReminders(sanitiseReminders(list));
});

function showReminder(event) {
  if (!Notification.isSupported()) return;
  const notification = new Notification({
    title: event.title,
    body: event.body,
    icon: iconPath,
    actions: [
      { type: "button", text: "Start" },
      { type: "button", text: "Snooze 15m" },
      { type: "button", text: "Tomorrow" },
    ],
  });
  liveNotifications.add(notification);
  const release = () => liveNotifications.delete(notification);
  notification.on("action", (_e, index) => {
    if (index === 0) {
      sendCommandReliably({ type: "reminder-start", taskId: event.taskId });
      reminderSchedule.handled(event.taskId);
    } else if (index === 1) {
      reminderSchedule.snooze(event.taskId, new Date());
    } else if (index === 2) {
      sendCommandReliably({ type: "reminder-tomorrow", taskId: event.taskId });
      reminderSchedule.handled(event.taskId);
    }
    release();
  });
  notification.on("click", () => {
    showMainWindow();
    reminderSchedule.handled(event.taskId);
    release();
  });
  notification.on("close", release);
  notification.show();
}

function reminderTick() {
  for (const event of reminderSchedule.due(new Date())) showReminder(event);
}

// Not-tracking nudge and away prompt ----------------------------------------

const nudgeCounter = createNudgeCounter();
const awayWatcher = createAwayWatcher();
let screenLocked = false;
let desktopTickInterval = null;
let awayDialogOpen = false;

// Claude Code awareness: off by default, read-only scan, never writes under ~/.claude.
let claudeAwareness = false;
let claudeSessions = [];
let claudeInterval = null;
const claudeWaits = createWaitTracker();
let claudeScanBusy = false;

function showClaudeWaiting(session) {
  if (!Notification.isSupported()) return;
  const { title, body } = waitingNotification(session);
  const notification = new Notification({ title, body, icon: iconPath });
  liveNotifications.add(notification);
  const release = () => liveNotifications.delete(notification);
  notification.on("click", () => {
    showMainWindow();
    release();
  });
  notification.on("close", release);
  notification.show();
}

async function refreshClaudeSessions() {
  if (!claudeAwareness || claudeScanBusy) return;
  claudeScanBusy = true;
  try {
    const root = path.join(os.homedir(), ...PROJECTS_SUBPATH);
    const now = new Date();
    const since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sessions = await scanClaudeSessions({ root, since, now });
    if (!claudeAwareness) return;
    claudeSessions = sessions;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("doem:claude-sessions", sessions);
    }
    for (const session of claudeWaits.update(sessions, new Date())) showClaudeWaiting(session);
  } catch (err) {
    logLine(`[doem] claude scan failed: ${err && err.message}`);
  } finally {
    claudeScanBusy = false;
  }
}

ipcMain.handle("doem:get-claude-sessions", () => (claudeAwareness ? claudeSessions : []));

ipcMain.on("doem:set-desktop-settings", (_event, settings) => {
  if (!settings || typeof settings !== "object") return;
  const { captureShortcut, nudgeMinutes } = settings;
  if (typeof nudgeMinutes === "number" && Number.isFinite(nudgeMinutes) && nudgeMinutes > 0) {
    nudgeCounter.setThreshold(Math.min(Math.round(nudgeMinutes), 1440));
  } else {
    nudgeCounter.setThreshold(null);
  }
  if (
    typeof captureShortcut === "string" &&
    captureShortcut.trim() !== "" &&
    captureShortcut.length <= 64 &&
    captureShortcut !== captureStatus.shortcut
  ) {
    unregisterCaptureShortcut();
    registerCaptureShortcut(captureShortcut);
    writeDesktopSettings({ captureShortcut });
  }
  const nextClaude = settings.claudeAwareness === true;
  if (nextClaude !== claudeAwareness) {
    claudeAwareness = nextClaude;
    if (nextClaude) {
      if (claudeInterval) clearInterval(claudeInterval);
      claudeInterval = setInterval(refreshClaudeSessions, 60_000);
      refreshClaudeSessions();
    } else {
      if (claudeInterval) clearInterval(claudeInterval);
      claudeInterval = null;
      claudeSessions = [];
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("doem:claude-sessions", []);
      }
    }
  }
});

function showNudge(minutes) {
  if (!Notification.isSupported()) return;
  const { title, body } = nudgeMessage(minutes);
  const notification = new Notification({ title, body, icon: iconPath });
  liveNotifications.add(notification);
  const release = () => liveNotifications.delete(notification);
  notification.on("click", () => {
    showMainWindow();
    sendCommandReliably({ type: "navigate", path: "/tracking" });
    release();
  });
  notification.on("close", release);
  notification.show();
}

async function showAwayPrompt(event) {
  if (awayDialogOpen || !trayTimerStatus) return;
  awayDialogOpen = true;
  try {
    const minutes = (event.awayTo.getTime() - event.awayFrom.getTime()) / 60000;
    const text = awayPromptText(minutes, trayTimerStatus.label);
    const options = {
      type: "question",
      message: text.message,
      buttons: text.buttons,
      defaultId: 0,
      cancelId: 0,
    };
    const { response } = mainWindow
      ? await dialog.showMessageBox(mainWindow, options)
      : await dialog.showMessageBox(options);
    sendCommandReliably({
      type: "away",
      choice: ["keep", "break", "discard"][response] ?? "keep",
      awayFrom: event.awayFrom.toISOString(),
      awayTo: event.awayTo.toISOString(),
    });
  } finally {
    awayDialogOpen = false;
  }
}

function desktopTick() {
  const now = new Date();
  const tracking = trayTimerStatus !== null;
  let idleSeconds = 0;
  try {
    idleSeconds = powerMonitor.getSystemIdleTime();
  } catch {
    idleSeconds = 0;
  }
  const nudge = nudgeCounter.tick({ tracking, locked: screenLocked, idleSeconds });
  if (nudge.notify) showNudge(nudge.minutes);
  const away = awayWatcher.idleTick({ idleSeconds, now, tracking });
  if (away) showAwayPrompt(away).catch((err) => logLine(`[doem] away prompt failed: ${err.message}`));
}

function startDesktopExtras() {
  const settings = readDesktopSettings();
  const shortcut =
    typeof settings.captureShortcut === "string" && settings.captureShortcut ? settings.captureShortcut : "Control+Alt+Space";
  registerCaptureShortcut(shortcut);

  powerMonitor.on("lock-screen", () => {
    screenLocked = true;
    awayWatcher.lock(new Date(), trayTimerStatus !== null);
  });
  powerMonitor.on("unlock-screen", () => {
    screenLocked = false;
    nudgeCounter.reset();
    const away = awayWatcher.unlock(new Date(), trayTimerStatus !== null);
    if (away) showAwayPrompt(away).catch((err) => logLine(`[doem] away prompt failed: ${err.message}`));
  });

  reminderInterval = setInterval(reminderTick, 30 * 1000);
  desktopTickInterval = setInterval(desktopTick, 60 * 1000);
}

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.whenReady().then(() => {
  for (const move of migratedUserData) logLine(`[doem] migrated ${move}`);
  installMenu();
  installContextMenu();
  createTray();
  startDesktopExtras();
  startUpdateCheck();
  if (isDev && process.platform === "darwin" && app.dock) {
    app.dock.setIcon(iconPath);
  }

  activateOrCreateWindow();

  app.on("activate", activateOrCreateWindow);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  quitting = true;
  stopServer();
  if (trayTickInterval) clearInterval(trayTickInterval);
  if (trayPollInterval) clearInterval(trayPollInterval);
  if (reminderInterval) clearInterval(reminderInterval);
  if (desktopTickInterval) clearInterval(desktopTickInterval);
  if (claudeInterval) clearInterval(claudeInterval);
  // A hidden always-on-top window must not hold the app open.
  if (captureWindow && !captureWindow.isDestroyed()) captureWindow.destroy();
});
process.on("exit", stopServer);
