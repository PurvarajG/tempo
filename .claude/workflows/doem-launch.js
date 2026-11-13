export const meta = {
  name: 'doem-launch',
  description: 'Get Doem ready to ship: freeze, clean the repo, README, website, update check, screenshots, tests, squashed release branch. Local only, nothing is pushed.',
  whenToUse: 'Once, to take the rebrand/doem branch to a clean, tested release/<version> branch ready for the owner to push.',
  phases: [
    { title: 'Freeze', detail: 'archive the build record, back up all history, commit the staged rename' },
    { title: 'Route', detail: 'Opus router assigns every path to one worker and orders them into waves', model: 'opus' },
    { title: 'Build out', detail: 'workers in parallel per wave, each in its own files; router audits each wave' },
    { title: 'Verify', detail: 'typecheck, lint, tests, build; fix what fails' },
    { title: 'Ship check', detail: 'router gate, after screenshots, package the app, run the lifecycle tests' },
    { title: 'Squash', detail: 'router gate, one clean release branch on top of main, old branches deleted' },
    { title: 'Push', detail: 'router gate, push the release branch and open the pull request to main (no tag)' },
    { title: 'Report', detail: 'what changed, test results, what the owner still does by hand' },
  ],
}

// ---------------------------------------------------------------------------
// Settings. Override any of these by passing them in `args`.
// ---------------------------------------------------------------------------
const A = args || {}
const VERSION = A.version || '1.0.0'
const LICENSE = A.license === undefined ? 'MIT' : A.license // null = no LICENSE file is added.
const DATE = A.date || '2026-11-13'
const REPO = '/Users/purvarajsinhgohil/TaskManager'
const ARCHIVE = A.archiveDir || '/Users/purvarajsinhgohil/Documents/Doem-archive'
const GH_REPO = A.githubRepo || 'PurvarajG/doem' // the name after the planned rename
const RELEASE_BRANCH = `release/${VERSION}`
const PACK_OUT = 'dist-electron-release'

const SONNET = 'sonnet'
const HAIKU = 'haiku'
const OPUS = 'opus'
const MARKER = `${ARCHIVE}/.launch-start-marker`
// Added after a worker ran pkill -f "next start" and stopped the server inside the owner's
// running Doem.app. Appended only to steps that had not started, so finished work is reused.
const KILL_RULE = `
- Process hygiene: stop only processes you started, by the PID you recorded when you started
  them (kill <pid>). Never use pkill, killall or kill by pattern or name (no pkill -f "next",
  no pkill -f "next start", no pkill node, no pkill electron): the owner's Doem.app runs its
  own "next start" server on ports 39847 to 39849 and must keep running. If you cannot find
  the PID of something you started, find it with lsof -iTCP:<your port> -sTCP:LISTEN and check
  its command line points at your scratch folder before stopping it.`

// Rules every agent gets. Ownership lines in each prompt narrow them further.
const RULES = `
Context: Doem (formerly Tempo) is a Mac-only Electron + Next.js + local PGlite task app.
Repo: ${REPO}, branch rebrand/doem. Read AGENTS.md first: this Next.js version differs from
your training data, and its docs are in node_modules/next/dist/docs/.

Hard rules:
- Never push, never open or edit pull requests, releases, tags on GitHub, never rename the
  GitHub repo, never deploy the website. Nothing leaves this machine.
- Never read, write, move or delete anything in ~/Library/Application Support/Doem,
  ~/Library/Application Support/Tempo or the Tempo-backup-* folders there. That is the
  owner's real data. Use PGLITE_DIR pointing at a scratch folder for any server you run.
- Never quit, kill or overwrite the owner's running Doem.app (dist-electron/mac-arm64/Doem.app).
- No git writes (add, commit, checkout, branch, stash, reset) unless your task says so.
- Only edit the files your task says you own. If something outside them must change,
  list it in your result instead of changing it.
- Ports: run ~/.claude/bin/port-check --next for any server you start, never a framework
  default, and stop every server you started before you finish.
- Do not run next build, next dev or the full test suite in ${REPO} itself unless your task
  says so: other agents edit the tree at the same time.
- Report honestly: say what you did not do or could not verify.`

const RESULT = {
  type: 'object',
  properties: {
    done: { type: 'array', items: { type: 'string' }, description: 'what was changed, one line each, with paths' },
    verified: { type: 'array', items: { type: 'string' }, description: 'checks run and their result' },
    notDone: { type: 'array', items: { type: 'string' }, description: 'anything skipped, blocked or unverified, and why' },
    needsOwner: { type: 'array', items: { type: 'string' }, description: 'decisions or hand checks for the owner' },
    filesTouched: { type: 'array', items: { type: 'string' }, description: 'every repo-relative path you created, edited, moved or deleted' },
    leftRunning: { type: 'array', items: { type: 'string' }, description: 'any process, server, port or git worktree you started and did not stop (should be empty)' },
  },
  required: ['done', 'verified', 'notDone', 'needsOwner', 'filesTouched', 'leftRunning'],
}

