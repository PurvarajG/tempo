# Tempo redesign: current UI problems

Written 2026-11-09 against commit `2188f40` (v0.1.3). Line numbers refer to that
commit and will drift.

## Purpose

This is the "what is wrong with the current UI" record for the v2 redesign. It
pairs with [redesign_features.md](redesign_features.md), which covers features
taken from other task managers. This file covers only the interface: layout,
hierarchy, type, colour, states, copy and interaction.

The aim is to name the **root causes**, so the v2 design language is chosen to
remove them rather than patch 80 separate symptoms. Section 2 is the part to
read before choosing a direction. Sections 3 to 5 are the evidence.

## How this was produced

| Pass | Lens | Model | Raw report |
|---|---|---|---|
| A. Design review | impeccable `critique`, Assessment A: specificity, Nielsen heuristics, cognitive load, emotional journey, personas | Sonnet subagent | [current-ui-audit/A-design-review.md](current-ui-audit/A-design-review.md) |
| B. Detector | impeccable `detect` CLI on `app/` + `components/`, plus the detector injected into 4 live pages | Haiku subagent | [current-ui-audit/B-detector.md](current-ui-audit/B-detector.md) |
| C. System audit | Hallmark `audit`, plus taste-skill rules (colour lock, radius lock, eyebrows, dashes, states, contrast), from code | Sonnet subagent | [current-ui-audit/C-system-audit.md](current-ui-audit/C-system-audit.md) |
| D. Live walkthrough | Every flow clicked through in a browser: quick add, task panel, timer, complete/undo, calendar, kanban, tracking, keyboard only, 820px window | Sonnet subagent | [current-ui-audit/D-interaction.md](current-ui-audit/D-interaction.md) |

A and B ran in isolation from each other, as impeccable's critique method requires.

The app ran on `localhost:4700` against a **copy** of the desktop app's database,
so the screenshots show real usage. The real data was never touched. Evidence:

- `current-ui-audit/screens/`: every route in light and dark, at 1440x900 ("wide") and 820x700 ("narrow"), plus `light-tall-today.png`.
- `current-ui-audit/states/`: interaction states (D01 to D35, N1 to N6).

**Caveat on time of day.** The screenshots were taken after 22:00. That is past
`DAY_END_HOUR` (`lib/types.ts:154`), so "Capacity left 0m" and "More than fits"
show in them. That is a real bug (see P-03), but it makes Today look worse than
it does at 10am.

---

## 1. Scorecard

| Measure | Result |
|---|---|
| Nielsen heuristics | **26 / 40** ("acceptable": nothing broken at the bottom, nothing delightful at the top) |
| Cognitive-load checklist (8 items) | **5 fail**, 1 partial, 2 pass |
| Options at Today's main decision point | **more than 20** (target is 4 or fewer) |
| Theme-specific contrast failures | **15**, from 11 separate design decisions |
| Text styles under 12px | **76 of ~275** (9px: 7, 10px: 43, 11px: 26) |
| Font sizes in use | 14, of which 83 usages are arbitrary (`text-[10px]` etc.) |
| Corner radii in use | 6, plus one `rounded-[11px]`, with no rule |
| Em/en dashes in visible copy | 23 lines; middle dots in 14 lines |
| `active:` pressed states | 3, across 127 buttons |
| Undo | none, anywhere |
| Console errors | 0 on every route |
| Detector (static) | 1 finding (gradient text); the detector in the live pages found ~50 undersized text and ~18 low-contrast hits |

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of status | 3 | Timer pill is global and good; capacity bar is 100% full blue whatever the state |
| 2 | Match with real world | 3 | Warm copy, but counts on Today contradict each other |
| 3 | User control and freedom | 3 | Complete, Not today, trash and "Let it go" have no undo |
| 4 | Consistency and standards | 2 | The same thing has 3 to 5 names (see 5.2) |
| 5 | Error prevention | 3 | Quick add silently creates projects from typos |
| 6 | Recognition rather than recall | 2 | Quick-add syntax is one faint 11px line; Completed/Trash hidden from nav |
| 7 | Flexibility and efficiency | 3 | Token quick add is strong; no shortcuts beyond Cmd+N, no command palette |
| 8 | Aesthetic and minimalist | 2 | Today shows ~25 controls to answer "what now?" |
| 9 | Error recovery | 3 | Trash exists but is hidden; empty search is a dead end |
| 10 | Help and documentation | 2 | No onboarding, no `?` sheet, nothing explains capacity or tracking |

