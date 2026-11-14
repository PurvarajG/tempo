# Tempo v2 overnight build plan

Written 2026-11-12 against commit `dcfc75c` on `redesign/v2-audit`.
Status: **phases 0 to 5 are committed. Revised 2026-11-12 after the owner's review**: the
first run looked like v1 with new colours. Rule 13, Phase 5F and the changes in section 6
(design briefing, fidelity pass, a visual auditor that compares with the mockup) are the response.

Router and orchestrator: Opus 5.5 (two separate agents). Workers: Sonnet 5.5 (anything needing
judgement) and Haiku 5.5 (mechanical work, gates, commits). Auditors:
Sonnet 5.5. The loop itself is the script
`.claude/workflows/tempo-v2-build.js`.

Read with: [README.md](README.md), [redesign_current_ui_problems.md](redesign_current_ui_problems.md)
(the brief), [v2_design/final/soft.html](v2_design/final/soft.html) (the target).

---

## 1. What was checked before writing this

Everything below was read or run on 2026-11-12, not assumed.

| Fact | Source |
|---|---|
| Target design is Soft Studio: 5 screens (Today, Next 7 days, Calendar week, Tracking, project board), light and dark | `v2_design/final/soft.html` (760 lines, read in full) |
| Not mocked: Settings, Search, Trash, Completed, All tasks, task panel, dialogs, tracking settings | `rebuild/README.md`, confirmed in the mockup |
| 46 problems under 8 root causes; section 5 is the keep list; section 6 is five v1 bugs | `redesign_current_ui_problems.md` (read in full) |
| Feature research: 7 batches, most need schema changes. All 7 are in scope | `redesign_features.md` (read in full) |
| Stack: Next 16.3.0 (App Router, Turbopack), React 19.2.8, Tailwind v4 with tokens in `@theme` in `app/globals.css`, PGlite, Electron 43.4, Node 26 arm64 | `package.json`, `AGENTS.md` |
| Code size: about 24k lines. UI is `app/` (16 pages), `components/` (about 70 files). Data is `lib/` + `app/api/` (40 routes) | `git ls-files` |
| One client store (`useTasks()` in `lib/store-context/`) feeds every screen | `lib/store-context/index.tsx` |
| **`npm run build` and `npx tsc --noEmit` both fail today.** 19 errors, all in `rebuild/v2_design/explorations/stageshow/src/*.tsx` (imports `lucide-react` and `kit`, which are not installed). Commit `a865d9e` put those files inside `tsconfig.json`'s `**/*.tsx` include | ran both |
| Unit tests: 224 pass. UI tests: 141 pass in 24 files | ran `npm run test:unit`, `npm run test:ui` |
| Lint: 9 errors already (5 in `app/upcoming/page.tsx`, 3 in `lib/usePickerMenu.ts`, 1 in `tests/electron-after-pack.test.ts`) | ran `npm run lint` |
| Dev port is 4700, registered to `tempo`, nothing listening. The port change in `package.json` and `.claude/launch.json` is uncommitted | `port-check tempo`, `git diff` |
| Agent roster in `.claude/agents/`: `tempo-builder` is Sonnet but points at a plan file that no longer exists (`~/.claude/plans/couple-of-ui-problems-validated-trinket.md`). All five auditors are set to `model: opus` and check the phases of that old plan | read the files |
| Electron window: `minWidth: 900`, `titleBarStyle: hiddenInset`, traffic lights at x18 y20, `vibrancy: "sidebar"`, transparent background. Splash HTML still uses the blue gradient mark | `electron/main.js:77,594-608` |
| Real app data lives in `~/Library/Application Support/Tempo/pglite`. Dev default is `.data/pglite`. `.data/lab` contains sync duplicates (`base 2`, `base 3`) and should not be trusted | `lib/db.ts:31`, `ls .data/lab` |
| Tempo is Mac-only. No mobile layouts | memory, `rebuild/README.md` |

### Where the mockup shows things the app cannot do

The mockup's content is invented. A builder that copies it literally will
invent features. Each item below has a ruling.

| In the mockup | Reality | Ruling for tonight |
|---|---|---|
| Sidebar project tree ("Sabha venue", "Add list") | No list entity. Projects have kanban stages only | Cut. Projects are flat rows with letter logo and open count |
| "2 files", "3 files" on tasks | No attachments | Cut |
| Priority "High" / "Medium" flags | `priority` is 0 to 3 | 1 = High, 2 = Medium, 3 = Low, 0 = no badge |
| KPI sparklines and "vs last Thu" | Planned per day and tracked per day can be derived from `tasks` and `timeEntries`. Overdue history cannot | Sparkline on Planned and Tracked only. Others show value and footer, no sparkline |
| KPI "Overdue 2 tasks, oldest 57 days" | This is the shame framing that P-04 and RC3 reject | Replace with "Carried over" and a count. No age. Footer: "Reschedule" link to the section |
| Momentum paragraph ("You have cleared the small things...") | No text generation in the app | Rule-based sentence from a new pure function `lib/momentum.ts` (4 to 6 templates, unit-tested). No LLM call |
| "This afternoon" schedule with a free slot | Not stored | Derived by a new pure function `lib/day-plan.ts`: timed tasks at their `dueTime`, the rest packed in list order from now to waking end. Free blocks shown, "fits X" hint only when one open task fits |
| Today tabs: List, Board, Day | List and an hour grid exist. No Today board | List and Day only. No Board tab |
| Next 7 days tabs: List, Board, Calendar | Only the day list is designed | No tabs. A "Calendar" button links to `/calendar?view=week` |
| Project tabs: Calendar, Board, List | Board exists | Board and List. No Calendar tab |
| Project "Event in 122 days" | Projects have no date | Replace the fourth stat with "Open tasks" |
| Bell button | No notification centre | Cut |
| Search pill with Cmd+K | Search is a route, not live | Build a command palette (Phase 10). The pill opens it |
| Avatar, name, "Settings & sync" | Single owner, no account | A plain "Settings" row. No name, no avatar |
| Tracking screen is analytics only | The real page is also the input surface: start an activity, fill gaps, edit records. That is on the keep list | Mockup layout on top (KPIs, chart, by project, recent entries). Now, Unaccounted and Day ribbon stay as cards below, restyled |
| Calendar "tracked" striped blocks | Calendar shows tasks and iCloud events today | Add tracked blocks from `timeEntries`. Read-only |
| Hours 08:00 to 19:00 | Waking hours are in tracking settings | Use `wakingStartHour` to `wakingEndHour` |
| 11px text (`.cap`, axis labels, chips) | P-26: text under 12px is a recorded problem | 11px only for the mono uppercase caption style. Everything else 12px or more |
| "Add a task — try ..." placeholder | Em dashes in copy are a recorded problem | "Add a task. Try: Call printer 20m tomorrow #MSM26" |
| Amber `--med`, ochre `--ph` | You said no orange (2026-11-12). Stored project colour 5 is `#ea580c` | Keep the mockup's amber for Medium priority only. Remap project token 5 to a non-orange hue. The stored hex does not change |

---

## 2. Decisions this plan assumes

These are my defaults. Change any of them before the run starts.