// The router's file map: who owns what, and in which order workers run.
const ROUTE = {
  type: 'object',
  properties: {
    assignments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          own: { type: 'array', items: { type: 'string' }, description: 'paths or globs this worker alone may change' },
          readOnly: { type: 'array', items: { type: 'string' }, description: 'paths it needs to read but must not change' },
          notes: { type: 'string', description: 'extra instructions for this worker, e.g. a hand-off it must respect' },
        },
        required: ['key', 'own', 'readOnly', 'notes'],
      },
    },
    shared: {
      type: 'array',
      items: {
        type: 'object',
        properties: { path: { type: 'string' }, rule: { type: 'string', description: 'which worker may change which part' } },
        required: ['path', 'rule'],
      },
    },
    waves: { type: 'array', items: { type: 'array', items: { type: 'string' } }, description: 'worker keys per wave; workers in one wave run together' },
    risks: { type: 'array', items: { type: 'string' } },
  },
  required: ['assignments', 'shared', 'waves', 'risks'],
}

// The router's audit after a wave, and its go/no-go gates.
const AUDIT = {
  type: 'object',
  properties: {
    clean: { type: 'boolean', description: 'true if every change sits inside its owner\'s paths and nothing collided' },
    violations: { type: 'array', items: { type: 'string' }, description: 'path, the worker that changed it, the rule it broke' },
    rework: {
      type: 'array',
      items: {
        type: 'object',
        properties: { key: { type: 'string' }, instruction: { type: 'string' } },
        required: ['key', 'instruction'],
      },
      description: 'workers to send back once, with exactly what to put right',
    },
    housekeeping: { type: 'array', items: { type: 'string' }, description: 'stray servers, ports or worktrees you stopped or removed' },
    forVerify: { type: 'array', items: { type: 'string' }, description: 'cross-worker issues the Verify agent must resolve' },
  },
  required: ['clean', 'violations', 'rework', 'housekeeping', 'forVerify'],
}

const GATE = {
  type: 'object',
  properties: {
    go: { type: 'boolean' },
    reasons: { type: 'array', items: { type: 'string' } },
    housekeeping: { type: 'array', items: { type: 'string' } },
  },
  required: ['go', 'reasons', 'housekeeping'],
}

// The router writes no code. Its only job is keeping the workers apart and tidy.
const ROUTER = `You are the routing agent for a multi-agent release run. Your only job is managing
the workers: deciding who owns which files, in what order they run, and checking afterwards
that nobody stepped on anybody else. You do not write or edit any repo file, you do not fix
code, and you do not use git for anything except reading (status, diff, log, ls-files,
worktree list). You may stop a stray server or process a worker left running, and remove a
scratch git worktree a worker left behind, and you must report each one.
Repo: ${REPO}. Owner data you must never touch: ~/Library/Application Support/Doem, Tempo,
Tempo-backup-*. The owner's Doem.app (dist-electron/mac-arm64/Doem.app) must stay running.`

// Ask the router whether the run may move on to a serial phase.
async function gate(name, extra) {
  const g = await agent(`${ROUTER}${KILL_RULE}

Gate before "${name}". Decide go or no-go.
Check:
- git -C ${REPO} worktree list shows only the main checkout (remove scratch worktrees workers left).
- No server or node/next/electron process started by a worker is still running (lsof -iTCP -sTCP:LISTEN,
  ~/.claude/bin/port-check --stale; ignore the owner's Doem and its next server on 39847 to 39849).
- The owner's Doem.app is still running (pgrep -f "dist-electron/mac-arm64/Doem.app").
- Nothing under ~/Library/Application Support/Tempo or Tempo-backup-* is newer than ${MARKER}
  (find ... -newer ${MARKER}).
${extra || ''}
No-go only for something that would make the next phase unsafe or wrong; list it in reasons.`,
    { label: `gate:${name}`, phase: name, model: OPUS, schema: GATE })
  return g
}

const VERIFY = {
  type: 'object',
  properties: {
    green: { type: 'boolean', description: 'true only if every check passed on the final tree' },
    checks: { type: 'array', items: { type: 'string' }, description: 'each check with pass/fail and counts' },
    fixed: { type: 'array', items: { type: 'string' } },
    stillFailing: { type: 'array', items: { type: 'string' } },
  },
  required: ['green', 'checks', 'fixed', 'stillFailing'],
}

const results = {}

// ---------------------------------------------------------------------------
// Phase 1: Freeze. Serial. Nothing else may run until history is backed up.
// ---------------------------------------------------------------------------
phase('Freeze')
results.freeze = await agent(`${RULES}

Task: back everything up, then commit the staged rename. You may use git for exactly the
steps below.

0. mkdir -p ${ARCHIVE} && touch ${MARKER} (later checks compare file times against it).
1. Run: git -C ${REPO} bundle create ${ARCHIVE}/TaskManager-full-history-${DATE}.bundle --all
   Then git bundle verify it. Stop and report if either fails.
2. Copy (cp -R, do not move) ${REPO}/rebuild to ${ARCHIVE}/rebuild-record. Check the copy's
   file count equals the original's (find | wc -l).
3. git status: the index holds the staged Tempo -> Doem rename (about 266 files). Commit
   exactly the index, nothing unstaged, with the message:
     chore: rename Tempo to Doem
     <blank line>
     App, packaging, IPC channels, storage keys, brand assets, download site and docs.
     User data moves from Tempo to Doem on first launch (electron/user-data-migration.js).
     <blank line>
     Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
   If there are unstaged changes, leave them alone and list them.
4. Report the bundle path and size, the archive file count, and the new commit hash.`,
  { label: 'freeze', phase: 'Freeze', model: HAIKU, schema: RESULT })