---

## 2. Root causes

Every problem in section 3 rolls up to one of these. They are what the v2
design language has to answer.

### RC1. Today is a dashboard of widgets, not one next action
Today asks you to capture (quick add), plan (Timeline with a range slider), do
(Up next), triage (Then rows), jot (Notepad), list (Quick list) and check status
(metric strip, Due today, Blocked) all at once. The one thing Tempo gets right,
the dark "Up next" card, sits 480 to 715px down the page, below the fold at
1440x900, and the same task can appear four times on the screen.
For a user with an ADHD-style attention span this is the core failure.

### RC2. One generic page template on every route
Every page is: a bordered pill eyebrow, a Calistoga serif H1 with one gradient
word, a mono uppercase stat strip, then cards. Strip the logo and it could be
any AI-built dashboard. Nothing signals where you are, and nothing visually says
"time" or "attention" in an app named Tempo. (`PageShell.tsx:105`,
`SectionLabel.tsx`, `.gradient-text` at `globals.css:361`.)

### RC3. Time is framed as a deficit
The first words after the date are "2 OVERDUE", "0M CAPACITY LEFT", a full bar
and "More than fits". Tracking leads with "960M UNTRACKED", "Unaccounted 16h"
and "Coverage 0%". Stale rows say "Sat here 57 days." on every visit. The
product's best idea, honest time, is presented as a score you are failing.
The one reassuring line ("that's planning, not failing") is the right voice on
the wrong trigger.

### RC4. No type system
14 sizes, 83 arbitrary ones and 76 usages under 12px. JetBrains Mono uppercase
with letter-spacing is used for labels, metadata, hints, kanban headers and even
buttons, so headings, labels and actions all look the same. There are three
families with overlapping jobs, plus a stray fourth (Georgia, from
`font-serif` at `app/upcoming/page.tsx:112`). Calistoga ships one weight but is
set `font-bold` (faux bold) at `AttentionPanel.tsx:25` and
`projects/[id]/page.tsx:144`.

### RC5. Colour has no rule, and contrast is done with opacity
The accent is a saturated #0052ff to #4d7cff gradient: the exact "AI blue"
tell. It's on 15 buttons and 6 page headings, and white on it fails contrast.
Neutrals mix cool slate with neutral grey, a warm charcoal sidebar (#313333,
identical in both themes) and a navy ink card. There are three different blues,
plus orange "attention", rose "now", and two overlapping categorical palettes.
Secondary text is made by putting `/40` to `/70` opacity on the muted colour,
which lands at 1.7 to 3.7:1.

### RC6. No state and feedback layer
Nothing confirms or reverses an action: no undo, no toast on complete, trash or
"Not today", no parse preview in quick add, no "saved" cue in the task panel,
one skeleton in the whole app, and 3 pressed states across 127 buttons. Focus
styling is split: 35 `outline-none`, 9 `focus-visible`, and low-alpha
`ring-accent/20` rings. Every component wrote its own states, so they disagree.

### RC7. Navigation and vocabulary grew by accretion
The nav shows Today, Calendar, Tracking, Next 7 Days and Settings. All Tasks,
Completed and Trash exist but are hidden by default. Search is both a field and
a route. Settings holds two unrelated tabs, and Tracking has its own separate
settings route. One concept often has several names: Trash / Let go / Let it go
/ Delete, Completed / What you've shipped / Done / Mark complete, and Next 7 Days
/ What's coming / `/upcoming`. Two timer concepts (task timer and Tracking
"focused activity") use different words.

### RC8. A fixed desktop layout that doesn't adapt
The sidebar is a fixed 224px at every width (27% of an 820px window). The task
panel is a fixed 448px. The Timeline and kanban clip without a scroll cue. A
side-by-side half-screen window, which is common for a task app, loses the
focus card below the fold.

---