1. **UI rebuild plus all seven feature batches** from [redesign_features.md](redesign_features.md) (your decision, 2026-11-12). The UI layer is rebuilt. `lib/`, `app/api/` and `electron/` are changed only in the phases that name them (4A, 5A, 10A to 10D).
2. **Features are woven in, not bolted on after.** The data changes land in Phase 4A, before any screen is rebuilt, so each screen is built once against the final data model. This matters most for the inbox: making `scheduled` nullable touches every date view.
3. **Schema changes are additive and idempotent**, as `lib/schema.sql` already requires. The one destructive-looking step, moving Quick list items into the inbox, copies rows and keeps the `quick_todos` table. The real database is still never opened overnight. It is first migrated when you launch the new build yourself, after a backup (section 8).
4. **Where the features doc and the final design disagree, the design wins.** The features doc draws a separate "Up next" hero above "Today's 3". You rejected a single-task hero. So Up next stays the first, raised row of the Today card, and carries the new reasons and actions.
5. **Open choices in the features doc (its section 6), taken at its defaults:** capture shortcut Ctrl+Option+Space (changeable in Settings); Quick list merges into the inbox; Today cap is 3 (1, 3 or 5 in Settings); `11/12` reads as day/month; Claude awareness is built but off by default.
6. **The five v1 bugs are fixed inside v2**, not on v1 first: P-40, P-03, P-31, P-30, P-23/P-24, plus the repeating-task bug (features doc 2.1).
7. **This is more than one night.** 18 phases at 30 to 50 minutes is 9 to 15 hours. The order puts what you use daily first. Phases 10A to 10D are self-contained and are what spills into a second night (section 6).
8. **One branch, one checkout.** New branch `redesign/v2-build` from `redesign/v2-audit`. One commit per passing phase. Never pushed, never merged, no release, no `electron:pack`.
9. **Lab data only.** Every dev server and screenshot runs against a fresh seeded database in `.data/v2-lab`. The real database is never opened, so screenshots can be committed.
10. **The Notepad stays** on Today as a collapsed card. The Quick list goes (decision 5).
11. **Old auditors are retired for this run.** They check a finished plan and are pinned to Opus. Phase 0 replaces them with three Sonnet auditors and one Haiku checker written for this plan.

---

## 3. Rules for every agent

1. Read this file, then your phase section, before writing anything. Read `node_modules/next/dist/docs/` before writing App Router code (`AGENTS.md` requires it).
2. Do your phase only. Touch only the files your phase lists under "Owns". Need a change elsewhere? Write it under "Requests" in your report. Do not make it.
3. Never open, copy or point a process at `~/Library/Application Support/Tempo`. Servers start only as `LAB_MODE=1 PGLITE_DIR=.data/v2-lab npx next dev -p 4700`. Never use ports 3000, 3001, 5000, 5173, 7000, 8000 or 8080. Stop the server when your phase ends.
4. Never push, merge, tag, publish, run `electron:pack` or `electron:build`, or edit `.claude/agents/`. `lib/schema.sql`, `lib/migrate.ts`, `lib/store/`, `app/api/` and `electron/` may be edited only by a phase that lists them under "Owns".
4a. Schema rules: `add column if not exists`, `create table if not exists`, nullable or defaulted, safe to run twice. Backfills go in `lib/migrate.ts`. Never `drop`, never rewrite existing rows except the named backfills. Every schema change gets a case in `tests/migration-populated.test.ts` that migrates a populated v0.1.3 database twice and checks no row was lost.
4b. Nothing in the main process writes outside the app's own data folder. The Claude session scanner (10D) opens files read-only.
5. No new npm dependencies. Icons come from the sprite in Phase 1.
6. No colour, radius, shadow or font size written by hand in a component. Tokens only.
7. Do not copy mockup content. Section 1's table decides what is real.
8. Unit tests in `tests/*.test.ts` are never edited to make them pass, except to add cases for a named lib change. A UI test for a component you delete is replaced by a test of the same behaviour on the new component. Deleting a behaviour test without a replacement is a BLOCK.
9. Every capability you move or remove gets a line in `rebuild/v2_build/ledger.md`: `preserved`, `moved to <file>` or `removed: <reason from this plan>`.
10. A phase is done only when `scripts/v2-gates.sh` exits 0. Paste its last lines in your report. If you cannot get there, say so. Do not claim success.
11. Builders do not commit. The orchestrator commits after the auditor passes.
12. Sub-agents: Sonnet or Haiku only.
13. **Look at the mockup first, and again before you finish.** Read `rebuild/v2_build/design-brief.md`, then open the reference shot of your screen in `rebuild/v2_build/reference/` (it is an image). For every visible element you build or review, check its form against the mockup: chip or plain text, filled or ghost, visible or collapsed, size, padding, gap. Matching the tokens is not enough. An element that differs in form from the mockup is a P1 and blocks the phase. What may differ is listed at the end of the brief.

Copy rules (RC3, RC7), enforced by the Haiku sweep:

| Use | Never |
|---|---|
| Trash, "Move to trash", "Delete forever" | Let go, Let it go |
| Done, "Mark done" | Mark complete, What you've shipped |
| Next 7 days | What's coming |
| "Carried over" | Overdue as a headline, "Sat here N days", "N d waiting" |
| "Not today" (moves to tomorrow) | Still doing it |
| "Start", "Stop" (one timer vocabulary) | Timing, Focused activity |
| Durations as `1h 30m`, `45m` | `36M`, `960M` |
| Dates as `Thu 12 Nov`; `12 Nov 2026` when the year matters | `9/11`, `TUE 25 AUG`, ISO dates in visible or announced text |
| Full stops and commas | Em dashes, en dashes, middle-dot separators in sentences |
| | untracked, unaccounted, coverage, taxonomy, roll-ups, signals, "More than fits" |

---

## 4. Design system to build (from `soft.html`)

Phase 1 turns this into tokens. Later phases only consume it.

**Colour tokens** (light, dark). Keep the existing structure: one `--dark-*`
block feeding both `:root[data-theme="dark"]` and
`@media (prefers-color-scheme: dark) :root:not([data-theme="light"])`.

| Token | Light | Dark | Job |
|---|---|---|---|
| `shell` | `rgba(246,246,243,.78)` | `rgba(18,19,24,.72)` | Window and sidebar, over vibrancy |
| `surface` | `#ffffff` | `#17181c` | Main panel, cards |
| `raised` | `#ffffff` | `#1d1e23` | Active nav, active tab, Up next row |
| `sunk` | `#f1f1ee` | `#202127` | Tab track, lanes, table head, inputs at rest |
| `ink` / `ink-2` / `ink-3` / `ink-dim` | `#141519` / `#4f5159` / `#64666d` / `#8d8f97` | `#ededef` / `#a6a8b0` / `#8d8f97` / `#75777f` | Text. `ink-dim` only for the second tone of an H1 |
| `line` / `line-2` | `rgba(20,21,25,.07)` / `.12` | `rgba(255,255,255,.06)` / `.11` | Hairlines, control outlines |
| `accent` / `accent-ink` / `accent-soft` | `#4a4ae8` / `#fff` / `rgba(74,74,232,.09)` | `#7d7eff` / `#0b0b18` / `rgba(125,126,255,.14)` | One accent. Primary button, now line, today, focus ring |
| `hi` / `hi-bg`, `med` / `med-bg`, `ok` | as in `soft.html:24-26` | as in `soft.html:40-42` | High, Medium, running or positive |
| `off`, `glow-a`, `glow-b` | as in `soft.html:28` | as in `soft.html:42` | Empty ticks, Momentum glow |
| `shadow-sm`, `shadow-md` | as in `soft.html:29-30` | as in `soft.html:44-45` | Two shadows only |

Secondary text uses `ink-2` or `ink-3`. **Never an opacity modifier on a text
colour.** Every text pair must reach 4.5:1 and every control outline 3:1, in
both themes. `accent-ink` on `accent` is dark text in dark mode, which is what
fixes P-24.

