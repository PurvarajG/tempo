# Owner decisions, 2026-11-13

These are the owner's answers to "Questions for the owner" in `REPORT.md`. Where the two disagree, this file wins. The numbers match that list.

## Changes to make

| # | Decision | Work |
|---|---|---|
| 5 | Build the Board tab on Today: List, Board, Day | New work; it was cut from the plan |
| 10 | Today cap: default 3, adjustable in Settings | Add a setting |
| 10 | Claude Code awareness is ON by default | Flip the `claudeAwareness` default in `SETTINGS_DEFAULTS` |
| 4 | Composer hint chips are always visible, not only when the composer is empty | Small change |
| 12 | Over capacity is red, like the mockup | Change the bar and the "Over by" text |
| 13 | Next 7 days shows List, Board and Calendar chips, like the mockup | Add the List and Board views |
| 16 | Remove the lane "..." menu on the board | Remove it |
| 22 | Rename the app from **Tempo** to **Doem** (decided 2026-11-13) | Done 2026-11-13 on `rebrand/doem`. See "Rename to Doem" below and REPORT.md "Doem rebrand" |

## Rename to Doem (decided 2026-11-13, done 2026-11-13)

**The new name is Doem.** It is one word, a blend of "do 'em" and *carpe diem*, said DOH-em. Not "DoEm", "Do'em" or "Doem App".

**Casing (owner, 2026-11-13):** lowercase **doem** in the logo only: the sidebar wordmark beside the mark and the lockup SVGs. **Doem** everywhere else: the macOS app and menu name, window and page titles, the Dock, notifications, Settings copy and prose. `doem` in code identifiers.

**Logo (owner, 2026-11-13):** concept **01 Task d** (task rows forming a lowercase d), not option 04, even though the concept sheet labels 04 "Selected". The owner's brand package is in `brand/doem/` (copied from `~/Downloads/doem-brand-package`). The execution plan is `rebuild/doem_rebrand_plan.md`.

**Status: done 2026-11-13** (branch `rebrand/doem`, plan `rebuild/doem_rebrand_plan.md`). The rules below applied while it was pending and are kept as history:
- Do not rename anything piecemeal. A half-renamed app (some strings Doem, some Tempo) is the failure to avoid. The rename lands as one change.
- Do not treat "Tempo" in code or docs as a mistake to fix in passing, and do not reintroduce it in new copy; new user-facing copy that needs the app name waits for the rename or uses no name.
- The owner is making the new logo and icons. The rename waits for them: the current `brand/` assets (`tempo-mark.svg`, `brand/icons/*`, lockups) and the in-app `TempoMark` are replaced by the owner's files, not redrawn by an agent.

**What the rename has to cover** (about 390 mentions in 83 files outside `node_modules`, `rebuild/` and build output, counted 2026-11-13):
- User-facing: window and menu names (`app.setName` in `electron/main.js`), the sidebar wordmark, page titles, Settings copy, notifications, the tray, the About panel.
- Packaging: `package.json` `name`, `build.appId` (`com.purvarajsinh.tempo`) and `build.productName`, the icon set, `scripts/make-icon.mjs`.
- **Data, the risky part:** `productName` sets the userData folder (`~/Library/Application Support/Tempo`). Renaming it without a move makes the app open empty. `electron/main.js` already migrated DayPlan to Tempo once (see the comment near line 98); the Doem rename extends that to Tempo to Doem, with a test, and backs the folder up first. Changing `appId` also resets macOS permissions and Login Items for the app.
- Internal identifiers: IPC channels (`tempo:*` in `electron/preload.js` and `electron/main.js`), `tempo.log`, localStorage keys, CSS or data attributes. Rename these in the same change so nothing is left half done, keeping a read of the old localStorage keys once.
- Docs: `README.md`, `AGENTS.md`/`CLAUDE.md` mentions, `docs/`. Old phase reports in `rebuild/` stay as written (they are history).

**Done when:** `grep -ri tempo` outside history files and the DayPlan/Tempo migration code finds nothing, the packaged app is `Doem.app` with the owner's icon, and it opens on the existing data.

## Keep as built

| # | Decision |
|---|---|
| 6 | Done today keeps its own rows (not `TaskRow`) |
| 10 | Capture shortcut Ctrl+Option+Space; `11/12` means 11 December (day/month); the Quick list merges into the Inbox |
| 14 | 24-hour time (`14:30`) everywhere. This also settles the `lib/next.ts` 12-hour finding: switch it to `fmtTime` |
| 15 | Calendar opens on Month (not Week as in the mockup) |
| 16 | Project header keeps the ghost Settings button and the Add lane tile; the summary card's fourth cell is Open tasks |
| 17 | Tracking keeps all its extras: Settings link, category select, sort toggle, day label and row menu |
| 18 | The 3 `quick_todos` rows are copied into `tasks` once |
| 20 | The Claude label on the ribbon stays 12px |

## Settled from the code (not asked)

| # | Answer |
|---|---|
| 1, 2 | Dark tokens and the two fixed shadow/tile colours stay as built (copied from `soft.html`) |
| 7 | Overrun = `plannedMinutes - minutesLeft`, as built |
| 8 | Unblocks keeps `up` and Committed keeps `target` |
| 9 | "Next 6 weekdays" means calendar days 2 to 7, weekends included, as built |
| 11 | Dark accent `#8a8bff` (from the notes) |
| 19 | Confirmed in code: `tracking_settings.claude_awareness` exists (`lib/store/rows.ts:145`) and the 60-second poll is at `electron/main.js:1018` |
| 21 | Phase 11 absorbed the reset 5A fix round. The open items are tracked in `REPORT.md` |

## Added 2026-11-13, after the gap audit

- **The 99% target is the shell and visual language, not tile content.** Match the glass sidebar, the sidebar foot (timer card and profile row with Settings), the top bar (search, bell, theme) and the look of the shared parts. The mockup's KPIs, numbers and card contents were placeholders. Where the app has its own features, keep them and style them with the mockup's parts. See Phase 12 in `v2_build_plan.md`.
- **Inbox:** designed in `soft.html#inbox`, awaiting owner approval.
- **Sidebar bell, profile row and project tree** are part of the shell, so they get built. This overrides the plan's section 1 deferral.
- **Glass in the Mac app:** keep real macOS vibrancy, so the desktop shows through the sidebar. The browser has no vibrancy, so it paints the mockup's scene gradient and grain behind the translucent shell.
- **Checkbox outline:** keep the build's 0.47 opacity for contrast. The style check excludes this property.