// Stop only on real failure: the bundle must verify and the rename must be committed.
// (notDone often carries harmless notes that mention "bundle" or "commit".)
const freezeOk = results.freeze
  && results.freeze.verified.some((l) => /bundle verify/i.test(l) && !/fail|error/i.test(l))
  && results.freeze.done.some((l) => /committed/i.test(l))
if (!freezeOk) {
  log('Freeze did not finish cleanly. Stopping before anything is deleted.')
  return { stoppedAt: 'Freeze', results }
}

// ---------------------------------------------------------------------------
// Phase 2: Build out. Six agents in parallel, each with its own files.
// ---------------------------------------------------------------------------
phase('Build out')

const MEDIA_NAMES = 'today-light.png, today-dark.png, calendar-light.png, tracking-light.png, project-board-light.png'

const BUILD_OUT = [
  {
    key: 'cleanup',
    model: SONNET,
    prompt: `Task: clean up the repo. The owner wants only what is needed to build, test and
understand the app, plus the v2 design planning.

You own: rebuild/, docs/, design-prototypes/, .agents/, .claude/agents/, .claude/workflows/
(except .claude/workflows/doem-launch.js, which you must keep), .impeccable/,
scripts/v2-gates.sh, scripts/v2-watch.mjs, scripts/v2-style-check.mjs, tests/v2-shots.test.ts,
AGENTS.md and CLAUDE.md (references only), and the local, gitignored dist-electron/.

A full copy of rebuild/ is already in ${ARCHIVE}/rebuild-record, and all git history is in a
bundle there, so deleting from the working tree loses nothing.

1. Keep the v2 design planning, moved with git-free plain mv into docs/design/v2/:
   rebuild/v2_design/ (the soft.html mockups and its assets), rebuild/v2_build_plan.md,
   rebuild/v2_build/decisions.md, rebuild/redesign_features.md,
   rebuild/redesign_current_ui_problems.md, rebuild/doem_rebrand_plan.md. Add a short
   docs/design/v2/README.md (5 to 10 lines) saying what each file is.
2. Delete the rest of rebuild/ (shots, reports, ledgers, style-check, reference, the failed
   patch, current-ui-audit).
3. Delete: docs/superpowers/, docs/tempo-focus-ledger.md, docs/workspace-upgrade-plan.md,
   design-prototypes/, .agents/skills/neon*/ (the app uses local PGlite, not Neon),
   .claude/agents/tempo-*.md, .claude/workflows/tempo-v2-build.js, .impeccable/critique/,
   scripts/v2-gates.sh, scripts/v2-watch.mjs, scripts/v2-style-check.mjs.
   Keep scripts/v2-shots.mjs and tests/v2-shots.test.ts: another agent turns them into the
   screenshot tool. Keep scripts/seed-v2-lab.ts and scripts/seed-lab.ts.
4. grep the whole tracked tree (git ls-files plus new files) for the deleted paths and for
   "rebuild/". Fix references in files you own. List any reference in a file you do not own.
   Check package.json scripts too and list any that point at deleted files.
5. In dist-electron/ (local, gitignored), delete everything except mac-arm64/Doem.app, which
   is running. Report the space freed.
6. Report the tracked file count before and after (git ls-files | wc -l counts the index;
   also count files on disk under the repo, excluding node_modules, .next, dist-electron, .git).`,
  },
  {
    key: 'updateCheck',
    model: SONNET,
    prompt: `Task: add a quiet "new version available" check, so people on ${VERSION} hear about
later releases. There is no auto-updater and the app is unsigned, so do not add
electron-updater or Squirrel.

You own: electron/update-check.js (new), the smallest needed hook in electron/main.js, and a
new test tests/electron-update-check.test.ts. If the renderer needs a change, list it instead.

Behaviour:
- In the main process, a while after launch and then at most once a day, GET
  https://api.github.com/repos/${GH_REPO}/releases/latest (a GitHub redirect from the old repo
  name is fine). Compare tag_name (strip a leading v) with app.getVersion() using a plain
  semver compare (write it, no new dependency).
- If newer: show one native notification "Doem <x> is available" whose click opens the
  release's html_url in the browser, and add an "Update to <x>…" item to the app menu that
  does the same. Do not nag: notify once per version (remember it in the settings.json file
  the app already keeps in userData; read how electron/main.js stores settings).
- Any failure (offline, rate limit, 404, bad JSON) is silent apart from one line in the
  existing log. Never block startup, never throw.
- Only runs in the packaged app (app.isPackaged), never in tests or dev.
Tests: the version compare (including 1.0.0 vs 1.0.0, 1.0.0 vs 1.0.1, 1.10.0 vs 1.9.0,
v-prefixed tags, pre-releases ignored), the once-a-day and once-per-version rules, and that
a network error does nothing. Run only your own test file with npx vitest run <file>, and
npx tsc --noEmit -p . if the project has a tsconfig that covers it.`,
  },
  {
    key: 'readme',
    model: SONNET,
    prompt: `Task: make the GitHub repo read like a finished product, for release ${VERSION}.

You own: README.md, CHANGELOG.md (new), docs/media/README.md (a one-line note), and
${LICENSE ? `LICENSE (new, ${LICENSE}, copyright Purvarajsinh Gohil, ${DATE.slice(0, 4)})` : 'nothing else (no LICENSE: the owner has not chosen one; say so in your result)'}.

Read the app (app/, components/, electron/, lib/) and brand/doem/START-HERE.md to describe it
truthfully. Do not invent features. The repo will be renamed to github.com/${GH_REPO}.

README.md:
- Top: the doem lockup (brand/doem/svg/doem-lockup-light.svg, with a <picture> dark variant
  brand/doem/svg/doem-lockup-dark.svg), one plain sentence on what Doem is, a Download link to
  https://github.com/${GH_REPO}/releases/latest/download/Doem-latest-arm64.dmg, and a hero image
  docs/media/today-light.png (another agent captures the images; these exact names will exist:
  ${MEDIA_NAMES}).
- What it does (short, by feature area), privacy (data stays in a local database on the Mac;
  the only network calls are listed, including the new once-a-day GitHub release check and any
  calendar feed the app has), install (Apple Silicon, macOS version from package.json or
  electron config; the app is not notarized, so explain the one-time right-click > Open or
  System Settings > Privacy & Security step), keyboard shortcuts if the app defines them,
  building from source (npm ci, npm run dev on its port, npm run electron:pack), and where the
  design docs live (docs/design/v2/).
- Formal, plain English. No marketing fluff, no emoji, no em dashes.
CHANGELOG.md: Keep a Changelog style. ${VERSION} (${DATE}): Tempo is now Doem, the v2 redesign
by area, the update check, data migration note, known issues (read the app and tests; include
at least: the app is unsigned; the sidebar Completed row can sit under the foot at 1440x900;
the Up next row can truncate its last meta item). Then a short entry each for 0.1.3, 0.1.2,
0.1.1, 0.1.0 from git log v0.1.0..v0.1.3 (Tempo era).
docs/media/README.md: one line saying the images are captured by scripts/screenshots.mjs.`,
  },
  {
    key: 'website',
    model: SONNET,
    prompt: `Task: redesign the download website in site/ for the Doem brand and release ${VERSION}.

You own: everything under site/ except site/dist/ (build output) and site/media/ (another
agent puts screenshots there, with these exact names: ${MEDIA_NAMES}).

Read first: site/index.html, site/styles.css, site/build.mjs, site/worker/, site/package.json,
brand/doem/START-HERE.md, brand/doem/tokens.json, brand/doem-design-language.html and
docs/design/v2/v2_design/ or rebuild/v2_design/ (whichever exists; the soft.html mockup is the
app's visual language: soft glass, ink and indigo, Geist).

Goal: one calm, confident product page that looks like it belongs to the app, not a template.
- Hero: the doem lockup, one sentence, the Download for Mac button (keep the existing
  releases/latest/download/Doem-latest-arm64.dmg link, but point it at github.com/${GH_REPO}),
  "Apple Silicon, macOS <version>" under it, and the app screenshot site/media/today-light.png
  (dark: today-dark.png via prefers-color-scheme) in a Mac window frame.
- Then a few feature sections drawn from the real app (read app/ and components/; never claim
  what it does not do), using the other screenshots; a privacy section (local database, no
  account); the unsigned-app first-launch note; FAQ only if the current site has one worth
  keeping; footer with GitHub link and the release notes link.
- Light and dark themes from tokens, a real responsive layout down to 375px, semantic HTML,
  alt text, no tracking scripts, fonts self-hosted or from Google Fonts, no new build tooling.
- Keep the existing build working: run node site/build.mjs (it only touches site/), check it
  exits 0, then serve site/dist (or whatever it outputs) with python3 -m http.server on a
  port-check --next port and check the page loads and every asset returns 200 except the
  site/media images, which may not exist yet. Stop the server.
If an impeccable or frontend-design skill is available to you, use it for the design pass.`,
  },
  {
    key: 'beforeShots',
    model: SONNET,
    prompt: `Task: realistic demo data, a reusable screenshot tool, and the "before" screenshots of
the old Tempo design (v0.1.3) for a rebrand animation.

You own: scripts/demo-data.ts (new), scripts/screenshots.mjs (rename of scripts/v2-shots.mjs:
git-free plain mv, then update it), tests/v2-shots.test.ts (rename to tests/screenshots.test.ts
and update), package.json "scripts" entries for these two only, and ${ARCHIVE}/screenshots/.

1. Demo data: write scripts/demo-data.ts, based on scripts/seed-v2-lab.ts, that fills an empty
   PGLITE_DIR with a believable week for a product designer: 3 or 4 projects with colours,
   about 25 tasks spread over today, the next 7 days and overdue, a few done today, estimates,
   priorities, one running or recent timer, and a week of time entries across categories so
   Tracking has shape. Real-sounding titles ("Review onboarding flow", "Ship pricing page
   copy"), nothing that looks like test data, no real people's names or emails. Dates relative
   to the day it runs. It must work against the current schema.
2. Screenshot tool: turn scripts/v2-shots.mjs into scripts/screenshots.mjs: args for base URL,
   output folder, theme(s), and a route list; 1440x900 at device scale factor 2 (PNG,
   2880x1800); waits for fonts and data; no rebuild/ paths left. Update its test.
3. Before shots: git worktree add a scratch folder (in your session scratchpad, not the repo)
   at tag v0.1.3, npm ci there, npx next build. Make a scratch PGLITE_DIR and seed it with the
   same demo story. v0.1.3 has an older schema: if scripts/demo-data.ts cannot target it,
   seed through v0.1.3's own HTTP API (read its app/api routes) with an equivalent dataset.
   Run next start in the worktree with that PGLITE_DIR on a port-check --next port. Capture
   every main screen it has (Today, the week view, Calendar, Tracking, a project board,
   Inbox if it exists) in light and dark into ${ARCHIVE}/screenshots/before/.
4. Stop the server, git worktree remove the scratch worktree (it is the only git write you
   may do), and delete the scratch data.
Report the files written with sizes, and anything that looked broken in the old app.`,
  },
  {
    key: 'testHarness',
    model: SONNET,
    prompt: `Task: write the app lifecycle test harness and the hand-check list. Do not run the
packaged app yet; a later step builds it and runs your harness.

You own: scripts/smoke-app.mjs (new), docs/release-checklist.md (new),
package.json "scripts" entry "smoke:app" only.

Read electron/main.js, electron/user-data-migration.js, electron/preload.js and the
electron tests first.

scripts/smoke-app.mjs <path-to-Doem.app>:
- Copies the .app to a scratch folder and always launches it with an isolated user data
  folder. Check whether Chromium's --user-data-dir switch moves app.getPath('userData') in
  this Electron version (write a tiny probe if needed). If it does not, the harness must stop
  with a clear message instead of touching ~/Library/Application Support/Doem.
- The owner's Doem is running at the same time; the app falls back to ports 39848/39849. Find
  the port of the instance you launched from its log or process args, never assume 39847.
- Cases, each reported pass/fail with timing:
  1. first launch on an empty data folder: server answers, /, /inbox, /upcoming, /calendar,
     /tracking, /settings return 200, no error lines in the log.
  2. 20 cycles of launch, wait for ready, quit gracefully (osascript quit by bundle id will hit
     the owner's app too, so send SIGTERM to your own PID or use the app's own quit path, and
     prove the owner's Doem is still running afterwards), relaunch; data written in cycle 1
     (create a task through the API) is still there in cycle 20.
  3. second launch while running: only one instance, it focuses.
  4. kill -9 while idle, relaunch: database opens, the task is still there.
  5. kill -9 while a timer runs, relaunch: no crash, time entry state is sane.
  6. upgrade from Tempo: an isolated data root with a Tempo folder holding a pglite copy made
     by the demo seeder, launch Doem pointed at that root, check the data moved and the Tempo
     folder kept nothing it should not. If the migration cannot be isolated from the real
     ~/Library/Application Support, skip this case and say why.
- Exits non-zero on any failure, cleans up every process and scratch folder it created.
docs/release-checklist.md: the hand checks no script can do, as a short checkbox list, each
with how to trigger it and what "pass" looks like: install from the DMG into /Applications
and first open past Gatekeeper; capture shortcut Ctrl+Option+Space; tray menu (Quick add,
Start/Stop timer, Open); a reminder firing with the window hidden (Start, Snooze 15m,
Tomorrow); away prompt after locking the screen over 60 s while timing; nudge; Dock badge;
focus session (f) and Time's up; end-of-day wrap and weekly reset; closing the window and
reopening from the Dock; quit while a timer runs; notification permission prompt; the update
notification (test by temporarily setting a lower version); dark theme by hand in Settings.
Then a short "release steps" section: version bump, PR, tag, check the workflow, check the
download link, then deploy the site.
Check your script at least parses: node --check scripts/smoke-app.mjs.`,
  },
]