Project tokens `--color-project-1..7` and category tokens `--color-cat-*` keep
their names and are retuned to sit with the palette (start from `--pm`, `--pc`,
`--ph`). No orange.

**Type.** Geist (UI), Geist Mono (numerals, durations, clock, the caption
style), Instrument Serif (the Momentum heading only). Loaded with
`next/font/google`. Calistoga and JetBrains Mono are removed in Phase 11.

| Role | Size / weight |
|---|---|
| H1 | 34 / 500, tracking -0.035em. Second tone 400 in `ink-dim` |
| Momentum heading | 34 Instrument Serif |
| Big figure | 36 / 500 |
| KPI value | 24 / 500 mono |
| Up next title | 17 / 500 |
| Card title, nav item | 15 / 500 |
| Body, task title | 14 (task title 500) |
| Secondary | 13 |
| Meta | 12 |
| Caption | 11 mono uppercase, tracking 0.07em. Labels only, never on a button |

**Radius.** 6 (checkbox), 8 (small icon tile), 10 (kanban card, tab),
12 (row, nav item, input), 14 (composer, tab track), 18 (card, lane),
22 (main panel), pill (buttons, chips, search). A child's radius is its
parent's minus the padding between them.

**Spacing.** 4, 8, 12, 16, 24, 32. Page padding 32. Card gap 16. Section gap 24.

**Motion.** 150ms ease-out for colour and shadow. 200ms for tabs. Pressed
state `scale(.97)` on primary buttons. Keep the global reduced-motion rule.
No `transition-all`. No looping animation except the running-timer dot.

**Global rules in `globals.css`.** One `:focus-visible` rule (2px `accent`,
offset 2px) and no component-level `outline-none`. Hover styles inside
`@media (hover: hover)`. Thin scrollbars.

**Window.** The mockup's coloured backdrop and 28px outer radius are only the
mockup's frame. In the app the Electron window is the frame: sidebar on
`shell` over the existing vibrancy, main panel on `surface` inset 8px with
radius 22. Sidebar 264px, collapsible to 0 with the state remembered. Keep the
36px drag band and `.no-drag` on every control inside it. The sidebar's first
row clears the traffic lights.

---

## 5. Phases

Each phase lists what it owns, what it must deliver and which problems it
closes. "Done when" items are what the auditor checks.

### Phase 0. Make the baseline green and set up the rails

Owner: orchestrator (Sonnet), with Haiku readers.

- Create branch `redesign/v2-build`. Commit the pending port change.
- Add `"rebuild"` to `exclude` in `tsconfig.json` and `rebuild/**` to `globalIgnores` in `eslint.config.mjs`. Confirm `npm run build` and `npx tsc --noEmit` pass.
- Agent roster: nothing in `.claude/agents/` changes. The workflow script carries the prompts for the router, workers, checker and the four auditors (plan, visual, data, shell), so the old `tempo-*` agents are simply not used.
- `scripts/seed-v2-lab.ts`: same two guards as `scripts/seed-lab.ts`. Seeds `.data/v2-lab` with 3 fictional projects, about 30 tasks (today, next 7 days, 4 carried over, done today, repeating, timed, multi-day, with subtasks), time entries and segments for 28 days. Delete and reseed at the start of every phase. Phase 4A extends it with undated, committed, hidden-until, expiring and blocked tasks, and 3 quick-list items to migrate.
- A populated v0.1.3 fixture for the migration tests: seed a database with the current schema at commit `dcfc75c` and keep it under `tests/fixtures/` (fictional data only).
- `scripts/v2-shots.mjs`: Electron offscreen capture (`show: false`, `offscreen: true`, `capturePage()`) of every route in light and dark at 1440x900 and 900x700, into `rebuild/v2_build/shots/<phase>/`. Also captures `soft.html` once (`#today`, `#week`, `#calendar`, `#tracking`, `#project`, both themes) into `rebuild/v2_build/reference/`.
- `scripts/v2-gates.sh`: runs build, tsc, unit tests, UI tests, then the greps listed in section 7. Takes the phase number so the grep limits tighten over time.
- `rebuild/v2_build/ledger.md`: a capability checklist of the current UI. Haiku readers take one group each (shell and sidebar; Today; task row, panel, quick add; calendar; kanban and project; tracking; settings and the small routes) and list every user-visible capability with file and line, using `docs/tempo-focus-ledger.md` and `current-ui-audit/D-interaction.md` as a cross-check. A Sonnet agent merges and de-duplicates.

Done when: build, tsc and both test suites pass; reference shots exist; the ledger has a row for every component in `components/` and page in `app/`.

### Phase 1. Tokens, type, icons, primitives

Owns: `app/globals.css`, `app/layout.tsx` (fonts only), `components/ui/*` (new files), `tests/ui/` for the new primitives.

- Section 4 as `@theme` tokens. **Old token names stay defined, remapped to the nearest v2 value**, so untouched screens keep rendering until their phase. Phase 11 deletes them.
- Global focus, hover and motion rules.
- `components/ui/Icon.tsx`: one inline SVG sprite with the 22 symbols in `soft.html:394-416`, 1.5px stroke, `currentColor`. Replaces Unicode glyphs as screens are rebuilt (P-21).
- Primitives, each with pressed, disabled, focus and loading states where it applies: `Button` (primary, ghost, chip), `IconButton`, `Segmented`, `Card` + `CardHeader`, `Input`, `Checkbox`, `PriorityBadge`, `Pill`, `Caption`, `Ticks`, `Kpi`, `Spark`, `EmptyState`, `Kbd`, `Menu` (on the existing `lib/usePickerMenu.ts`), `Dialog`.
- A dev-only page `app/_v2/page.tsx` showing every primitive in every state, both themes, for the screenshot check.

Closes: RC4, RC5, P-12 to P-15, P-17 to P-19, P-21, P-23 to P-25, P-27, P-28, P-32.
Done when: contrast pairs in section 4 are verified by computed values in both themes; the primitives page matches the mockup's components.

### Phase 2. Window shell and navigation

Owns: `components/AppChrome.tsx`, `Sidebar.tsx`, `ThemeToggle.tsx`, `TempoMark.tsx`, `TimerStrip.tsx`, `components/ui/PageShell.tsx` (replaced by `PageHead.tsx`), `electron/main.js` (splash colours only).

- Shell as in section 4. Top bar: breadcrumb, search pill (opens `/search` until Phase 10), theme toggle. No bell.
- Sidebar groups: **Main** (Today, Next 7 days, Calendar, Tracking, with counts), **Projects** (letter logo in the project colour, open count, New project), **More** (All tasks, Completed, Trash, visible by default), then the timer card and a Settings row at the bottom. The hidden-nav setting keeps working.
- Timer card in the sidebar replaces the floating pill. When the sidebar is collapsed, a compact timer sits in the top bar. Nothing floats over page content (P-33).
- `PageHead`: two-tone H1, one plain sentence, actions slot wrapped in `.no-drag`. Every page is moved onto it with its old body untouched.
- New mark: dark rounded square with four dots, one in the accent.

Closes: RC2, RC7 (structure), RC8, P-11, P-16, P-20, P-22, P-33 to P-35, P-45.
Done when: window drags from the top band and the sidebar; every control in the band clicks; three theme states render; at 900px wide nothing clips.

### Phase 3. Undo and feedback

Owns: `components/ui/UndoBar.tsx`, `lib/store-context/use-undo.ts` and its wiring in `index.tsx`, `components/ErrorToast.tsx`, `TimerConflict.tsx`, `components/ui/SidePanel.tsx`, `DesktopBridge.tsx` (Cmd+Z only).

