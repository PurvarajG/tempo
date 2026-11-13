// Preloaded (via --require) into the Next.js server child process.
//
// Next sets `process.title = "next-server (vX)"` on startup. On macOS libuv
// implements that through LaunchServices, which checks the process in as a
// foreground application — so the child got its own Dock tile, showing the
// generic "exec" executable icon next to the real app. Verified by running
// the packaged binary with ELECTRON_RUN_AS_NODE and nothing else: no tile
// until `process.title` is assigned, then a second tile appears.
//
// Making the property a no-op keeps the Dock to one tile. Nothing depends on
// the title; `ps` still shows the executable path.
if (process.platform === "darwin") {
  const title = process.title;
  Object.defineProperty(process, "title", {
    configurable: true,
    enumerable: true,
    get: () => title,
    set: () => {},
  });
}

// electron/main.js kills this child on a normal quit, but a force-quit, a
// crash, or `kill -9` on the main process skips that entirely — the child
// gets reparented to launchd (ppid 1) and keeps running, still holding the
// PGlite data directory open. PGlite has no real cross-process lock, so an
// orphan left running this way silently corrupts the next launch's database
// instead of merely failing to start. Polling ppid and exiting the moment
// it becomes 1 bounds how long an orphan can live to one tick of this timer.
// One second keeps that window shorter than a person can relaunch the app.
setInterval(() => {
  if (process.ppid === 1) process.exit(0);
}, 1000).unref();