// --- Route: the Opus router turns the six briefs into one conflict-free file map. ---
phase('Route')
const route = await agent(`${ROUTER}

Six workers are about to run in the same working tree on branch rebrand/doem (the tree is
clean: the Freeze step just committed). Their briefs follow. Read them, then read the repo
(git ls-files, package.json, scripts/, tests/, site/, docs/, rebuild/) to see what each brief
really touches, including side effects such as renames, deletions, package.json script
entries, tests that import a moved file, and generated folders.

Produce:
- assignments: for every worker, the exact paths or globs it alone may change, what it may
  only read, and notes for any hand-off (for example, a file one worker deletes that another
  needs, or a file another worker will create later).
- shared: files more than one worker must change (package.json is one: say which keys belong
  to whom). Keep this list as short as possible.
- waves: the run order. Put workers in the same wave only if their paths cannot collide and
  neither needs the other's output. Default is one wave with all six; split only for a real
  dependency or collision.
- risks: anything in the briefs that could break the build, the owner's data or the running
  app, and how the assignment prevents it.
Every repo path a brief mentions must be owned by exactly one worker or listed in shared.

Briefs:
${BUILD_OUT.map((t) => `### ${t.key}\n${t.prompt}`).join('\n\n')}`,
  { label: 'router:plan', phase: 'Route', model: OPUS, schema: ROUTE })