- `offerUndo(label, revert, action?)`: one line at the bottom of the main panel for 6 seconds. A new offer replaces the old one. Cmd+Z triggers it when focus is not in a text field. The optional `action` is a second button, used later for "Start timer?" and "Unblocked X" (features 1.4, 3.4, 4.6).
- Wired to: done (revert reopens, and removes the repeat copy if one was made), trash, Not today and any date change, restore, stage move. Later phases wire their own bulk actions with one undo for the whole batch.
- One overlay stack so Esc closes the top layer only (P-31). The timer-switch dialog uses `Dialog` with short labels: "Switch" and "Keep current".
- "Saved" cue for autosave fields.

Closes: RC6, P-29, P-31, P-32.
Done when: each wired action shows the bar and Undo restores the exact prior state, covered by UI tests.

### Phase 4A. Data layer for the features (no UI)

Owns: `lib/schema.sql`, `lib/migrate.ts`, `lib/types.ts`, `lib/store/*`, `lib/store-context/*`, `lib/parse.ts`, `lib/summary.ts`, `lib/focus.ts`, `lib/week-capacity.ts`, `lib/ics.ts`, `lib/validate.ts`, `app/api/**`, new `lib/next.ts`, `tests/*.test.ts`. Audited by the data auditor.

Everything here is pure or store code with unit tests. Screens come later and only consume it. Existing screens must still compile: where a type widens, add the smallest guard, not a redesign.

| Change | Features doc | Detail |
|---|---|---|
| `tasks.scheduled` nullable, inbox index | 2.2 | `Task.scheduled: string \| null`. Audit every comparison: Today, Upcoming, calendar, `week-capacity.ts`, `focus.ts`, `summary.ts`, the ICS feed. Undated tasks are excluded from every date view |
| `tasks.committed_on date` | 3.1 | `commitTask(id, day)`, `uncommitTask(id)`; cap read from settings |
| `tasks.start_on`, `tasks.expires_on` | 3.3 | Hidden-until filter helper; `expireDueTasks(today)` moves expired open tasks to trash and returns them |
| `task_links` table | 3.4 | `linkBlocker`, `unlinkBlocker`; tasks carry `blockedBy: string[]` |
| `tasks.stage_entered_at` | 4.4 | Set on every stage change in the store; backfill from `created_at` |
| `project_stages.wip_limit` | 4.5 | Nullable integer |
| `day_reviews` table | 5.1 | `day`, `energy`, `note` |
| Settings columns | 1.5, 2.1, 3.1, 4.1, 5.1, 6 | `today_cap` (3), `dock_badge` ('today'), `capture_shortcut`, `nudge_minutes` (null = off), `wrap_hour` (17), `weekly_reset_day` (0), `claude_awareness` (false), `date_order` ('dmy') |
| `Recurrence.from` | 1.3 | `nextOccurrence(fromISO, r, todayISO)` rolls forward past today, or counts from the done date. `weekly!` and `weekly when done` tokens |
| More date tokens | 2.4 | `nov12`, `12nov`, `11/12`, ISO, `next week`, `in 2w`, `+2w`, `eow`, `wknd`, `nodate`/`inbox`, `from:`, `until:`, `!10m`, `*`. Next-year wrap tested |
| `parseQuickAdd` returns `scheduled: undefined` with no day token | 2.2 | The caller decides the default |
| `addTasks(inputs[])`, `rescheduleTasks(ids, day)` | 1.1, 2.3 | One transaction each, via `withTransaction` |
| `splitSegmentAt(id, at)` | 4.2 | One transaction |
| `lib/next.ts` `suggest(tasks, now, runningTaskId)` | 3.2 | Fixed weights from the features doc table. Returns the task and up to two reasons. One suggestion per project. `lib/focus.ts` calls it for the project focus task |
| Quick list migration | 2.2 | In `migrate.ts`, once, guarded by a flag column: copy each undone `quick_todos` row into `tasks` with `scheduled = null`. The table stays |

Done when: both test suites pass; the populated-fixture migration test passes twice in a row; `tsc` passes with `scheduled` nullable; no screen behaves differently yet apart from the parser fixes.

### Phase 4. Task row, quick add, task panel

Built and committed (`07cbf0e`). Phase 5F below corrects the look of the row meta and the composer.

Owns: `components/TaskRow.tsx`, `QuickAdd.tsx`, `TaskPanel.tsx`, `SubtaskList.tsx`, `TaskTime.tsx`, `TimerButton.tsx`, new `components/ui/PostponeButton.tsx`, `lib/format.ts`, their tests.

Feature additions in this phase:

- `PostponeButton` (1.2): click moves to tomorrow; right-click or long press opens a menu with the next 6 weekdays, "Next week" and "No date". Used on every row and on Up next.
- Brain dump (2.3): pasting several lines into the composer shows "Add N tasks?" with a preview list, saved in one call with one undo.
- Task panel "More" group gains: "Repeat from: the schedule / when I finish it" (1.3), "Hide until" and "Expires" dates (3.3), "Blocked by" search picker (3.4). A blocked row shows "Waiting on X".
- Row meta shows the repeat mode and, for hidden-until tasks in All tasks and boards, "From 14 Nov" dimmed.

- Row as `soft.html:523-538`: checkbox, title, one meta line (priority, project, estimate, due time, repeat), estimate on the right. Row actions are icon buttons with labels, shown on hover and on focus, plus a `...` menu. Title is a button with `min-w-0` so it can never collapse to 0px (P-40).
- Composer as `soft.html:497-501`. As you type, parsed tokens appear as chips (date, estimate, priority, project, repeat). A `#name` that matches no project shows a "New project: name" chip and creates it only on Enter with that chip present; Backspace on the chip drops it (P-30). After Enter on a task dated another day, the undo bar says where it went.
- Parser fixes land in 4A. This phase only shows their result as chips.
- Task panel order (P-38): title, Start and tracked time, date and time, estimate, priority, project and column (column only when a project is set), notes, subtasks (added in typed order), then a "More" group: repeat, tags, multi-day. Footer: Mark done on the left, Move to trash on the right, apart.
- One date formatter and one duration formatter in `lib/format.ts`, used everywhere.

Closes: P-05, P-30, P-38, P-40, section 4.3 formatting.

### Phase 5. Today

Built and committed (`c62c753`). Phase 5F below corrects its look and overrides the bullets here on the capacity strip, Up next actions, "Could also do" and Done today.

Owns: `app/page.tsx`, `components/Today.tsx`, `components/today/*`, `components/ui/FocusCard.tsx`, `MetricStrip.tsx`, `RailPanel.tsx`, `AttentionPanel.tsx`, `CollapsedBar.tsx`, new `lib/momentum.ts`, `lib/day-plan.ts`, `lib/today.ts`.

- Layout as `soft.html:471-581`: head (weekday, date in the second tone, one sentence), 4 KPIs (Planned, Tracked, Free today, Carried over), then composer and the Today card on the left, and Momentum, the day schedule and Tracked this week on the right.
- `lib/today.ts` (pure, tested): `planned` is `scheduled === today`; `carried` is earlier. Capacity counts `planned` only and ends at `wakingEndHour` from tracking settings, with `DAY_END_HOUR` as the fallback. After the day ends the header says "Day's done" instead of a warning (P-03).
- Today card, top to bottom (features 1.1, 3.1, 3.2, adapted per decision 4):
  - **Up next**, the first row, raised. Chosen by `suggest()`. Shows up to two reasons as meta ("Due 3pm", "Unblocks 2"), never a score. Actions: Start, Focus (added in 10A), Not today (`PostponeButton`), Something else (shows the next suggestion, remembered for the session). Clickable title.
  - **Today's 3**: the committed tasks. A star on any row commits it. A fourth shows "Swap with..." and the current three; it never fails silently.
  - **Could also do, N**: the rest of today's planned tasks, collapsed.
  - **Carried over, N**: collapsed, with Today, Tomorrow and Trash on each row, and "Move all to today" and "Move all to tomorrow" in its header (one transaction, one undo). No ages shown. The 7-day stale prompt lives only here.
  - **Inbox, N**: one line linking to `/inbox`, only when N is above 0.
  - **Done today** with the total.