## 3. Problem list

Severity: **P0** blocks the job or actively harms the target user. **P1** causes
real difficulty. **P2** is an annoyance with a workaround. **P3** is polish.
"Source" maps to the raw reports (A-, C-, D- ids). "Bug" marks a defect that is
worth fixing in v1 now, whatever v2 looks like.

### 3.1 Today and focus (RC1, RC3)

**P-01 (P0) Today leads with deficits, not the next action.** Metric strip
(Active, Overdue, Planned, Capacity left, Recorded), a full-width bar and "More
than fits" come before any task. Evidence: `screens/light-wide-today.png`,
`Today.tsx:101-139`. Source A P-01.

**P-02 (P0) Today has no single focus.** It has more than 20 options at one
decision point: quick add, Timeline (arrows, range slider, 7 day links, chips),
Up next, Then rows with 3 to 4 actions each, Done, and four rail panels. The
Up next card is at y=715 on 1440x900 and fully below the fold at 820x700.
Evidence: `states/D05-today-full.png`, `states/N1-today.png`,
`Today.tsx:151-250`. Source A P-02, D-05.

**P-03 (P0, bug) The capacity warning always fires after 22:00 and counts
overdue work.** After `DAY_END_HOUR` the minutes left are 0, so the bar fills
to 100% and "More than fits" shows for any task, even 30m planned. Overdue
tasks inflate the planned total. The bar has no state colour, so it is always
blue. A warning that always fires trains the user to ignore it. Evidence:
`states/D18-timeline-max.png`, `Today.tsx:36-69,119-133`, `lib/types.ts:154`.
This is also item 2.2 in redesign_features.md. Source A P-03, D-03.

**P-04 (P0) Stale and overdue work gets shame-flavoured treatment and no real
triage.** "Sat here 57 days." shows on every load. "Let it go" trashes the
task with no undo, and "Still doing it" re-schedules it to today; neither label
says what it does. The Up next card hides that its task is 82 days late.
Project pages repeat it in orange: "Needs attention… Overdue by 57 days".
Evidence: `screens/light-wide-today.png`,
`screens/light-wide-projects_*.png`, `TaskRow.tsx:131-147`. Source A P-04,
D-13.

**P-05 (P1) The Up next card can't be acted on.** Its title is an `h2` with no
handler, so you can't open the task. There's no Start timer on the one task the
app tells you to do, and no project, notes or age shown. Evidence:
`components/ui/FocusCard.tsx:66-100`. Source D-04.

**P-06 (P1) The same task appears up to four times on Today.** It shows as a
Timeline chip, in the Due today rail, as Up next and in Then. Evidence:
`states/D35-focus-ring-row.png`. Source D-05.

**P-07 (P1) Contradictory counts on one screen.** Today says "2 Active" and "2
Overdue" while the rail says "Due today: nothing is scheduled". Next 7 Days says
"0 tasks" while Today says 2 overdue. The user has to reconcile five numbers to
trust any of them. Source A P-05, A P-15.

**P-08 (P1) The Timeline widget is dead weight on Today.** It has a range
slider (1 to 14 days) with no ticks, and it silently switches to an hourly grid
at 1 day and truncates chips at 14 ("Sant Mah…"). It has a project-by-day grid
that is often empty, and it pushes Up next down; adding a task grows it and
pushes Up next further. Evidence: `states/D18-timeline-max.png`,
`states/D19-timeline-min.png`, `DashboardTimeline.tsx:96,125,279`. Source A
P-09, D-12.

**P-09 (P2) Completing work has no payoff, and the end of the day is a shrug.**
Mark done makes the card vanish instantly, with no acknowledgement and no
transition. Once the list is empty the screen says "Nothing on today. Either
you're done, or nothing's captured yet.", which is ambiguous and offers no next
step and no summary. Completed is hidden from the nav. The peak-end rule fails.
Source A P-17, A P-18, D-24.