if (!route) {
  log('The router returned no plan. Stopping before any worker runs.')
  return { stoppedAt: 'Route', results }
}
results.route = route
const assignmentFor = (key) => {
  const a = route.assignments.find((x) => x.key === key)
  const shared = route.shared.map((s) => `- ${s.path}: ${s.rule}`).join('\n')
  return a
    ? `\n\nRouter assignment (this overrides the "You own" line above where they differ):
You alone may change: ${a.own.join(', ') || '(nothing)'}
Read only: ${a.readOnly.join(', ') || '(none)'}
Shared files and your part in them:\n${shared || '(none)'}
Router notes: ${a.notes || '(none)'}
List every path you touched in filesTouched, and anything you left running in leftRunning.`
    : '\n\nThe router gave you no assignment: change nothing and report that.'
}

// Every worker key must appear in exactly one wave; anything the router left out runs last.
const known = new Set(BUILD_OUT.map((t) => t.key))
const waves = route.waves.map((w) => w.filter((k) => known.has(k))).filter((w) => w.length)
const placed = new Set(waves.flat())
const missing = BUILD_OUT.map((t) => t.key).filter((k) => !placed.has(k))
if (missing.length) {
  log(`Router left out ${missing.join(', ')}; running them in a final wave.`)
  waves.push(missing)
}
log(`Router plan: ${waves.map((w, i) => `wave ${i + 1} [${w.join(', ')}]`).join(', ')}`)