- Capacity ticks: committed time solid, planned but uncommitted as a lighter segment.
- After `wrap_hour` a "Wrap up the day" button appears in the head (target built in 10B; hidden until then).
- Each task appears once on the screen (P-06).
- Tabs: List and Day. Day is the existing hour grid with drag kept (`lib/useTimelineDrag.ts`). The 1 to 14 day range slider is removed (P-08, ledger line).
- Notepad: one collapsed card under the right column. `components/today/QuickTodos.tsx` is removed (ledger: moved to the inbox).
- Empty states: nothing planned ("Nothing planned for today." plus the carried-over link when there is any) and all done ("All done for today." with the count and tracked time).

Closes: RC1, RC3, P-01 to P-10. Features 1.1, 1.5 (day end), 3.1, 3.2.

### Phase 5F. Mockup fidelity: task row, composer, Today

Added 2026-11-12. Phases 4 and 5 built the right features in the wrong form.
This phase changes how they look, not what they do. It runs before any other
screen is built, because every later screen reuses the row, the composer and
the cards. **Where this section and Phase 4 or 5 disagree, this section wins.**
The run pauses after this phase for the owner to review the screenshots.

Owns: `components/TaskRow.tsx`, `QuickAdd.tsx`, `TimerButton.tsx`, `Today.tsx`, `components/today/*`, `components/ui/Button.tsx`, `Pill.tsx`, `PriorityBadge.tsx`, `Kpi.tsx`, `Ticks.tsx`, `Card.tsx`, `PageHead.tsx`, `PostponeButton.tsx`, `app/globals.css` (additions only), and the `tests/ui/` files for these.

Reference: `rebuild/v2_build/reference/today-*.png`, `soft.html:471-581`, CSS `soft.html:133-242`. Last build shots: `rebuild/v2_build/shots/5-fix1/today-*.png`.

Task row (used on every screen):

- Meta line as `soft.html:511-516`: priority is a tinted pill with a flag icon ("High", "Medium"; Low is plain); project is its colour dot or square then the name; estimate, due time and repeat each get their icon; tags are outlined pills. 12px, gap 12. No fact is plain run-on text.
- Estimate on the right in mono, as `.est`. Row grid, padding, radius and the hairline between rows as `.task`.
- Hover actions stay, and still reserve no width.

Composer:

- 52px, radius 14, hairline outline at rest, accent ring only on focus, as `.composer`.
- At rest it shows the three hint chips on the right as `soft.html:500` (`20m`, `p1`, `#project`). While typing, the parsed tokens replace them as chips (Phase 4 behaviour, unchanged).
- No separate add button inside the field.

Today:

