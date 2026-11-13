"use strict";

/**
 * Quiet "new version available" check. No auto-updater: the app is unsigned,
 * so this only tells the person a newer release exists and links to it.
 * It never touches the filesystem itself; settings and logging are injected.
 */

const RELEASE_URL = "https://api.github.com/repos/PurvarajG/doem/releases/latest";
const DAY_MS = 24 * 60 * 60 * 1000;
const FIRST_CHECK_DELAY_MS = 45 * 1000;

/** "v1.2.3" or "1.2.3" -> [1,2,3]. Pre-releases ("1.2.3-beta.1") and junk -> null. */
function parseVersion(text) {
  if (typeof text !== "string") return null;
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:\+[0-9A-Za-z.-]+)?$/.exec(text.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Returns 1, 0 or -1; null when either side is not a plain release version. */
function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] > pb[i] ? 1 : -1;
  }
  return 0;
}

function isReleaseUrl(url) {
  return typeof url === "string" && /^https:\/\/github\.com\//.test(url);
}

/**
 * deps: { currentVersion, fetch, now, readSettings, writeSettings, log,
 *         notify(version, url), setMenuUpdate(version, url) }
 * Settings keys used: updateLastCheck (ms), updateNotifiedVersion, updateAvailable.
 */
function createUpdateChecker(deps) {
  const { currentVersion, fetch, now, readSettings, writeSettings, log, notify, setMenuUpdate } = deps;

  function announce(version, url) {
    try {
      setMenuUpdate(version, url);
      const settings = readSettings();
      if (settings.updateNotifiedVersion !== version) {
        notify(version, url);
        writeSettings({ updateNotifiedVersion: version });
      }
    } catch (err) {
      log(`[doem] update notice failed: ${err && err.message}`);
    }
  }

  /** Runs one check if the last one was over a day ago. Never throws. */
  async function check() {
    try {
      const settings = readSettings();
      const last = Number(settings.updateLastCheck);
      const stored = settings.updateAvailable;
      if (Number.isFinite(last) && last > 0 && now() - last < DAY_MS && now() >= last) {
        // Fresh enough: just keep the menu item for an already-known update.
        if (stored && compareVersions(stored.version, currentVersion) === 1 && isReleaseUrl(stored.url)) {
          setMenuUpdate(stored.version, stored.url);
        }
        return "skipped";
      }
      writeSettings({ updateLastCheck: now() });
      const res = await fetch(RELEASE_URL, {
        headers: { Accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        log(`[doem] update check: HTTP ${res.status}`);
        return "failed";
      }
      const body = await res.json();
      if (!body || body.draft || body.prerelease) return "none";
      const tag = typeof body.tag_name === "string" ? body.tag_name.replace(/^v/, "") : "";
      if (compareVersions(tag, currentVersion) !== 1 || !isReleaseUrl(body.html_url)) {
        writeSettings({ updateAvailable: null });
        return "none";
      }
      writeSettings({ updateAvailable: { version: tag, url: body.html_url } });
      announce(tag, body.html_url);
      return "available";
    } catch (err) {
      try {
        log(`[doem] update check failed: ${err && err.message}`);
      } catch {
        // Logging must never throw out of here.
      }
      return "failed";
    }
  }

  /** Schedules the first check shortly after launch, then re-checks every hour (check() gates to once a day). */
  function start() {
    const first = setTimeout(check, FIRST_CHECK_DELAY_MS);
    const every = setInterval(check, 60 * 60 * 1000);
    first.unref?.();
    every.unref?.();
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }

  return { check, start };
}

module.exports = { parseVersion, compareVersions, createUpdateChecker, RELEASE_URL, DAY_MS };