// --- Build out, wave by wave, with a router audit after each wave. ---
phase('Build out')
results.buildOut = {}
results.audits = []
const runWorker = async (key, extra) => {
  const t = BUILD_OUT.find((x) => x.key === key)
  const r = await agent(`${RULES}\n\n${t.prompt}${assignmentFor(key)}${extra ? KILL_RULE + extra : ''}`,
    { label: extra ? `${key} (rework)` : key, phase: 'Build out', model: t.model, schema: RESULT })
  results.buildOut[key] = r
  log(r ? `${key}: ${r.done.length} changes, ${r.notDone.length} not done` : `${key}: no result`)
  return r
}
const audit = (label, keys) => agent(`${ROUTER}${KILL_RULE}

Audit after ${label}. Workers that just ran: ${keys.join(', ')}.
Your file map:
${JSON.stringify({ assignments: route.assignments, shared: route.shared }, null, 2)}

Their reports (filesTouched and leftRunning matter most):
${JSON.stringify(Object.fromEntries(keys.map((k) => [k, results.buildOut[k]])), null, 2)}

Check against the real tree, not only the reports: git -C ${REPO} status --porcelain and
git diff --stat against HEAD (HEAD is the Freeze commit, so every change since then is a
worker's). Map each changed path to its owner. A violation is: a change outside the worker's
own paths, a shared file changed outside the worker's part, a path two workers both touched,
a changed path no worker reported, or a file one worker needed that another deleted.
Also stop anything in leftRunning or any stray server or worktree, and check
~/Library/Application Support/Tempo and Tempo-backup-* have nothing newer than ${MARKER}.
For each violation say whether it is harmless (list it for Verify) or needs the worker sent
back once (rework, with a precise instruction). Do not edit files yourself.`,
  { label: `router:audit ${label}`, phase: 'Build out', model: OPUS, schema: AUDIT })

for (let i = 0; i < waves.length; i++) {
  const wave = waves[i]
  await parallel(wave.map((key) => () => runWorker(key)))
  let a = await audit(`wave ${i + 1}`, wave)
  results.audits.push(a)
  const rework = a ? a.rework.filter((r) => known.has(r.key)) : []
  if (rework.length) {
    log(`Router sends back: ${rework.map((r) => r.key).join(', ')}`)
    await parallel(rework.map((r) => () => runWorker(r.key, `\n\nRouter rework instruction (do only this, then report):\n${r.instruction}`)))
    a = await audit(`wave ${i + 1} rework`, rework.map((r) => r.key))
    results.audits.push(a)
  }
  if (!a || (!a.clean && a.rework.length)) {
    log(`Wave ${i + 1} is still not clean after one rework. Stopping before Verify.`)
    return { stoppedAt: `Build out wave ${i + 1}`, results }
  }
}