**P-10 (P2) Three capture places with different meanings.** Quick add,
Notepad ("Anything you don't want to lose.") and Quick list ("Add something
small") all accept text, each with a different meaning and lifespan. The
Notepad, the highest-trust container, can be collapsed away. Source A P-25.

### 3.2 Visual language and page structure (RC2, RC4, RC5)

**P-11 (P1) Every route uses the same template.** Pill + serif H1 with a
gradient word + mono stat strip + cards. The pill repeats the H1 ("TODAY" above
"Monday 9 November", "TRACKING" above "Today"). It is bordered like a button but
does nothing. Settings' H1 reads "Apple Calendar" because it follows the
sub-tab, and an empty search renders the H1 as bare quote marks. Evidence: all
`screens/light-wide-*.png`, `PageShell.tsx:105`. Source A P-06, P-07; C16.

**P-12 (P1) The type hierarchy has collapsed into 9 to 11px mono caps.**
`SectionLabel.tsx:26-38` (pill + pulsing dot + mono uppercase) is used about 20
times and inside every `Panel` header. Action buttons are styled as labels:
START, + SUB, TOMORROW and DELETE at `TaskRow.tsx:196-212`. There are 55
`uppercase` lines and 11 letter-spacing values, and "36M" / "960M" reads as
millions. Evidence: `screens/light-wide-today.png`,
`screens/light-wide-projects_*.png`. Source A P-08, C4, C7.

**P-13 (P1) Fonts have no roles.** Calistoga is a "default serif for flavour"
choice, used for H1s, card titles, the wordmark and numerals
(`RollupsModule.tsx:108`), so it means nothing. It is faux-bolded in 2 places.
Mono is on 87 elements, including prose metadata. A stray Georgia comes in via
`font-serif`. Source C6, A specificity verdict.

**P-14 (P1) The accent is a generic blue gradient that fails contrast.** The
`from-accent to-accent-secondary` gradient is on 15 elements across 13 files.
`.gradient-text` is on 6 H1s plus the Today date. White on the gradient end
measures 3.57:1 in light mode and 2.63:1 in dark. The `accent-secondary` token
exists only to feed the gradient. Source C1, B.

**P-15 (P1) The colour palette has no discipline.** It mixes cool slate and
neutral greys, a warm charcoal sidebar, a navy ink card, three blues (#0052ff,
#075cf6, project-1 = accent), orange attention, rose now plus rose category,
two purples, and two overlapping categorical palettes (8 + 7). Overdue appears
in accent blue on project pages. Orange is the only semantic colour, and only
on project pages. Evidence: `globals.css:44-185`. Source C9, A P-20.

**P-16 (P1) The sidebar is a different app.** It is the same #313333 charcoal
in light and dark, so light mode is two themes glued together. It has a generic
blue active pill. The theme toggle is an unlabeled 14px icon next to the logo.
The project delete "x" appears only on hover, in the place where the count
was. Evidence: `globals.css:98,111,186`, `Sidebar.tsx:154-155`. Source A P-12,
D-25.

**P-17 (P2) Boxes everywhere, with no container rule.** `Panel`, `RailPanel`,
`ModuleCard`, `AttentionPanel`, `FocusCard`, `TaskRow`, kanban `Card` and
`MetricStrip` each define their own border, radius and padding. Cards stack a
border on top of a `shadow-sm`. There are four border opacities for one
concept, a card nested in a card on /tracking, and dashed boxes holding empty
messages ("Nothing is waiting on anything.") in prime space. Source C8, C15, B,
A P-18.

**P-18 (P2) Radius and shadow have no rule.** There are six radii, and the
same input class uses `lg`, `xl` or `md` depending on the file (`Field.tsx`,
`QuickAdd.tsx:53`, `TaskRow.tsx:184`, `QuickTodos.tsx:39`). There are four
default black shadows plus three tinted custom ones. Source C8.

**P-19 (P2) Decorative status dots and infinite pulses.** There are more than
25 dots and 5 `animate-pulse-dot` loops on a focus tool. Project identity
relies on colour alone. Only the running-timer pulse means anything. Source C5,
B.

**P-20 (P2) Dark mode flips the hero card.** The Up next card is dark ink in
light mode but near-white in dark mode, so it becomes the brightest object on a
night screen. The project FocusCard turns mid-blue instead. The token plumbing
is good, but the hero's metaphor breaks. Evidence:
`screens/dark-wide-today.png`, `screens/dark-wide-projects_*.png`. Source A
P-21.

**P-21 (P2) No icon system.** There are 6 hand-rolled SVGs with mixed stroke
and fill, and everything else is Unicode glyphs (▶ ■ ● ⌃ ⌄ ↻ → ↑ ↓) that render
differently by font and take no size or stroke tokens. Source C12.

**P-22 (P3) The brand mark doesn't carry the idea.** It is three small blue
bars and a serif wordmark, with nothing about rhythm or time. Source A P-27.

### 3.3 Contrast and accessibility (RC5, RC6)

**P-23 (P0) Placeholder and secondary text are near-invisible.** The quick add
placeholder "What needs doing?" is 2.3:1 and sidebar "Search" is 2.5:1. Notepad
and Quick list placeholders are 2.3:1. `muted-foreground/60` text is used 11
times at 2.25:1 in light mode. Evidence: `QuickAdd.tsx:52-53`,
`Sidebar.tsx:80-81`, `Panel.tsx:44,47`, `TaskRow.tsx:60,184`. Source B, C2.

**P-24 (P0) White on the accent fails in dark mode.** Primary buttons and the
active sidebar row are white on #4d7cff at 3.72:1. The dark accent was
lightened for text and then reused as a fill. Evidence: `Sidebar.tsx:96,131`,
`globals.css:163,189`. Source C3, B.

**P-25 (P1) Contrast table failures, by theme.**

| Pair | Light | Dark |
|---|---|---|
| muted-fg on muted (chips, Panel header) | 4.34 | ok |
| white on accent-secondary | 3.57 | 2.63 |
| white on accent / nav-active | ok | 3.72 |
| nav-foreground/70 | 3.85 | 3.85 |
| nav-foreground/50 (placeholder) | 2.70 | 2.70 |
| muted-fg/60 text and placeholder | 2.25 | 3.01 |
| muted-fg/40, /50, /70 | 1.68 to 2.66 | 1.95 to 3.67 |
| attention text on background and on attention surface | 2.75 / 2.72 | ok |
| field border on background (3:1 needed) | 1.18 | 1.30 |
| calendar grey cell text #b7bec8 | 1.8 | n/a |

Source C section 2, B.

**P-26 (P1) Undersized functional text.** The 16 time-axis labels on
/tracking are 10px. Calendar weekday headers and "Today" are 9px
(`DashboardTimeline.tsx:188`, `MonthGrid.tsx:88,123,148`,
`WeekGrid.tsx:96,128,145`). So are metric labels and chip text. Source B, C4.

**P-27 (P1) Focus is inconsistent and keyboard paths are long.** There are 35
`outline-none` against 9 `focus-visible`, with low-alpha rings and no global
`:focus-visible` rule. Tab order runs about 15 stops through the Timeline
before the first task, with no skip link. Row actions cost 4 Tab stops per row.
Sam-the-screen-reader also meets inert pills that look like buttons and a
strikethrough that only shows "done" visually. Source C10, D-16, A P-26.

**P-28 (P2) Hover-only controls and ungated hover.** Row actions and the
project delete are `opacity-0` until hover (they do show on focus). There are
134 `hover:` uses and none gated by `@media (hover: hover)`. Source D, C10.

### 3.4 Feedback, states and error prevention (RC6)

**P-29 (P1) No undo anywhere, and protection is upside down.** Complete, Not
today, Move to trash, row DELETE and "Let it go" act instantly with no toast
and no undo. Only the rare "Delete forever" asks, and through a native
`confirm()`. In the task panel footer, "Mark complete" and "Move to trash" share
one row. Evidence: `states/D13-after-markdone.png`,
`states/D14-after-trash.png`, `states/D17-trash-deleteforever.png`. Source D-02,
A P-17.

**P-30 (P1, bug) Quick add mis-parses silently.** `#typo` creates a permanent
new project in the sidebar, `25pm` becomes 1:00 PM, and `p9` is left in the
title. There is no preview of what was parsed before Enter, and no confirmation
after. A task scheduled for another day just disappears from view. The token
syntax is only taught by one faint 11px line (`QuickAdd.tsx:61-64`). Evidence:
`states/D02-quickadd-typed.png` to `states/D04-quickadd-badtokens.png`. Source
D-06, A H6.

**P-31 (P1, bug) Esc on the timer-switch dialog closes the wrong layer.**
`SidePanel` captures Esc at document level (`SidePanel.tsx:38-41`) and
`TimerConflict` has no handler. Esc closes the task panel underneath and leaves
the alert dialog open. "Keep going" is ambiguous, and the long primary label
wraps. Evidence: `states/D10-timer-conflict.png`. Source D-08.

**P-32 (P2) Loading, pressed, disabled and saved states are missing or
inconsistent.** There is 1 skeleton in the app, `active:` on 3 of 127 buttons,
three different disabled opacities, and autosave with no "saved" cue. There are
16 uses of `transition-all`. Toggles animate `left` and are built in three
different ways. Source C10, C13, D-10.

**P-33 (P2) Overlays cover content.** The floating timer pill and the "Enable
reminders?" toast sit bottom-centre over page content: the pill covers "Still
doing it / Let it go". No bottom padding is reserved for them. Evidence:
`states/D09-timer-running.png`. Source D-14.

### 3.5 Navigation and information architecture (RC7)

**P-34 (P1) Recovery views are hidden.** All Tasks, Completed and Trash are
hidden from the sidebar by default (Settings > Sidebar,
`Sidebar.tsx:22,87`). With no undo, a first-timer has no visible way to recover
a mis-click. Source D-07, A P-11.

**P-35 (P1) Sidebar order and grouping make no model.** Settings is a peer of
Today. Calendar sits between Today and Tracking, though Next 7 Days is its
sibling. Search is both a sidebar field (submits on Enter, not live) and a
route. The project count ("1") has no stated meaning. Source A P-11.

**P-36 (P1) Tracking explains nothing and reads as surveillance.** It has 7
modules (Now, Unaccounted, Records, Day Ribbon, Roll-ups, Signals) and no
sentence saying what the page is for. The vocabulary is analytic ("Most
fragmented", "Coverage", "taxonomy"). Its Now area shows a field, 7 preset
chips, New, "Show all (10 more)" and Manage. The two category vocabularies
(quick-start chips and record categories) don't match, and it has a second
timer concept next to the task timer. Evidence: `states/D30-tracking.png`,
`screens/light-wide-tracking.png`. Source A P-10, D-09.

**P-37 (P2) Settings is two unrelated pages and some config is hidden in the
wrong place.** /settings has Calendar (feed URL, "Rotate
CALENDAR_FEED_SECRET to revoke it.") and Sidebar toggles, with filler copy
("Integrations and navigation, in one structured workspace."). Theme lives
beside the logo. /tracking/settings is a separate route titled "Configure your
taxonomy", with three unlabeled toggles per row and no back link. Evidence:
`states/D31-tracking-settings.png`, `states/D34-settings.png`. Source A P-13,
D-21, D-22.

**P-38 (P1) The task panel is a 12-field form in the wrong order.** The order
is Title, Notes, Project, Column, Scheduled, Time, Complex task, Estimate,
Priority, Tags, Repeats, Subtasks, then the timer. Start timer and the time log
are at the bottom, about 1.5 screens down. "Column" (needs a project) and
"Complex task" are jargon shown to everyone. Subtasks are added newest first,
so a typed checklist comes out reversed. The time log row shows an unexplained
number box and "N". Evidence: `states/D06-taskpanel.png`,
`states/D07-taskpanel-bottom.png`. Source D-10, D-20.

**P-39 (P2) The project page is an enterprise board for one person.** It shows
9 stats in two mono rows ("8 DONE" twice, "80% COMPLETE"). A Current focus card
duplicates the Today card, and an orange Needs attention panel duplicates the
same task. Backlog, In Progress, Blocked, Done and Recurring columns sit there
with 0s. Done is clipped and Recurring is off-screen with no scroll cue. A bare
"x" removes a column. Evidence: `states/D24-project.png`. Source A P-16, D-18.

### 3.6 Calendar, Next 7 Days, Completed, Search (RC2, RC8)

**P-40 (P0, bug) Next 7 Days task titles render at 0px wide.** Every card shows
only "30M 3:00 PM P1 MSM26 @tag". The title button (`block w-full truncate` in
`TaskRow`) computes to width 0 inside the narrow day column. This was verified
twice: by the walkthrough and again directly in the page. The planning view is
unreadable. Evidence: `states/D12-upcoming.png`. Source D-01.

**P-41 (P2) The calendar has weak defaults.** The month view opens with 42
mostly empty cells and always shows 6 rows. The week view starts at 00:00, so
the working day is below the fold, and the all-day strip collides with the
00:00 label. The calendar starts weeks on Sunday while the Timeline starts on
Monday. At 820px the cells are about 65px wide. Drag announcements use ISO
dates ("moved to 2026-11-11."). Evidence: `states/D20-calendar.png`,
`states/D22-calendar-week.png`, `states/N2-calendar.png`. Source A P-14, D-19,
D-11.

**P-42 (P2) Next 7 Days shows "nothing" while 2 tasks are overdue.** Its metric
strip says 0 tasks, 0m and a dash for busiest day. The overdue items aren't
shown, Sunday is clipped at the right edge, and dates use the ambiguous serif
"9/11" format. Source A P-15.

**P-43 (P3) Completed and Trash are heavy and wrong-toned.** Completed uses
large half-opacity filled circles and strikethrough (which reads as "rejected",
not "achieved"). Its dates have no year ("TUE 25 AUG"), and completed rows keep
"+ SUB" and "DELETE". Trash is titled "Let go", and Restore gives no feedback.
Source A P-23, D-23.

**P-44 (P2) Search is a dead end.** It isn't live, there is no Cmd+K, results
have no counts, filters or highlights, and an empty query shows "" Nothing
matched. Evidence: `states/D32-search-empty.png`. Source D-15, A H9.

### 3.7 Responsiveness (RC8)

**P-45 (P2) The 820px window crowds everything.** The sidebar stays a fixed
224px and the task panel takes 448px (55% of the viewport). On Today, the
header, quick add and Timeline fill the first screen and Up next falls below
it. The Timeline (min 48 to 56rem) clips "Fri" with no scroll cue, and the
metric strip wraps. Evidence: `states/N1-today.png` to `states/N6-panel.png`.
Source A P-19, D-17.

### 3.8 Power use (RC6, RC7)

**P-46 (P2) No shortcut system.** `?`, `n`, `/`, `c`, `g` and Cmd/Ctrl+K do
nothing. Only Cmd+N focuses quick add, and that's Electron-only
(`DesktopBridge.tsx:69-91`). No shortcut hints appear on Mark done, Not today
or row actions, and there is no help sheet. Source D-15, A H7, H10.

---

## 4. Copy and vocabulary

### 4.1 Tone

| Problem | Strings |
|---|---|
| Guilt or blame | "Sat here 57 days.", "N d waiting", "OVERDUE" as a headline metric, "More than fits." (defensive), "Unaccounted 16h since waking", "Coverage 0%", "960M UNTRACKED", "80% COMPLETE" |
| Jargon | taxonomy, roll-ups, signals, day ribbon, gap rules, "Most fragmented", Column, Complex task, Capacity left, Planned, Scheduled, "Rotate CALENDAR_FEED_SECRET" |
| Cute but unclear | "Let go" (Trash title), "Let it go" (trashes), "Keep going", "Still doing it" (reschedules), "What you've shipped", "What's coming", "Nothing is waiting on anything.", "Either you're done, or nothing's captured yet." |
| Filler | "Integrations and navigation, in one structured workspace." |

### 4.2 One concept, several names

| Concept | Names in the UI now |
|---|---|
| Trash | Trash, Move to trash, Delete (row button, which trashes), Let it go, Let go, Delete forever |
| Done | Done, Mark done, Mark complete, Completed, What you've shipped |
| Next week | Next 7 Days, What's coming, `/upcoming` |
| When a task is planned | Scheduled, Due today, the `thu` token |
| Timing | Timing, Start timer, START, Focused activity, Now, Focus Work, Deep work |
| Grouping | Project lane, Column, Stage |
| Subtask | + SUB, Add subtask, Subtasks |

### 4.3 Formatting

- Dates appear as "Thu 3 Sept", "9 Nov", "TUE 25 AUG", "9/11", "10/11", "13/09/2026" (native input) and "2026-11-11" (announcements).
- "M" for minutes in mono caps ("36M", "960M") reads as millions.
- 23 visible lines use em or en dashes, 3 of them as null placeholders ("—").
- 14 visible lines use middle-dot separators, including the six-dot quick-add hint.
- The full file:line list is in [current-ui-audit/C-system-audit.md](current-ui-audit/C-system-audit.md) section 4.

---

## 5. Keep in v2

These work. The redesign should carry them over, not rebuild them from scratch.

**Product and interaction**
- The single dark Up next card: one task, two verbs, unmistakable. It is the seed of the whole Today screen; it needs Start and Open added (P-05).
- The voice: "Not today", "that's planning, not failing", "Let it go". It is humane, short and not gamified. It needs a better trigger and clearer labels, not a new voice.
- Time as truth: the estimate on every task, planned against capacity, and the day ribbon with gaps. This is the product's moat, and it currently has no visual language.
- Autofocused, chainable quick add with natural-language tokens. The parser is good on valid input.
- Side-panel task editor: modal, focus trap, Esc, click-out, focus restore, autosave.
- Global floating timer pill on every route, one-click Stop, and the "already timing X" switch dialog with the safe default named.
- Calendar drag to reschedule with an aria-live announcement, click a day to add, Day/Week/Month.
- The kanban "…" move-to-column button as the keyboard alternative to drag.
- Collapsible modules; Restore from Trash.

**System and plumbing**
- Token architecture: one `--dark-*` source block feeding both `data-theme` and `prefers-color-scheme`, a three-state theme toggle with pre-paint init, and zero hex values in components.
- A dark palette that is designed dark, not inverted, with tinted dark shadows and no glows.
- The global `prefers-reduced-motion` kill (`globals.css:524-540`).
- Categories and projects stored by token name, so recolouring the palette recolours data.
- `min-h-11` hit targets, 167 `aria-*` uses, and `aria-hidden` on decoration.
- Electron drag-region and `.no-drag` discipline, and the 36px titlebar band.
- A shared page frame and rail width token (the template is the problem, not having a frame).
- Mono for time and duration numerals (narrow it to numerals only).

---

## 6. Bugs to fix in v1 now

These are defects, not design choices, and they shouldn't wait for v2:

1. **P-40:** Next 7 Days titles render at 0px.
2. **P-03:** the capacity warning after `DAY_END_HOUR`, and overdue counting toward planned (also redesign_features.md 2.2).
3. **P-31:** Esc on the timer-switch dialog closes the panel underneath.
4. **P-30:** a quick-add `#typo` silently creates a project.
5. **P-24, P-23:** white-on-accent in dark mode, and placeholders at 2.3:1. These are one-line token fixes.

---

## 7. Questions for choosing the v2 design language

Each one is drawn from the root causes. A candidate direction should have a
clear answer to all of them.

1. **One thing (RC1).** If Today could only show one task and one verb, with everything else one keystroke away, what is Today? Do planning (Timeline, capacity), capture (Notepad, Quick list) and status move to their own modes?
2. **Time as shape, not score (RC3).** Can capacity and the day be *seen*, as a single day rail or arc you live inside, rather than read as "0M" and "960M UNTRACKED"? What does "overdue" look like in an app that refuses to count days at you?
3. **A voice that sets the visual voice (RC2, RC4, RC5).** The copy is warm and quiet; the visuals are an AI-blue dashboard template. Should v2 be warmer and quieter? If so, what replaces the blue gradient, the serif-plus-mono-caps pairing and the eyebrow pills?
4. **Navigation (RC7).** Which nav items would an easily-overwhelmed user miss if they vanished? Could the shell be Today, Plan, Time and Everything else, with Completed and Trash always reachable?
5. **Feedback (RC6).** What is the one undo/confirm pattern every action uses?
6. **Window sizes (RC8).** Is the target a full-screen app or a half-screen companion? The answer decides the sidebar and panel model.
