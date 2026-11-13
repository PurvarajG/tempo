# Tempo redesign: features to take from 13 open-source task managers

Written 2026-11-09 against commit `2188f40` (v0.1.3). Line numbers refer to that
commit and will drift as work lands.

## Purpose

Tempo is for one person with an ADHD-style attention span and a lot to do. On
13 open-source task managers, this document records what Tempo already does
well, what to take from the other repos, what to leave out, and the exact
changes to make. No repo was treated as the gold standard: each was read for
specific mechanisms, and team or enterprise features were thrown out.

Repos reviewed (source read from shallow clones, nothing run):

| Repo | What it is | Verdict |
|---|---|---|
| [super-productivity](https://github.com/super-productivity/super-productivity) | Angular/Electron task manager and time tracker, 23.5k stars, v20.0.0 | Most useful: idle and tracking nudges, one-click focus sessions, end-of-day review, stopping repeat pile-ups |
| [Mindwtr](https://github.com/dongdongbh/Mindwtr) | GTD app for desktop and mobile, 2.4k stars, v1.3.8 | Today focus cap, Mind Sweep brain dump, next-action prompt, stale review |
| [taskwarrior](https://github.com/GothenburgBitFactory/taskwarrior) | CLI task manager, 6.2k stars, v3.5.0 | Urgency model, wait/scheduled/until dates, `next` report |
| [obsidian-tasks](https://github.com/obsidian-tasks-group/obsidian-tasks) | Obsidian plugin, 4.1k stars, 8.6.0 | Start/scheduled/due split, `when done` recurrence, postpone button, blocked-by links |
| [tududi](https://github.com/chrisvel/tududi) | Self-hosted life organiser, 3.5k stars, v2.1.0 | Overdue triage on the row, local "gap fits X" hints, inline undo, focus scope |
| [mission-control](https://github.com/builderz-labs/mission-control) | AI-agent control plane, 6.5k stars, v2.3.0, alpha | Reading Claude Code session files and detecting when a session needs you |
| [kanboard](https://github.com/kanboard/kanboard) | PHP kanban, 9.9k stars, maintenance mode | Card age and days-in-column, a few automatic actions, recurrence trigger and base options |
| [kaneo](https://github.com/usekaneo/kaneo) | Linear-style PM, 9.8k stars, v2.49.0 | Due buckets by calendar day, shortcut catalogue with sequence hints |
| [wekan](https://github.com/wekan/wekan) | Meteor kanban, 21.2k stars, v13.04 | Soft/hard WIP limits, countdown due badges, hover-card shortcuts |
| [worklenz](https://github.com/Worklenz/worklenz) | Agency PM suite, 3.3k stars, v3.4.0 | Per-day capacity minus time off, moving a time entry to another task, timer vs manual flag |
| [Tasks.md](https://github.com/BaldissaraMatheus/Tasks.md) | Markdown-file kanban, 2.2k stars | Tiny details only (inline tokens, `?` help sheet) |
| [4gaBoards](https://github.com/RARgames/4gaBoards) | React/Sails kanban, 740 stars | Tiny details only (due-colour timer scheduled at the next state change instead of polling) |
| [namviek](https://github.com/hudy9x/namviek) | Small-team PM, 2.6k stars, dormant since mid-2025 | Tiny details only ("copy open tasks as a prompt") |

---

## 1. Where Tempo already wins: keep these

Tempo is better than all 13 on how long things actually take and what fits in
your time. Do not break these while rebuilding.

- **One running timer, enforced in the database** (`lib/schema.sql:88-91`
  unique `running_lock`), with the "switch?" dialog (`components/TimerConflict.tsx`).
  Kanboard has a weaker version for subtasks only.
- **The life timeline with gap detection** (`lib/store/segments.ts:263-310`,
  `app/tracking/page.tsx`). No other repo has a continuous record of your day.
  Super Productivity is closest, with its idle-time handling.
- **Capacity**: planned time against waking hours (`lib/week-capacity.ts:40-93`)
  and the "more than fits" warning (`components/Today.tsx:57-62`).
- **The Up next card with "Not today", and the stale-task "Still doing it / Let it
  go" prompt** (`components/Today.tsx:208-223`, `components/TaskRow.tsx:131-147`).
  These are the right ideas. They just appear too late and too rarely (see 3.1).
- **Board columns have a fixed meaning** (`backlog | active | blocked | done`,
  `lib/types.ts:29`). Renaming a column never breaks counts. Kaneo's `isFinal`
  is the same idea.

## 2. Two problems found in Tempo's own code

These are not new features. They are things that already hurt.

### 2.1 A repeating task finished late comes back already overdue

`completeTask` creates the next copy with
`scheduled: nextOccurrence(source.scheduled, source.recurrence)`
(`lib/store/tasks.ts:293`). `nextOccurrence` (`lib/parse.ts:72-77`) adds the
interval to the **old scheduled date**. A weekly task due 1 Oct and finished on
9 Nov gets a next copy dated 8 Oct. That is already a month overdue, and it
shows on Today straight away. Finishing it again creates 15 Oct, and so on. The
task never catches up.

**Fix (part of Batch 1, change 1.3):** roll the next date forward until it is
after today by default, and add an optional "repeat from when done" mode.

### 2.2 Overdue tasks inflate today's plan

Today's list is every open task with `scheduled <= today`
(`components/Today.tsx:36-42`), and `committed` sums all of it
(`Today.tsx:57`). After a bad week the capacity bar reads "More than fits"
every day, so the warning stops meaning anything. Two related signals have the
same problem:

- The Dock badge is the count of **all** open tasks in every project
  (`components/DesktopBridge.tsx:96-99`). It is always high and so it is ignored.
- Today's day end is fixed at `DAY_END_HOUR = 22` (`lib/types.ts:154`), but
  Next 7 Days uses the waking hours from tracking settings. The two views can
  disagree about the same day.

**Fix:** Batch 1, changes 1.1 and 1.5.

---

## 3. Changes, in batches

Batches are ordered by daily relief for the least work. Each change lists
where the idea came from, why it matters for ADHD, and the exact Tempo change.
Schema changes follow the existing rule in `lib/schema.sql`: additive,
idempotent DDL, with any backfill in `lib/migrate.ts`.

### Batch 1: stop the guilt pile-up

#### 1.1 Overdue tasks get their own collapsed section

*Source: Super Productivity "From previous days → Reschedule all", tududi
planner overdue chips.*
*Why:* a wall of overdue tasks on Today is the main reason ADHD users give up
on a task manager. Overdue work has to be easy to see and fast to clear, but it
must never count as today's plan.

- `components/Today.tsx:36-42`: split `today` into
  - `planned`: `scheduled === todayISO`
  - `carried`: `scheduled < todayISO`
- `upNext` and the "Then" list read from `planned` only. If `planned` is empty
  and `carried` is not, the empty state says "Nothing planned. N carried over
  from earlier" and links to the section.
- Render `carried` with `components/ui/CollapsedBar.tsx` (it already exists and
  is unused): "From previous days · N", collapsed by default.
- When expanded, each row gets three actions inline instead of on hover:
  **Today**, **Tomorrow**, **Drop**. The bar header gets two bulk actions:
  **Reschedule all to today** and **Push all to tomorrow**.
- Drop sends the task to trash, as "Let it go" does today
  (`TaskRow.tsx:141`), with the undo from 1.4.
- `committed` (`Today.tsx:57`) sums `planned` only.
- The 7-day stale prompt (`TaskRow.tsx:131-147`, `STALE_AFTER_DAYS`) stays, but
  it moves inside the carried section so it no longer clutters the main list.

*Done when:* a seeded database with 20 overdue tasks shows one collapsed bar on
Today, the capacity bar reflects only today's tasks, and "Reschedule all" moves
all 20 in a single store call (one transaction via `withTransaction`).

#### 1.2 One-click postpone everywhere

*Source: obsidian-tasks postpone button.*
*Why:* putting something off has to cost less than ignoring it, or it gets
ignored.

- New shared component `components/ui/PostponeButton.tsx`:
  - a click moves the task to tomorrow;
  - a right-click (or long press) opens a menu with the next 6 weekdays by
    name, "Next week" (next Monday) and "No date" (see 2.2 in Batch 2,
    disabled until the inbox exists).
- Replace the hand-rolled tomorrow buttons with it:
  - the "Not today" action on the FocusCard (`Today.tsx:219-220`)
  - `onPushTomorrow` on the "Then" rows (`Today.tsx:234`)
  - TaskRow's actions (`components/TaskRow.tsx`), shown on every list view
    (Today, Upcoming, All, project pages)
- Use `lib/usePickerMenu.ts` for the menu, so it matches the existing pickers.

#### 1.3 Recurrence that never falls behind

*Source: obsidian-tasks `every week when done`, Kanboard's base-date option,
Super Productivity "Don't let overdue instances pile up".*

- `lib/types.ts:12-15`: extend `Recurrence` with
  `from?: "schedule" | "done"` (default `"schedule"`).
- `lib/parse.ts`:
  - `nextOccurrence(fromISO, r, todayISO)` loops until the result is after
    `todayISO` when `from === "schedule"`. This fixes 2.1.
  - When `from === "done"`, it counts from the completion date
    (`todayISO`).
  - `parseRecurrenceToken` (line ~60): accept a trailing `!` as shorthand for
    when done (`weekly!`, `every2w!`). Also handle the two-word form
    `weekly when done` in the main loop, by checking whether the next two
    words are `when done`.
- `lib/store/tasks.ts:293`: pass today's date into `nextOccurrence`.
- `components/TaskPanel.tsx` recurrence picker: add a toggle,
  "Repeat from: the schedule / when I finish it".
- `TaskRow.tsx:122`: the badge shows `↻ weekly` or `↻ weekly · from done`.
- No schema change: `recurrence` is already `jsonb`.
- Tests: extend `tests/tasks.test.ts` with the 1 Oct → finished 9 Nov case
  (next copy must be on or after 10 Nov) and a when-done case.

#### 1.4 Undo for every destructive or completing action

*Source: tududi's "Saved X · Undo" line.*
*Why:* a mis-click that can't be undone teaches you to stop using quick
actions.

- New `components/ui/UndoBar.tsx` plus a small context in
  `lib/store-context/` exposing `offerUndo(label, revert)`. It shows one quiet
  line at the bottom of the window for 6 seconds: "Completed 'Email Sam' ·
  Undo". This is not a stacking toast; a new offer replaces the old one.
- Wire into: complete (revert = `reopenTask`, and delete the spawned recurring
  copy if one was created, since `completeTask` returns `next`), trash and
  "Let it go" (revert = restore from trash), postpone (revert = old
  `scheduled`), bulk reschedule (revert = restore each old date in one
  transaction).
- Cmd+Z triggers the current undo when focus isn't in a text field
  (`components/DesktopBridge.tsx` keydown handler).

#### 1.5 Make the counts mean something

- Dock badge (`DesktopBridge.tsx:96-99`): count only the open tasks with
  `scheduled === today`, plus overdue tasks with a due time. Hide it at 0. Add
  a setting, "Dock badge: today's tasks / nothing".
- Today's day end: replace `DAY_END_HOUR` (`lib/types.ts:154`) in
  `Today.tsx:58-59` with the waking-hours end from tracking settings, the same
  source `lib/week-capacity.ts` uses. One source of truth for "end of day".
  Keep `DAY_END_HOUR` only as the fallback when tracking settings are missing.

### Batch 2: capture the thought before it's gone

#### 2.1 System-wide quick capture

*Source: none of the repos do this well. It is Tempo's single biggest gap.*
*Why:* an ADHD thought lasts seconds. Switching to the app first loses it.

- `electron/main.js`: register `globalShortcut` (default **Ctrl+Option+Space**,
  changeable in Settings) on `app.whenReady`, and unregister it on
  `will-quit`.
- It opens a small frameless, always-on-top `BrowserWindow` (about 560×64,
  centred on the active display) loading a new route `app/capture/page.tsx`.
  The page holds only the quick-add input, using the same `lib/parse.ts`
  preview as `components/QuickAdd.tsx`.
- Enter saves and closes. Escape closes. Shift+Enter saves and keeps the
  window open for the next one. Losing focus closes it without saving, unless
  there is text, in which case it saves to the inbox (2.2).
- With no date token, a captured task goes to the **inbox**, not today.
- Tray (`main.js:551-566`): add a right-click menu with "Quick add…", "Start/stop
  timer" and "Open Tempo". Left-click keeps its current behaviour.
- Preload (`electron/preload.js`): expose `tempo.closeCapture()`.
- Shell auditor scope: the new window, the shortcut's lifecycle, and checking
  the shortcut doesn't collide with existing menu accelerators
  (`main.js:461-488`).

#### 2.2 An inbox: tasks with no date

*Source: Mindwtr inbox, tududi inbox, Worklenz "no due date" bucket.*

- Schema: `alter table tasks alter column scheduled drop not null;` (safe to
  re-run). Add `create index if not exists tasks_inbox_idx on tasks (created_at) where scheduled is null;`.
- `lib/types.ts`: `scheduled: string | null`. Audit every `t.scheduled`
  comparison: Today, Upcoming, calendar, `week-capacity.ts`, `focus.ts`, ICS
  feed (`app/api/calendar-feed/route.ts`), and the comparisons in
  `lib/summary.ts`. Undated tasks are excluded from all date views.
- New page `app/inbox/page.tsx` with the count in the sidebar (Cmd+0). Each
  row offers the same three triage buttons: **Today**, **Pick a day**
  (PostponeButton menu), **Drop**.
- The Today page gets a single line, "Inbox · N", when N > 0, linking to the
  page. It is not a panel.
- `lib/parse.ts`: the `parse()` result returns `scheduled: undefined` when there
  is no day token. `QuickAdd.tsx` on Today keeps defaulting to today. The
  capture window and the inbox page default to no date.
- **Merge the Quick list into the inbox.** `quick_todos` was built as "not a
  task" scratch. The inbox fills that role, and three capture places (Notepad,
  Quick list, tasks) is two too many. Migration in `lib/migrate.ts`: move each
  undone `quick_todos` row into `tasks` with `scheduled = null`. Remove
  `components/today/QuickTodos.tsx` from Today. Keep the table for one release
  as a backup, then drop it. Record the move in `docs/tempo-focus-ledger.md`.
  The Notepad stays.

#### 2.3 Brain dump (several lines become several tasks)

*Source: Mindwtr Mind Sweep, tududi multi-line paste.*

- `QuickAdd.tsx` and the capture window: when the pasted text contains line
  breaks, show "Add N tasks?" with a preview list. Each line is parsed
  separately by `parse()`.
- The inbox page's empty state has a "Brain dump" textarea, the same idea
  without needing a paste.
- Store: a `addTasks(inputs[])` function in `lib/store/tasks.ts` inside one
  transaction, with one undo for the whole batch.

#### 2.4 More natural dates in quick-add

Add to `parseDayToken` (`lib/parse.ts:79`) and the main loop:

- `nov12`, `12nov`, `11/12` (month/day per locale setting; default day/month
  for the UK), `2026-11-12`
- `next week` (next Monday) and `nextweek`
- `in 2w`, `in 3d`, `in 1m` (two-word form, or `+2w` / `+1m` alongside `+3d`)
- `eow` (Friday), `wknd` (Saturday)
- `nodate` / `inbox`, which forces an undated task

Tests in `tests/` for each token, including next-year wrap ("jan 3" typed in
November means next January).

### Batch 3: one thing, chosen well

#### 3.1 Cap the day's commitment at 3 tasks

*Source: Mindwtr Today's Focus (hard cap, default 3).*
*Why:* the list that matters is the one you can finish. The rest is
candidates, not obligations.

- New task field: `alter table tasks add column if not exists committed_on date;`.
  "Committed" means "one of today's three". It is separate from `scheduled`
  (the day you planned it), so planning ahead doesn't fill the cap.
- Today layout becomes: **Up next** (the top committed task) → **Today's 3** →
  **Could also do** (the rest of `planned`, collapsed, with a star button to
  commit) → **From previous days** (1.1).
- The cap defaults to 3 and can be set to 1/3/5 in Settings. Adding a fourth
  shows "Swap with…" and the three current tasks. It never fails silently.
- `committed` capacity in the bar sums the committed tasks. Planned but
  uncommitted tasks show as a lighter ghost segment.
- Quick-add token `*` commits the task straight away (Mindwtr's `/*`).
- If nothing is committed, Up next falls back to the suggestion in 3.2.

#### 3.2 "Up next" that explains itself

*Source: Taskwarrior urgency, tududi suggestion score.*
*Why:* "what should I do now" is the hardest decision. A suggestion with a
readable reason beats a sorted list.

- New `lib/next.ts`, pure and unit-tested:
  `suggest(tasks, now, runningTaskId): { task, reasons: string[] } | null`.
- Score (fixed in code, **no user-tunable weights**):

  | Signal | Weight | Notes |
  |---|---|---|
  | Timer running on it | +40 | The thing you started stays on top |
  | Committed today (3.1) | +30 | |
  | Due today (has a due time today) | +25 | |
  | Overdue | +10 to +20 | Linear over 7 days, then **flat**, so old overdue work doesn't swamp everything |
  | Priority P1/P2/P3 | +15 / +8 / +3 | |
  | Blocks another task (3.4) | +10 | |
  | Start date (3.3) has passed | +5 | |
  | Fits the gap before the next calendar event | +5 | Uses `external-events` |
  | Blocked or not yet startable | excluded | |

- Only one suggestion per project at a time (tududi). If the top two are from
  the same project, the next-best project's task becomes the alternative.
- The FocusCard (`Today.tsx:210-221`) shows up to two reasons as meta,
  for example "due 3pm · unblocks 2". Never show the number.
- Add a third FocusCard action, **Something else**. It shows the next
  suggestion and remembers the skip for the session.
- `lib/focus.ts:34-55` (project focus task) uses the same `suggest()` filtered
  to the project, so there is one ranking in the app instead of two.

#### 3.3 Start date ("hide until") and auto-expiry

*Source: Taskwarrior `wait` / `until`, obsidian-tasks start date.*
*Why:* tasks you can't start yet are noise. Low-value tasks that remove
themselves stop the guilt list from growing.

- Schema: `alter table tasks add column if not exists start_on date;` and
  `alter table tasks add column if not exists expires_on date;`.
- `start_on`: the task is hidden from Today, the suggestion, and the
  inbox until that date, then appears normally. Shown in All Tasks and project
  boards, dimmed, with "from Nov 14".
- `expires_on`: on that date an open task moves to trash with source `expired`.
  It is listed once on the next end-of-day review (5.1) as "3 tasks expired"
  with undo.
- Quick-add tokens: `from:fri`, `from:nov14`, `until:fri` (reusing the
  Batch 2.4 date parser).
- TaskPanel: two optional date fields under "More", collapsed by default.

#### 3.4 Blocked-by links (minimal)

*Source: obsidian-tasks `⛔`, Taskwarrior `depends`.*

- New table `task_links (blocker_id uuid, blocked_id uuid, primary key (blocker_id, blocked_id))`,
  both foreign keys `on delete cascade`.
- TaskPanel: "Blocked by…" search picker (reuse the search store). A blocked
  task shows "waiting on 'X'" and is excluded from the suggestion.
- Completing the blocker shows, in the undo bar: "Unblocked 'Y'".
- Keep the existing Blocked column for "blocked by something outside Tempo".
  Links are for task-to-task.

#### 3.5 One-click focus session

*Source: Super Productivity focus mode.*

- New FocusCard action **Focus** (and a row action): starts the task's timer
  and a countdown equal to the remaining estimate
  (`minutes − tracked today`, minimum 5m).
- One mode only (countdown). If the time runs out, the timer keeps running
  (flowtime by default) and the session-done notice fires:
  - native notification via `window.tempo.notify`
  - `app.dock.bounce('informational')` (new IPC `tempo:attention`)
  - in-app: the TimerStrip turns into "Time's up · Done / +15m / Keep going".
- Going over the estimate shows one neutral line in TimerStrip, never a red
  warning.
- No Pomodoro cycles and no separate break reminders (see section 4).

### Batch 4: catch drift as it happens

#### 4.1 "Not tracking" nudge

*Source: Super Productivity tracking reminder.*
*Why:* gap detection currently reports the drift afterwards. A nudge during the
drift is worth more.

- In `electron/main.js`, a 60s interval: if no segment is running, the screen
  isn't locked and the user isn't idle (`powerMonitor.getSystemIdleTime()`),
  increment a counter. At the threshold (default 15m, Settings, off by
  default), send one native notification: "Not tracking for 15m". Clicking it
  opens Tracking with the gap preselected in the Unaccounted module.
- At most one nudge per gap. Reset when anything starts.

#### 4.2 Away-from-desk prompt

*Source: Super Productivity idle handling.*

- `powerMonitor` `lock-screen`/`unlock-screen` plus idle time over 5 min while a
  timer runs: on return, show one dialog: "Away for 23m while timing 'X'."
  Options: **Keep it on X**, **Mark as break** (splits the segment and inserts a
  `rest` category segment), **Discard** (ends the segment at the idle start).
- Implemented as a segment split in `lib/store/segments.ts` (new
  `splitSegmentAt`), in one transaction.

#### 4.3 Reminders you can't miss

*Current: fires once, at the exact minute, only while the window is open
(`components/Reminders.tsx:46-64`).*

- Move scheduling to the main process, so reminders fire while the window is
  hidden or closed to the tray. The renderer sends the list of today's timed
  tasks over IPC whenever tasks change.
- Per-task lead time: default 10 minutes before plus at the time. Quick-add
  token `!10m`.
- Notification actions (macOS supports them via Electron `Notification`
  `actions`): **Start**, **Snooze 15m**, **Tomorrow**.
- If ignored, repeat once after 10 minutes, then stop.
- Fix a bug: `fired` is keyed by task id only, so a task moved to a new time
  today never fires again. Key by `id + dueTime`.

#### 4.4 Stale signals on boards

*Source: Kanboard's days-in-column and stale move action.*

- Schema: `alter table tasks add column if not exists stage_entered_at timestamptz;`,
  set whenever `stage_id` changes (store layer). Backfill with `created_at`.
- Kanban cards (`components/kanban/`): footer shows "3d here" once it passes
  3 days, faded below that. Over 14 days in an active stage: the card gets the
  attention token (`--color-attention`, already defined) and is listed in a
  "Gone quiet" line on the project page.
- Never close or move automatically.

#### 4.5 Soft limit on in-progress work

*Source: Wekan and Kanboard WIP limits.*

- Stage column gets `wip_limit integer` (nullable). The header shows "3/3", amber
  when over. Never blocks a drop.
- When you set a limit on a column that already has more cards, the limit
  starts at the current count (Wekan), so it doesn't open on a failure.

#### 4.6 Board ↔ timer link

*Source: Kanboard automatic actions.*

- Dropping a card into an `active` stage shows "Start timer?" in the undo bar
  (one click). Moving the running task to a `done` or `blocked` stage stops
  its timer.

### Batch 5: a reset you'll actually do

#### 5.1 Two-minute end of day

*Source: Super Productivity daily summary.*

- New route `app/wrap/page.tsx`, reachable from a Today button that appears
  after 17:00 (configurable) and from the menu (Cmd+Shift+E).
- Four steps on one page, no wizard:
  1. **Done today**: the list, the count, total focused time. One calm line
     ("6 done, 3h 40m focused"). No points or streaks.
  2. **Estimate vs actual**: the three biggest misses, for example "'Report'
     planned 30m, took 1h 50m". This is where time blindness gets corrected.
  3. **How was it?** Energy 1–3 and one optional line of text. New table
     `day_reviews (day date primary key, energy smallint, note text)`.
  4. **Tomorrow**: tasks scheduled tomorrow, plus everything still carried
     over, each with **Commit** / **Later** / **Drop**. Committing sets
     `committed_on` for tomorrow (3.1).
- Expired tasks (3.3) are listed here once.

#### 5.2 Weekly reset (short)

*Source: Mindwtr weekly review, cut down.*

- New page section on `app/wrap` on Sundays (configurable):
  1. Brain dump box (2.3).
  2. Inbox triage (2.2).
  3. **Gone quiet**: open tasks not updated in 14 days, each with **Keep** /
     **Push back a week** (sets `start_on` +7) / **Drop**.
  4. Week numbers: done count, focused hours, estimate accuracy. No chart
     needed.
- Skip GTD's waiting-for, contexts and projects review steps.

### Batch 6: Claude Code awareness (specific to how you work)

*Source: mission-control `claude-sessions.ts` and `attention-detector.ts`.*

- **Read-only** scanner in the Electron main process over
  `~/.claude/projects/*/*.jsonl`: for each session, take the project path, git
  branch, last user prompt (first 80 chars), and last-message time. A session
  is "active" if its last message was under 15 minutes ago.
- **Time source:** active Claude sessions show on the tracking ribbon as a
  suggested segment ("Claude: TaskManager · main"). One click accepts it into
  the timeline under a "Claude work" activity. Never write segments
  automatically.
- **Needs-you signal:** if a session's latest assistant turn is a question or a
  permission prompt and nothing has followed for 5 minutes, send one
  notification: "Claude is waiting in TaskManager". Max one per session per
  wait.
- Never write to `~/.claude/`. Settings toggle, off by default. The shell
  auditor checks it reads and never writes.
- Optional extra: "Copy open tasks as a prompt" (namviek). A button that copies
  today's tasks with estimates as text, for planning with Claude.

### Batch 7: keyboard-first (small, do alongside any batch)

*Source: Kaneo shortcut catalogue, Wekan hover-card keys.*

Keep it to about 10 keys, all acting on the selected or hovered task:

| Key | Action |
|---|---|
| `j` / `k` | Move selection down / up (`lib/selection.ts` exists) |
| `x` or `Space` | Complete |
| `t` | Postpone to tomorrow |
| `d` | Pick a date (PostponeButton menu) |
| `s` | Start/stop timer |
| `f` | Focus session (3.5) |
| `*` | Commit to today's 3 |
| `e` / `Enter` | Open the task panel |
| `Backspace` | Trash (with undo) |
| `?` | Shortcut help sheet |

Plus **Cmd+K**, a command palette for navigation and "new task", which
replaces the need to learn `g`-sequences.

---

## 4. Leave out

- **Streaks, points, levels, badges.** Super Productivity and Mindwtr both
  explicitly ban them, and they're right. Celebrate what got done (5.1), don't
  score it.
- **Anything that invites tinkering instead of doing:** user-tunable scoring
  weights (Taskwarrior), query languages (obsidian-tasks), rule and automation
  builders (Wekan, Kanboard, namviek), custom fields, hooks.
- **Three separate nag systems.** Super Productivity's Pomodoro + break reminder
  + tracking reminder overlap and confuse even its own docs. Tempo gets one
  countdown (3.5) and one tracking nudge (4.1).
- **Full GTD.** Seven lists, contexts, waiting-for and a 7-step weekly review is
  a chore that ADHD users abandon. Take the cap, the brain dump and the stale
  list only.
- **Team features:** assignees, roles, client portals, rate cards, Gantt charts,
  issue-tracker integrations (Jira, GitHub), multi-workspace, sync engines.
- **Auto-closing stale work** (Kanboard). Flag it, never remove it without you.
- **Habits, goals, quotes, Eisenhower matrices** (tududi). Separate modules
  compete with the one list that matters.
- **More panels on Today.** It already has six or more sections. Every change
  above that touches Today removes or collapses something: the Quick list goes
  (2.2), overdue collapses (1.1), the inbox is one line (2.2), "Could also do"
  is collapsed (3.1).

## 5. Target Today layout after Batches 1–3

```
Today · Sun 9 Nov                      [capacity: 2h 10m of 5h 30m left]
──────────────────────────────────────────────────────────────────────
UP NEXT                                       due 3pm · unblocks 2
  Draft the client proposal          [Focus] [Done] [Tomorrow] [Something else]

TODAY'S 3
  ○ Draft the client proposal     1h
  ○ Reply to Sam                  15m
  ○ Book dentist                  15m

▸ Could also do · 4
▸ From previous days · 6          [Reschedule all] [Push all to tomorrow]
  Inbox · 3 →

[ quick add … ]
──────────────────────────────────────────────────────────────────────
Side: Due today · Blocked · Notepad   (Quick list removed)
```

## 6. Decisions to make before building

1. **Capture shortcut.** Ctrl+Option+Space is the proposed default. Check
   it doesn't clash with Raycast, Alfred or Spotlight on your Mac.
2. **Quick list merge.** Batch 2.2 retires the Quick list into the inbox. Confirm
   you don't use it for something the inbox wouldn't cover.
3. **Today cap.** 3 by default. Confirm or pick 1 or 5.
4. **Date format.** Day/month (UK) or month/day for `11/12`.
5. **Claude awareness (Batch 6).** Opt in or skip.

## 7. Suggested order

1. Batch 1 (pile-up). Smallest change, fixes both problems in section 2.
2. Batch 2 (capture). Biggest gap. 2.2 needs the nullable `scheduled` audit,
   so plan it with the layout auditor.
3. Batch 7 alongside whichever batch is in progress.
4. Batch 3 (one thing).
5. Batch 5 (reset). Depends on 3.1 for "commit tomorrow".
6. Batch 4 (drift). Main-process work; run the shell auditor.
7. Batch 6 (Claude awareness). Optional.

Each batch goes through the existing pipeline: `tempo-builder` per phase,
`tempo-continuity-auditor` after every phase, and new rows in
`docs/tempo-focus-ledger.md` for anything moved or removed.