// ---------------------------------------------------------------------------
// Phase 3: Verify. One agent owns the whole tree now. Up to two fix rounds.
// ---------------------------------------------------------------------------
phase('Verify')
const crossRefs = Object.entries(results.buildOut)
  .flatMap(([k, r]) => (r ? r.notDone.concat(r.needsOwner).map((l) => `[${k}] ${l}`) : [`[${k}] agent returned nothing`]))
  .concat(results.audits.filter(Boolean).flatMap((a) => a.forVerify.concat(a.violations).map((l) => `[router] ${l}`)))
  .join('\n')

let verify = null
for (let round = 1; round <= 2; round++) {
  verify = await agent(`${RULES}${KILL_RULE}

Task: you now own the whole working tree (the parallel agents have finished). Make it green.
Round ${round} of 2.

Run, in ${REPO}: npm run lint (or npx eslint .), npx tsc --noEmit, the unit tests and the UI
tests (read package.json and vitest.config.ts for the exact commands), and npx next build.
Also: every image path referenced from README.md and site/ either exists or is one of the
screenshots a later step captures (${MEDIA_NAMES} under docs/media/ and site/media/);
package.json scripts point at files that exist; grep for "rebuild/" and for references to
deleted files.

Fix failures at the root, keeping each fix small. Do not delete or skip tests to get green;
if a test checked a file that was deliberately deleted (v2 build tooling), remove only that
test and say so. Do not commit.

Notes left by the build-out agents (things they could not change or verify):
${crossRefs || '(none)'}
${round > 1 && verify ? `\nStill failing after round 1:\n${verify.stillFailing.join('\n')}` : ''}

Report every check with counts.`,
    { label: `verify-${round}`, phase: 'Verify', model: SONNET, schema: VERIFY })
  if (verify && verify.green) break
}
results.verify = verify
if (!verify || !verify.green) {
  log('Verify is not green after two rounds. Stopping before packaging and squashing.')
  return { stoppedAt: 'Verify', results }
}

// ---------------------------------------------------------------------------
// Phase 4: Ship check. After shots, then package and run the harness.
// ---------------------------------------------------------------------------
phase('Ship check')
results.gateShip = await gate('Ship check', `- The Verify agent left the tree green (it reported: ${verify.checks.join('; ')}).`)
if (!results.gateShip || !results.gateShip.go) {
  log('Router said no-go before Ship check.')
  return { stoppedAt: 'Ship check gate', results }
}
results.afterShots = await agent(`${RULES}${KILL_RULE}

Task: the "after" screenshots of Doem ${VERSION}, the same scenes as the "before" set.
You may run npx next build and next start in ${REPO} now (nobody else is editing).

1. Make a scratch PGLITE_DIR, seed it with npx tsx scripts/demo-data.ts (or however that
   script says to run). Run next start on a port-check --next port with PGLITE_DIR set.
2. With scripts/screenshots.mjs capture the same screens as ${ARCHIVE}/screenshots/before/
   (match file names where a screen exists in both), light and dark, into
   ${ARCHIVE}/screenshots/after/.
3. Copy ${MEDIA_NAMES} into docs/media/ and site/media/ as optimised PNGs: keep 2880x1800 in
   the archive, but put 1440-wide copies in the repo, each under 600 KB (sips or magick).
4. Look at every image you put in the repo: no test-looking data, no personal paths, nothing
   private. Stop the server, delete the scratch data.`,
  { label: 'after-shots', phase: 'Ship check', model: SONNET, schema: RESULT })

results.smoke = await agent(`${RULES}${KILL_RULE}

Task: package the app and run the lifecycle harness.

1. Build into a separate output folder so the owner's running app is untouched:
   npm run electron:icon && npx next build && npx electron-builder --dir --arm64 -c.directories.output=${PACK_OUT}
   Confirm ${PACK_OUT}/mac-arm64/Doem.app exists, codesign --verify --deep --strict passes,
   and its Info.plist CFBundleShortVersionString is what package.json says.
2. Run node scripts/smoke-app.mjs ${PACK_OUT}/mac-arm64/Doem.app and report every case.
3. If a case fails because of an app bug (not the harness), fix it at the root with a small
   change and a test, rebuild, and rerun once. If it is a harness bug, fix the harness.
   Do not commit.
4. Afterwards confirm the owner's Doem (dist-electron/mac-arm64/Doem.app) is still running,
   and delete ${PACK_OUT} only if everything passed (keep it for inspection otherwise).`,
  { label: 'package-and-smoke', phase: 'Ship check', model: SONNET, schema: RESULT })

// ---------------------------------------------------------------------------
// Phase 5: Squash. Serial. One clean branch on top of main.
// ---------------------------------------------------------------------------
phase('Squash')
results.gateSquash = await gate('Squash', `- The packaging and smoke step reported: ${results.smoke ? JSON.stringify({ verified: results.smoke.verified, notDone: results.smoke.notDone }) : 'no result'}.
  No-go if any smoke case failed because of an app bug that was not fixed, or if
  ${PACK_OUT} or any scratch data folder is staged for commit (git status).`)