- Page rhythm as `.page`: 24px between the head, the KPI row and the grid. The sentence sits 8px under the H1 and never touches the KPIs.
- **The full-width capacity strip under the KPIs is removed.** The mockup has none. Capacity is carried by the "Free today" KPI: when over, its value reads "Over by 1h 20m" in ink, never red. `CapacityTicks` stays in the repo for Phase 6, which uses a tick bar per day.
- Up next row as `.task.next`: "Up next" tag in sentence case in an `accent-soft` pill; title 17px; meta as chips; on the right, centred vertically, "Not today" as a ghost button and then "Start" as the filled accent pill with the play icon. "Something else" moves into the row's `...` menu.
- **Today's open tasks are visible rows.** The collapsed "Could also do" group is removed. If any tasks are committed, they come first under a small "Today's 3" header line (styled as `.sub`), and the rest follow under "Also today, N", open. If none are committed there are no headers and no hint block: just the rows, each with its star.
- Carried over stays a collapsed line (those are not today's tasks). Its "Move all" actions show only when it is open.
- Done today is open, as `soft.html:539-543`: header line with the count and the total, then the rows. This is what `tests/ui/today-card.test.tsx` "all done shows count and tracked time" already expects, and it is the one red test the phase starts with. Fix the component, not the test.
- Momentum as `.mom`: the glow across the top (`glow-a`, `glow-b`), a filled accent icon tile, the caption, 72px of air above the serif heading, then the paragraph, the `sunk` progress block and the footer.
- KPI cards, the card header (icon tile, label, count) and the schedule blocks checked against `.kpi`, `.card-h` and `.blk`, and corrected where they differ.

No behaviour changes, no store or lib changes, no copy changes beyond the above. Tests change only where visible text or structure named here changes.

Done when: the visual auditor's element-by-element comparison of `today` against the reference has no P0 or P1 in either theme at both sizes; every item under "Mistakes already made" in the design brief is gone; the gate is green.

### Phase 5A. Inbox

Owns: new `app/inbox/page.tsx`, `components/Sidebar.tsx` (one nav row), `components/QuickAdd.tsx` (a `defaultDate` prop only), `scripts/v2-shots.mjs` (add `/inbox` to the routes).

- Sidebar: Inbox under Main with its count, Cmd+0.
- Each row: Today, Pick a day (`PostponeButton` menu), Trash.
- Composer here defaults to no date. On Today it still defaults to today.
- Empty state: a "Brain dump" textarea, one task per line, same preview and single undo as the paste flow.

Features 2.2, 2.3.

### Phase 6. Next 7 days

Owns: `app/upcoming/page.tsx`, `lib/week-capacity.ts` (additions only).

- Day rows as `soft.html:621-642`: big date numeral, tasks with checkbox and project dot, capacity as "1h 35m of 6h" with tick bar. Over-capacity days turn the bar `hi` and say "Over by 1h 20m".
- A "Carried over" row at the top when there is any (P-42). The header sentence is derived from real counts and agrees with Today (P-07).
- Empty day: "Nothing planned yet." plus, when `suggest()` has an undated or carried task that fits the day's free time, a "Plan it for Wednesday" chip as in `soft.html:637`.
- Fix the 5 existing lint errors in this file as part of the rewrite.

Closes: P-07, P-40, P-42.

### Phase 7. Calendar

Owns: `app/calendar/page.tsx`, `components/calendar/*`, `components/time/HourGrid.tsx`.

- Week view as `soft.html:643-658`. Day and Month restyled in the same language. Head: month in H1, year in the second tone; previous, Today, next; Day, Week, Month tabs. View and date still round-trip through the URL.
- Week starts Monday everywhere. Week and Day open scrolled to `wakingStartHour`. Month shows only the rows it needs.
- Planned blocks solid, tracked blocks striped (from `timeEntries`, read-only), legend below.
- Keep: drag to reschedule with the live announcement (now with readable dates), click a day to add, external iCloud events, the day panel.

Closes: P-26, P-41.

### Phase 8. Project page and board

Owns: `app/projects/[id]/page.tsx`, `components/kanban/*`, `components/ProjectSettings.tsx`.

- Head: letter logo, name, one sentence. Tabs: Board, List.
- One summary card as `soft.html:593-601`: percent done with tick bar, Tracked, Left to plan, Open tasks. It replaces the two stat rows, the focus card and the Needs attention panel (ledger lines; the carried-over tasks show in the board with a quiet "Carried over" meta).
- Lanes on `sunk`, cards as `soft.html:603-618`: priority, title, date, tags, a dashed footer with estimate and tracked time, a progress bar when time is tracked, "Running" in `ok`. Done lane shows 2 and "Show N more". The board scrolls sideways with a visible fade when lanes overflow.
- Keep: drag between lanes, the `...` move menu, add, rename, reorder and remove stage (through `Dialog`).
- Card footer shows "3d here" after 3 days in a lane. Over 14 days in an active lane the card is listed in a quiet "Gone quiet" line under the summary card. Nothing moves or closes by itself (4.4).
- Lane header shows "3/3" when a limit is set, in `med` when over. A drop is never blocked. A limit set below the current count starts at the current count (4.5).
- Dropping a card into an active lane offers "Start timer?" in the undo bar. Moving the running task to a done or blocked lane stops its timer (4.6).

Closes: P-39. Features 4.4 to 4.6.

### Phase 9. Tracking

Owns: `app/tracking/page.tsx`, `components/tracking/**`, `lib/tracking-stats.ts` (additions only).

- Top as `soft.html:659-707`: head with range tabs (7, 28, 90 days), 4 KPIs (This week, Daily average, Plan accuracy, Sessions), "Time by day" dot-matrix chart with hover tooltip, "By project" bars, "Recent entries" table. The table is the existing Records module, so entries stay editable.
- Below: Now (start an activity), "Gaps today" (the Unaccounted module, renamed) and the Day ribbon, as cards. Module order, hide and collapse settings keep working.
- Page sentence: "Where your time went, next to what you planned." Vocabulary per section 3.
- One timer vocabulary shared with tasks: Start, Stop.

Closes: P-36, RC3 on this page.

### Phase 10. Remaining routes, command palette, shortcuts

Owns: `app/all`, `app/completed`, `app/trash`, `app/search`, `app/settings`, `app/tracking/settings`, `components/settings/*`, `components/tracking/settings/*`, `components/Reminders.tsx`, new `components/CommandPalette.tsx`, `components/ShortcutSheet.tsx`.

- All tasks, Completed, Trash: `PageHead`, one card, the Phase 4 row. Completed groups by day with the year when it is not this year, and rows offer only Reopen. Trash rows offer Restore and Delete forever (through `Dialog`, not `confirm()`). Restore shows the undo bar (P-43).
- Settings becomes one page with sections: Appearance (theme), Today (cap of 1, 3 or 5; wrap-up hour; weekly reset day; date order), Sidebar, Calendar feed, Tracking (the old `/tracking/settings` content; that route redirects), Desktop (capture shortcut, Dock badge, "not tracking" nudge, Claude awareness). Desktop options whose feature is not built yet are hidden, not disabled. Plain labels on every toggle (P-37).
- Command palette on Cmd+K and the search pill: live results over tasks and projects in memory, plus go-to commands and "New task". `/search` stays as a restyled page with live results and a real empty state (P-44).
- Keys, when focus is not in a field (Batch 7): `j`/`k` move, `x` or Space done, `t` tomorrow, `d` pick a date, `s` start or stop, `f` focus session, `*` commit, `e` or Enter open, Backspace trash, `/` focus quick add, `?` shortcut sheet (P-46).

Closes: P-34, P-37, P-43, P-44, P-46. Features Batch 7.

### Phase 10A. Focus session

Owns: `components/TimerStrip.tsx` (the sidebar timer card), `TimerButton.tsx`, `lib/store-context/use-time.ts`, `electron/main.js` and `preload.js` (one IPC, `tempo:attention`).

- Focus on Up next and on rows: starts the timer and a countdown of the remaining estimate, 5m minimum.
- When it runs out the timer keeps running. The timer card becomes "Time's up" with Done, +15m and Keep going, plus one native notification and one Dock bounce.
- Going over shows one neutral line. No red. No Pomodoro cycles.

Feature 3.5.

### Phase 10B. End-of-day wrap and weekly reset

Owns: new `app/wrap/page.tsx`, `components/wrap/*`, `lib/wrap.ts` (pure, tested), a menu item in `electron/main.js` (Cmd+Shift+E).

- One page, four parts, no wizard: Done today (count and focused time, one calm line); the three biggest estimate misses; energy 1 to 3 and an optional line (saved to `day_reviews`); Tomorrow, with Commit, Later and Trash on each row.
- Tasks that expired today are listed once, with undo.
- On the weekly reset day the page adds: brain dump box, inbox triage, "Gone quiet" (open tasks untouched for 14 days, with Keep, Push back a week, Trash) and three week numbers.
- No points, no streaks, no charts.

Features 5.1, 5.2, 3.3 (expiry notice).

### Phase 10C. Desktop: capture, tray, reminders, nudges

Owns: `electron/main.js`, `electron/preload.js`, `lib/desktop-bridge.ts`, `components/DesktopBridge.tsx`, `components/Reminders.tsx`, new `app/capture/page.tsx`. Audited by the desktop auditor.

- Global capture (2.1): `globalShortcut` registered on ready and unregistered on quit. Opens a 560x64 frameless always-on-top window on `/capture`: the composer only. Enter saves and closes; Shift+Enter saves and stays; Esc closes; losing focus with text saves to the inbox. No date token means inbox. If the shortcut cannot be registered, Settings says so.
- Tray right-click menu: Quick add, Start or stop timer, Open Tempo.
- Reminders move to the main process (4.3) so they fire with the window hidden: 10 minutes before and at the time, actions Start, Snooze 15m and Tomorrow, one repeat after 10 minutes. Fired state keyed by task id plus due time.
- "Not tracking" nudge (4.1): off by default, at most one per gap.
- Away prompt (4.2): on return from lock or 5 minutes idle while a timer runs, one dialog: Keep it on X, Mark as break, Discard.
- Dock badge (1.5): today's open tasks plus timed overdue, hidden at 0, or nothing.

Offscreen screenshots cannot prove any of this. The checker runs the unit tests for the pure parts (reminder schedule, nudge counter, idle split); the rest is on the morning checklist.

### Phase 10D. Claude Code awareness

Owns: new `electron/claude-sessions.js`, an IPC in `main.js` and `preload.js`, one card in `components/tracking/`. Audited by the desktop auditor.

- Off by default. When on: a read-only scan of `~/.claude/projects/*/*.jsonl` for project path, branch, first 80 characters of the last prompt and last message time.
- Active sessions appear on the day ribbon as a suggested block. One click accepts it. Nothing is written automatically.
- One "Claude is waiting in X" notification per wait.
- "Copy today's tasks as a prompt" button on Today's head menu.
- The auditor proves the scanner opens files read-only and nothing writes under `~/.claude/`.

Feature Batch 6.

### Phase 11. Clean-up and final check

Owns: whole UI layer, deletions only, plus `rebuild/v2_build/REPORT.md`.

- Delete old tokens, Calistoga, JetBrains Mono, `.gradient-text`, unused components, the `_v2` page, dead tests. Lint must be clean, including the 4 old errors outside the UI.
- Gates at final limits (section 7). Ledger: every row resolved.
- Final screenshots of every route. The visual auditor reviews all of them against the reference in one pass and lists differences by severity. Fix P0 and P1 differences only.
- Write the morning report (section 8).

### Phase 12. Shell fidelity to 99%, Inbox, owner decisions

Added 2026-11-13, revised the same day after the owner clarified the target.

**What 99% means.** The owner wants the *shell and the visual language* of
`soft.html` matched at 99%: the window, the glass sidebar, the sidebar foot,
the top bar, and the look of the shared parts (cards, KPI tiles, rows, chips,
buttons, segmented control, page head). **The content of the tiles and cards
is not a target.** The mockup's KPIs, numbers and card choices were
placeholders; where the app has its own features (Carried over, Focus, the
Tracking extras, the Claude ribbon), the app's features win and only their
styling must match the mockup's parts.

Inputs: `rebuild/v2_build/decisions.md`, `rebuild/v2_build/fidelity-gaps.md`
(use its shared-chrome and component items; skip items that are about tile
content), `rebuild/v2_build/reference/` (now includes `inbox-*`).

### Phase 12A. Shell to 99%

Owns: `components/Sidebar.tsx`, `TopBar.tsx`, `AppChrome.tsx`, `TimerStrip.tsx`, `TempoMark.tsx`, `ThemeToggle.tsx`, `components/ui/*`, new `components/sidebar/*` (profile menu, project tree), new `components/NotificationsButton.tsx`, `app/globals.css`, `app/layout.tsx`, new `scripts/v2-style-check.mjs`, `scripts/v2-shots.mjs`, and the `tests/ui/` files for these. Reads the store only; no store, API or electron changes. The project tree lists each project's stages (`project_stages`).


- Window and glass: the mockup's scene behind a translucent shell
  (`soft.html:11-80`): the four `--scene-*` colours as the two radial
  gradients over the linear one, the grain layer, `--shell` with
  `backdrop-filter: blur(28px) saturate(1.3)`. The web build paints this
  scene on `body` (today it paints a flat colour, so no glass shows in a
  browser). The desktop build keeps real macOS vibrancy (owner decision); the
  shell tint over it must still read as the mockup's frosted panel.
- Main panel as `.main`: inset 8px from the window, radius 22, hairline plus
  `--shadow-sm`, on `--surface`.
- Sidebar as `.side`: brand 20px/600/-0.03em with the 32px mark; nav labels
  15px at 400, 500 only when selected; selected row raised (`.nav a.on`);
  counts in mono 12px; section labels as `.lbl-s`; project rows with the
  22px logo tile; the project list tree (`.tree`) with its hairline.
- Sidebar foot as `.side-foot` (`soft.html:449-460`): the running-timer card
  (`.timer`: live dot, "Tracking now", task name, 24px mono clock, stop
  button) when a timer runs, and always the profile row (`.me`): avatar,
  name, "Settings & sync", the up-down chevron. The row opens a menu with
  Settings, Tracking settings, Sync and calendars, Theme, Shortcuts. It
  replaces the bare "Settings" link.
- Top bar as `.bar`: 64px, breadcrumb, the 300px search pill with the `⌘ K`
  key cap, the bell button (opens reminders and nudges), the theme button
  showing the moon in light and the sun in dark.
- Shared parts as their mockup classes: `.card`, `.card-h`, `.kpi` frame,
  `.task` (12px padding), `.chk` (outline stays at 0.47, owner decision), `.prio`,
  `.pill`, `.btn`, `.chipbtn`, `.seg`, `.head`.

How it is measured: `scripts/v2-style-check.mjs` loads `soft.html` and the
app in the shot rig and reads `getComputedStyle` for a fixed list of paired
selectors (window, shell, sidebar, brand, nav row rest and selected, side
foot, profile row, top bar, search, icon buttons, card, card header, KPI
frame, task row, checkbox, priority pill, pill, buttons, segmented control,
page head), about 25 properties each (size, weight, letter spacing, line
height, colour, background, radius, shadow, padding, gap, height, blur).
Score = matching properties / checked properties, per theme. **Done at
99.0% or more in both themes**, with each remaining mismatch listed and
agreed by the owner. The owner also sees the sidebar, foot and top bar side
by side with the reference at 1440x900.

### Phase 12B. Inbox to its mockup

Owns: `app/inbox/page.tsx`, `components/inbox/*`, `components/QuickAdd.tsx` (props only), and their tests.

Built to `reference/inbox-*` (`soft.html#inbox`, added
2026-11-13), keeping the app's own features: page head with the "N to sort"
count and a sort chip; KPI tiles (the app may choose which); composer that
defaults to no date; the Inbox card grouped "Older than a week" and "This
week", age in each row's meta, Today, Pick a day and Trash on hover; right
column with the Brain dump card (always visible) and Free this week.

### Phase 12C. Owner decisions and open findings

Owns: the files each decision names (`Today.tsx`, `components/today/*`, `app/upcoming/page.tsx`, `components/week/*`, `components/kanban/Column.tsx`, `app/settings/*`, `lib/next.ts`, `lib/format.ts`), plus `lib/store/tracking-settings.ts` and `lib/store/rows.ts` for the Today cap and the Claude default only.

Build "Changes to make" in `decisions.md`, then the open
findings in `REPORT.md`.

Done when (whole Phase 12): 12A's style check is at 99.0% or more in both
themes; Inbox matches its reference in layout and parts; every "Changes to
make" item is built; the gate is green; the owner has signed off the shell
side by side.

---

## 6. How the night runs

Order: 0, 1, 2, 3, 4A, 4, 5, 5F, 5A, 6, 7, 8, 9, 10, 10A, 10B, 10C, 10D, 11, 12A, 12B, 12C.

Changes on 2026-11-12, after the first run produced a reskin:

- **Briefing.** The router, every worker, the fidelity builder, the auditors and the orchestrator start by reading `rebuild/v2_build/design-brief.md` and opening the reference shot of their screen (rule 13). Agents that only run commands (checker, committer, clash watch) do not.
- **Fidelity pass.** Workers still cannot run a server while others edit. So on a screen that has a mockup, once the gate is green, one Sonnet "fidelity builder" works alone: it runs the lab server, screenshots its screen (`node scripts/v2-shots.mjs <tag> --only=<screen>`), puts the shot next to the reference, fixes what differs, and repeats, up to four passes. Then the full gate and the auditors run.
- **Visual auditor.** It opens the reference and the build shot of each screen, lists the mockup's elements one by one and says whether each is present in the same form. A missing, hidden or differently formed element is a P1 and blocks. The orchestrator may not accept or defer such a finding.
- **Fix rounds** are three, not two.
- **Commits.** The committer is told plainly that the owner authorised the commit. If a commit does not land, the run stops instead of building the next phase on an uncommitted tree.
- **Pause.** The run stops after 5F so the owner can look. Launching again resumes at 5A.
- Phases 5A to 10 now need 5F, not just 4.

The loop is a script, `.claude/workflows/tempo-v2-build.js`. The script itself
costs no tokens. It calls four kinds of agent:

| Role | Model | Does | Called |
|---|---|---|---|
| Router | Opus 5.5 | Splits a phase into as many tasks as can run at once, each with the files it owns, and marks each Sonnet or Haiku. Nothing else: no code, no review | Once per phase, once per fix round |
| Workers | Sonnet 5.5, Haiku 5.5 | Write the code for one task, inside its file list | In parallel waves |
| Checker, committer, clash watch | Haiku 5.5 | Run the gates and screenshots, commit or reset, report files edited outside a task's list | Every phase |
| Auditors (plan, visual, data, desktop) | Sonnet 5.5 | Read-only review of the diff and screenshots | Once per phase, only when the gate is green |
| Orchestrator | Opus 5.5 | Decides fix, accept, abandon or stop, and keeps the standing notes in `rebuild/v2_build/orchestrator.md` | Only when a phase fails, plus after 4A, 5A and 10 |

How clashes are prevented, in three layers:

1. The router gives every file to one task per wave.
2. The script does not trust that. It compares the file lists itself and moves any overlapping task to a later wave.
3. After every wave, `scripts/v2-watch.mjs` hashes the changed files and reports any file edited by a worker that did not own it. That becomes a P1 finding.

Workers cannot run the build or a dev server, because they share one checkout
and one `.next` folder. One gate runs after all of a phase's waves.

Per phase:

1. Router splits the phase. Workers run wave by wave, with the clash watch after each wave.
2. Checker runs `scripts/v2-gates.sh <phase>`, reseeds the lab database, takes screenshots and stops the server.
3. If the gate is green, the auditors run in parallel. Each ends with `PASS` or `BLOCK` and a list.
4. All clean: commit as `feat(v2): phase N, <name>`. No Opus call beyond the routing.
5. Not clean: the orchestrator reads the failures and decides. A fix goes back to the router, then to Sonnet workers only, then steps 2 and 3 again. **Three fix rounds at most.**
6. Out of rounds, or the orchestrator accepts or abandons:
   - Gate red: the diff is saved as `rebuild/v2_build/failed-phase-N.patch`, then `git reset --hard` to the phase's starting commit.
   - Gate green with findings left: commit as `wip(v2): phase N, open findings`.
7. Every outcome is appended to `REPORT.md`.

EGM-style goldfish reviews are not in the run. The per-phase auditors already
read the code fresh, and a second swarm on top roughly doubled the review
cost in the dry run for little extra.

Stop rules:

- Phases 0, 1, 2, 3, 4A and 4 are the foundation. If any of them ends in a reset, the run stops there. 4A is the one to watch: every later screen depends on it.
- Phases 5 to 10D are independent of each other, with three exceptions: 5A needs 5's composer prop; 10B's "Commit" needs 5; 10D needs 10C's IPC pattern. A failed phase is skipped along with anything that needs it. Because old token names are aliased, a skipped screen still renders in its old layout with the new colours and shell.
- Phase 11 runs only if every earlier phase was committed. Otherwise the run ends with the report.
- Time limit: 90 minutes per phase including fixes (120 for 4A and 10C). Hard stop for the whole run at 07:30.

Expected length: 18 phases at 30 to 50 minutes each is 9 to 15 hours.
Starting at 22:00 with a 07:30 stop gives 9.5 hours, so expect the first night
to end somewhere between Phase 10 and 10B. Whatever is left (most likely 10C,
10D and 11) runs the second night from the same script: it reads `REPORT.md`
and resumes at the first phase without a commit.

To launch: run the workflow from `.claude/workflows/tempo-v2-build.js`. It
skips phases that already have a commit, so the same command resumes the
second night. `{ only: ["0", "1"] }` runs chosen phases; `{ stopAt: "none" }`
removes the morning cut-off for a daytime run.

A dry run with stand-in agents (one fix round, one accepted phase, one
abandoned phase) made about 210 calls: 28 Opus, 69 Sonnet, 113 Haiku. Real
numbers depend on how wide the router splits each phase.

---

## 7. Gates (`scripts/v2-gates.sh`)

Must pass every phase:

- `npm run build`, `npx tsc --noEmit`, `npm run test:unit` (224 or more passing), `npm run test:ui`.
- No file changed under `lib/store/`, `lib/schema.sql`, `lib/migrate.ts`, `app/api/` or `electron/` unless the phase lists it under "Owns". Nothing under `.claude/agents/` after Phase 0.
- `lib/schema.sql` diff contains no `drop`, no `not null` without a default, and no statement without `if not exists` or an idempotent form.
- The populated-fixture migration test passes, run twice.
- No new entry in `package.json` dependencies.
- No `Application Support/Tempo` string in any new script. No write call (`writeFile`, `appendFile`, `rm`, `rename`) on a path under `.claude` in `electron/`.

Counted across `app/` and `components/`. The limit is "no higher than the last
phase" until Phase 11, then the final value:

| Check | Now | Final |
|---|---|---|
| Hex or `rgb(` colours in `.tsx` | 0 | 0 |
| `text-[Npx]` arbitrary sizes | 83 | 0 |
| Text under 12px outside `Caption` | 76 | 0 |
| Opacity modifiers on text colours (`text-*/NN`) | many | 0 |
| `outline-none` | 35 | 0 |
| `transition-all` | 16 | 0 |
| `gradient-text`, `from-accent` | 21 | 0 |
| `font-display`, `font-serif`, Calistoga, JetBrains | many | 0 (Instrument Serif in one file) |
| Em or en dashes and middle dots in JSX text | 37 lines | 0 |
| Banned words from section 3 in JSX text | many | 0 |
| `confirm(` | 1 or more | 0 |
| Lint errors | 9 | 0 |

In any file a phase rewrites, every count is already 0 when that phase ends.

---

## 8. What you get in the morning

`rebuild/v2_build/REPORT.md`:

- One line per phase: committed, committed with open findings, or reset. With the commit hash.
- For each open finding: file, line, what is wrong.
- Every "Requests" item a builder raised and did not make.
- Ledger summary: capabilities preserved, moved, removed, and any still unresolved.
- Final gate numbers against section 7.
- Paths to the screenshots, next to their reference shots.
- Anything where an agent had to guess, as a question for you.

Then, with you, in this order:

1. Run the new build against a **copy** of your real data first (`PGLITE_DIR=<copy>`), and check your tasks, projects, time entries and Quick list items all came through.
2. Only then back up `~/Library/Application Support/Tempo/pglite` and open the real app on the new build. The migration is additive, but this is the first time it meets real data.
3. Check by hand what screenshots cannot show: the capture shortcut (and that it does not clash with Raycast, Alfred or Spotlight), the tray menu, a reminder firing with the window hidden, the away prompt, the Dock badge, window vibrancy.
4. Decide what to fix, and only then think about merging or a release.

---

## 9. Known risks

| Risk | Guard |
|---|---|
| A builder invents features from the mockup's fake content | Section 1 table, rule 7, the visual auditor checks rulings not just looks |
| Capability silently lost when a component is replaced (the failure the old ledger existed for) | Phase 0 ledger, rule 9, auditor blocks on any unresolved row |
| Tests deleted to get green | Rule 8, auditor diffs the test files |
| Real data touched overnight | Lab database only, gate greps for the real path, the dev server never points at the real folder |
| The migration damages real data on first launch | Additive DDL only (rule 4a, schema gate), populated-fixture test run twice, `quick_todos` kept, and the morning order: copy first, backup second, real app third |
| Nullable `scheduled` breaks a date view in a way tests miss | 4A audits every comparison before any screen is built; the data auditor re-checks in each screen phase; lab seed includes undated tasks so screenshots would show them leaking |
| Scope is 18 phases; cheaper models drift on long plans | One phase per builder call, fixed "Owns" lists, features first reach the UI through already-tested lib functions, hard per-phase time limit, resumable run |
| Main-process features cannot be verified by an agent | Pure parts unit-tested; the desktop auditor reads the lifecycle code; the rest is on the morning checklist and reported as "not verified", never as done |
| A global shortcut or notification misfires while you sleep | Agents never launch the full Electron app, only the offscreen capture script, which registers no shortcuts |
| Half-migrated look if the run stops early | Old tokens aliased to v2 values from Phase 1; shell from Phase 2 applies to every page |
| Next 16 API differences | Rule 1, `AGENTS.md` |
| Fonts need the network at build time | Already true today (Calistoga, JetBrains come from Google) |
| Vibrancy and transparency look different in Electron than in screenshots | Screenshots are taken through Electron, but the offscreen window has no vibrancy. Check the shell by eye in the morning |
| The un-mocked screens (Settings, panel, palette) need design judgement | They are built only from Phase 1 primitives. Expect these to need the most review |