if (!results.gateSquash || !results.gateSquash.go) {
  log('Router said no-go before Squash. The tree is left as is on rebrand/doem.')
  return { stoppedAt: 'Squash gate', results }
}
results.squash = await agent(`${RULES}${KILL_RULE}

Task: turn the local v2 work into a clean release branch. You may use git for the steps below.
All history is backed up in ${ARCHIVE}/TaskManager-full-history-${DATE}.bundle.

1. First commit the current working tree on rebrand/doem (git add -A; check git status shows
   no file over 5 MB being added and nothing from node_modules, .next, dist-electron,
   ${PACK_OUT} or .data) with the message:
     chore: repo cleanup, README, website, update check, screenshots and tests
     <blank line>
     Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
2. Create ${RELEASE_BRANCH} from main holding exactly that tree in one commit:
     tree=$(git rev-parse rebrand/doem^{tree})
     commit=$(git commit-tree $tree -p main -F <message file>)
     git branch ${RELEASE_BRANCH} $commit
   Message: "feat: Doem ${VERSION}, the v2 redesign and the rename from Tempo", then a body of
   10 to 20 lines summarising the release by area (read CHANGELOG.md), then the
   Co-Authored-By line above.
3. git checkout ${RELEASE_BRANCH}. Bump the version: npm version ${VERSION} --no-git-tag-version
   (updates package.json and package-lock.json), commit as "chore(release): ${VERSION}" with the
   Co-Authored-By line. Do not create a tag.
4. Prove it: git diff rebrand/doem ${RELEASE_BRANCH} -- . ':!package.json' ':!package-lock.json'
   is empty; git rev-list --objects main..${RELEASE_BRANCH} contains no blob over 5 MB (use
   git cat-file --batch-check); report the total size of objects that a push would send.
5. Delete these local branches (they are in the bundle): backup/v2-phase4-5,
   v2-backup-phase-3, redesign/v2-audit, redesign/v2-build, mac-native, tempo-download-site.
   Keep main, rebrand/doem and ${RELEASE_BRANCH}. Do not run git gc or expire reflogs.
6. Report both commit hashes, the branch list, and git status.`,
  { label: 'squash', phase: 'Squash', model: SONNET, schema: RESULT })

// ---------------------------------------------------------------------------
// Phase 6: Push. The owner asked for this. Branch and PR only: no tag, no merge.
// ---------------------------------------------------------------------------
phase('Push')
results.gatePush = await gate('Push', `- The squash step reported: ${results.squash ? JSON.stringify({ done: results.squash.done, verified: results.squash.verified, notDone: results.squash.notDone }) : 'no result'}.
- git -C ${REPO} branch --show-current is ${RELEASE_BRANCH}, git status is clean, and
  git rev-list --objects main..${RELEASE_BRANCH} has no blob over 5 MB (git cat-file --batch-check).
- package.json version is ${VERSION} and LICENSE ${LICENSE ? 'exists' : 'is absent, as intended'}.
No-go if any of these fail.`)
if (!results.gatePush || !results.gatePush.go) {
  log(`Router said no-go before Push. ${RELEASE_BRANCH} stays local.`)
} else {
  results.push = await agent(`Task: publish the release branch for review. The owner explicitly asked for this push.
This is the only step in the run allowed to push. Repo: ${REPO}, remote origin
(github.com/PurvarajG/TaskManager, to be renamed ${GH_REPO} later by the owner).

1. git push -u origin ${RELEASE_BRANCH}. Never use --force, never push main, never push any tag,
   never push any other branch.
2. Open a pull request with gh: base main, head ${RELEASE_BRANCH}, title "Doem ${VERSION}".
   Body: a short summary of the release taken from CHANGELOG.md (${VERSION} section), a
   "Before you tag" list (run docs/release-checklist.md; then tag v${VERSION} on main after the
   merge, which starts the release workflow; deploy the site only after the DMG is attached),
   and end the body with this exact line:
   🤖 Generated with [Claude Code](https://claude.com/claude-code)
   Do not merge it, do not enable auto-merge, do not request reviewers.
3. Report the pushed commit hash, the PR URL, and the PR number.`,
    { label: 'push', phase: 'Push', model: SONNET, schema: RESULT })
}

// ---------------------------------------------------------------------------
// Phase 7: Report.
// ---------------------------------------------------------------------------
phase('Report')
const report = await agent(`Write the launch-prep report for the owner from these agent results.
Plain, formal English, no emoji, no em dashes. Sections: Summary (3 lines: is ${RELEASE_BRANCH}
ready to push, yes or no and why); What changed (by area, with paths); Tests (every check and
smoke case with its result); Screenshots (where the before and after sets are, how many);
Not done or not verified (every notDone line, deduplicated); Owner decisions and hand checks
(every needsOwner line, deduplicated, plus: run docs/release-checklist.md; rename the GitHub
repo to ${GH_REPO}; merge the PR, then tag v${VERSION} on main, which starts the release
workflow; deploy the site only after the release has its DMG; decide on deleting the old
Tempo data folders). Say plainly whether ${RELEASE_BRANCH} was pushed and give the PR URL,
or why it was not pushed. Write it to ${ARCHIVE}/launch-report-${DATE}.md and return the full text.

Results:
${JSON.stringify(results, null, 2)}`,
  { label: 'report', phase: 'Report', model: HAIKU })

return { report, results }
