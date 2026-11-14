# Doem rebrand: execution plan

Written 2026-11-13. Run it in a fresh chat, top to bottom. It renames the app from Tempo to Doem and puts in the owner's new logo, as **one change**. This file is self-contained; the decisions behind it are in `rebuild/v2_build/decisions.md` (decision 22, "Rename to Doem").

## 0. Ground rules

- **Names.** Lowercase `doem` in the logo only: the sidebar wordmark beside the mark, and the lockup SVGs. `Doem` everywhere else: macOS app and menu name, window and page titles, Dock, notifications, Settings copy, docs. `doem` in code identifiers. Never "DoEm" or "Do'em".
- **Logo.** Concept **01 Task d** (task rows forming a lowercase d). The owner's package is in `brand/doem/`. Read `brand/doem/START-HERE.md` first. Do not redraw or restyle the mark. Section 2 lists the only geometry changes allowed, and they keep the shape exactly.
- **Do not run** `brand/doem/source/render.swift` or `build_icns.py`. Render with the tools named below.
- **One change.** Nothing is half renamed at any checkpoint you commit. Work on a branch `rebrand/doem` cut from `redesign/v2-build`. One commit at the end (or one per section, squashed before merge). Ask the owner before pushing or merging.
- **The real data is at `~/Library/Application Support/Tempo`.** Never open the packaged app on it until section 5. Test on a copy first.
- Port 4700 for the dev server (`npm run dev`). Mac only; skip mobile.
- History stays as written: `rebuild/v2_build/*` reports, ledger and old phase notes keep "Tempo". So does the DayPlan-to-Tempo migration code.

**Before starting:** `git status` must be clean. If it is not, stop and ask the owner whether to commit what is there (at the time of writing, three small UI fixes, `brand/doem-design-language.html`, `brand/doem/` and the decisions entry were uncommitted).

## 1. Inventory (5 minutes, no edits)

Run and keep the output; section 6 checks it again.

```bash
grep -rIn --exclude-dir={node_modules,.next,dist-electron,.git,backups,data,rebuild} -i "tempo" . | wc -l
```

About 390 hits in 83 files on 2026-11-13. The known groups:

| Group | Where | Examples |
|---|---|---|
| App identity | `package.json` (`name`, `build.appId`, `build.productName`), `electron/main.js` (`app.setName("Tempo")`, menu labels, About) | `com.purvarajsinh.tempo` |
| IPC channels | `electron/main.js`, `electron/preload.js`, `lib/desktop-bridge.ts` | `tempo:command`, `tempo:claude-sessions`, `tempo:capture-*`, `tempo:set-*`, `tempo:notify`, `tempo:attention`, `tempo:can-toggle-timer`, `tempo:timer-status`, `tempo:get-*`, `tempo:command-palette` |
| Browser storage keys | sidebar and Today components | `tempo.sidebarCollapsed`, `tempo.sidebarOpenProject`, `tempo.projectsCollapsed`, `` `tempo.today.skip.` `` |
| DOM ids | quick add, search, capture | `tempo-quick-add`, `tempo-inbox-quick-add`, `tempo-sidebar-search`, `tempo-capture` |
| Files | log and calendar export | `tempo.log`, `tempo.ics` |
| Brand | `components/TempoMark.tsx`, `components/Sidebar.tsx`, `brand/tempo-mark.svg`, `brand/icons/*`, `brand/*lockup*`, `app/favicon.ico`, `app/icon.png`, `app/apple-icon.png`, `scripts/make-icon.mjs`, `build/icon.*` | |
| Copy | page titles (`app/layout.tsx` `TITLE_TEMPLATE`), Settings, notifications, splash HTML in `electron/main.js`, README, docs | |

## 2. Fix the brand assets (in `brand/doem/`)

The owner approved these fixes. They change placement and size only, never the shape. The path data `d="M 150 22 … Z"` stays byte-for-byte the same.

**2a. Centre the mark in its canvas.** The path's bounding box is x 8–194, y 4–204 inside a 220 square, so the mark sits up and to the left and has only 4 units of space at the top. In all five `svg/doem-mark-*.svg` and the four `svg/doem-lockup-*.svg` mark positions, centre the glyph and give it one bar's thickness of clear space (~34 units) on every side:
- Mark files: `viewBox="-33 -30 268 268"`, `width="268" height="268"`. The bounding-box centre (101, 104) is then the canvas centre.
- Lockups: shift the text the same way so the gap between mark and word stays as designed, and fix the height to the new mark box.
- Check by rendering each at 512 px and measuring the transparent margins: left equals right and top equals bottom, within 1 px.

**2b. App icon to the macOS grid.** `svg/doem-app-icon.svg` has an 864 px tile with no shadow. Apple's icons (compare Notes in the Dock) use an 824 px tile inset 100 px, with a corner radius of about 185 px and a soft drop shadow. Change it to:
- `<rect x="100" y="100" width="824" height="824" rx="185.4" fill="#4a4ae8"/>`.
- A soft shadow under the tile, about 0 10 px offset, 10 px blur, black at 30%, as in Apple's macOS icon template. Use an SVG `<filter>` with `feDropShadow`, and keep it inside the 1024 canvas.
- The mark at the same share of the tile as before: scale 2.575, placed so its bounding-box centre lands on (512, 512): `transform="translate(251.9 244.2) scale(2.575)"`. If it looks low in the Dock, nudge it up by 4 to 8 px at most, and note the value.
- Do the same centring for `web/favicon.svg`.

**2c. Outline the lockup text.** The lockups use live Geist text, which falls back to another font anywhere Geist is missing. Replace the `<text>` with a `<path>`:
- Font: Geist SemiBold (600). Get the file from the official `geist` npm package (`npm i --no-save geist`, then look under `node_modules/geist/dist/fonts/`) or the vercel/geist-font GitHub release. **Ask the owner before downloading anything.**
- Convert with `opentype.js` (`npm i --no-save opentype.js`): `font.getPath("doem", x, y, 170, { letterSpacing: -0.03 })` and `.toPathData(2)`. Keep the lockup's fill colours.
- Check by rendering the old and new lockups at 1460 px wide with Geist installed. The outlines should overlay the live text exactly.

**2d. Re-render the rasters** from the fixed SVGs:
- `png/doem-app-{16,32,64,128,256,512,1024}.png`, `png/doem-mark-{indigo,white,template}-{16..1024}.png`, and add `png/doem-mark-dark-{16..1024}.png` (missing from the package).
- Use `rsvg-convert -w N -h N` if installed, otherwise `magick -background none -density 1200 in.svg -resize NxN out.png`. All must be RGBA with a transparent background.
- `doem-mark-template-*`: pure black (#000000) plus alpha, nothing else.
- Rebuild `macos/Doem.iconset` (the 10 standard `icon_NxN[@2x].png` names) and `macos/Doem.icns` with `iconutil -c icns macos/Doem.iconset`.

**Not in scope:** a simplified 16 px mark. At 16 px the three bars run together (gaps of about 1 px). That only affects Finder list view, the browser tab and the 1x menu bar. It is the owner's design call, so record it as an open item for the owner and do not draw one.

**Checkpoint 2:** make one contact sheet in the scratchpad: the mark at 16, 32 and 64 px on `#f6f6f3` and `#121318`, the template in a light and a dark menu bar strip, and the app icon at 256 px beside `/System/Applications/Notes.app` (convert its `AppIcon.icns` with `sips`). Look at it once, fix what it shows, and move on.

## 3. Put the brand into the app

1. **Brand folder.** Delete `brand/tempo-mark.svg`, `brand/icons/`, `brand/badge-lockup.png` and `brand/logo-lockup-dark.png` (`git rm`; they stay in history). `brand/doem/` becomes the source of truth. Leave `brand/doem-design-language.html` in place.
2. **Sidebar mark.** Replace `components/TempoMark.tsx` with `components/DoemMark.tsx`: an inline `<svg viewBox="-33 -30 268 268">` with the path, `fill="var(--color-accent)"` and `aria-hidden`. The accent token is already #4a4ae8 light and #8a8bff dark, and it follows the app's own theme setting (`data-theme`), not just the system setting. Update the import in `components/Sidebar.tsx`.
3. **Sidebar wordmark.** In `components/Sidebar.tsx`, the text becomes lowercase `doem`. Keep `text-brand` (Geist 600, 20 px, −0.03 em) and `gap-3`. The README asks for a 10 px gap, but the existing 12 px matches the mockup, so keep 12 and say so. The home link gets `aria-label="Doem home"`. Mark at `size-8` (32 px).
4. **Browser tab and web icons.** Generate `app/icon.png` (512) and `app/apple-icon.png` (180) from the fixed app icon, and `app/favicon.ico` (16, 32 and 48) with `magick` from the favicon SVG. Delete any old Tempo icon files in `public/`.
5. **App icon build.** Rewrite `scripts/make-icon.mjs` to read `brand/doem/png/doem-app-*.png` (or copy `brand/doem/macos/Doem.icns` and `doem-app-1024.png` straight into `build/icon.icns` and `build/icon.png`). Update its header comment. Otherwise `npm run electron:icon` rebuilds the old Tempo icon on every pack.
6. **Menu bar icon.** In `electron/main.js` `createTray()`, stop resizing the colour app icon. Copy `doem-mark-template-16.png` and `-32.png` to `build/trayTemplate.png` and `build/trayTemplate@2x.png`, load with `nativeImage.createFromPath(path.join(__dirname, "..", "build", "trayTemplate.png"))`, then call `image.setTemplateImage(true)`. Add `build/trayTemplate*.png` to `build.files` in `package.json`, next to `build/icon.png`. Electron picks up the `@2x` file by name.
7. **Splash screen.** Update the splash HTML in `electron/main.js` if it shows the old mark or name.

## 4. Rename Tempo to Doem in code and copy

1. **Identity.** `package.json` `name` becomes `doem`, `build.productName` becomes `Doem` and `build.appId` becomes `com.purvarajsinh.doem`. Changing the appId resets macOS notification permission and Login Items once; the owner accepted that with the rename. `app.setName("Doem")`. Menus, About and every user-facing string become "Doem".
2. **Data folder migration** (the risky part). `productName` decides the folder, so after the rename the app looks in `~/Library/Application Support/Doem`.
   - Generalise `migrateLegacyUserData()` in `electron/main.js` (around line 98) to try a list of earlier names in order, `["Tempo", "DayPlan"]`, with the same two branches: move the whole folder if the new one does not exist; otherwise move only `pglite` into an unclaimed slot, and never overwrite.
   - Also carry `settings.json` across in the second branch, under the same never-overwrite rule.
   - Add a unit test with a temp directory for each case: fresh install, Tempo only, DayPlan only, both present, and Doem already present.
   - Update the comments to say DayPlan → Tempo → Doem.
3. **IPC channels.** Rename every `tempo:*` channel to `doem:*` in `electron/main.js`, `electron/preload.js` and `lib/desktop-bridge.ts`, plus their tests, together. Main and preload ship in the same bundle, so no compatibility shim is needed. Grep both sides and make the counts match.
4. **Browser storage keys.** Rename `tempo.*` to `doem.*`. On first read, if the new key is missing, read the old key, write it under the new one and remove the old one. Do this in one small helper (for example `lib/storage-key.ts`), not repeated in each component. The `` `tempo.today.skip.` `` prefix keys are per-day and short-lived, so rename them without migrating.
5. **DOM ids and files.** `tempo-*` ids become `doem-*`, with their tests and any `getElementById` or `htmlFor` uses. `tempo.log` becomes `doem.log`, and the old log can stay behind. `tempo.ics` becomes `doem.ics`; check whether any calendar subscription URL depends on the file name, and if it does, keep serving the old path as an alias.
6. **Copy and titles.** `TITLE_TEMPLATE` in `app/layout.tsx`, Settings descriptions ("How Doem looks…"), notifications ("Doem reminder"), capture window, tray menu, README, and `docs/`. Keep `AGENTS.md` as `next dev` writes it.
7. **Tests.** Update test strings and selectors that say Tempo. Do not weaken an assertion just to pass.

## 5. Verify

Run all of these; fix and re-run until they pass. Stop after one fix round per item and report anything still failing.

1. `npm run typecheck`, `npm test`, `npm run lint`, and `bash scripts/v2-gates.sh` if it takes a phase argument (read its header).
2. **Style check.** Start the lab server on :4700, then `node scripts/v2-shots.mjs doem-rebrand` and `node scripts/v2-shots.mjs --style-check doem-rebrand`. It must stay at or above 99% in both themes (it was 100% on 2026-11-13). Compare the sidebar crop: the mark at 32 px sits centred on the "doem" text line.
3. **Grep.** The section 1 grep returns only allowed hits: the migration code's list of old names, its comments and test, and `rebuild/` history. List every remaining hit in the report.
4. **Package, then test on a copy of the data.**
   - `npm run electron:pack`.
   - Copy the real data: `cp -Rp ~/Library/Application\ Support/Tempo /tmp/doem-test/Tempo`.
   - Launch `dist-electron/mac-arm64/Doem.app` with a throwaway userData parent. If main.js has no override for this, add a temporary `DOEM_USER_DATA_PARENT` env read for the test, or test the migration only through the unit test, and say which you did.
   - Confirm that the tasks appear, the log is `doem.log`, and nothing was written back to the source copy.
5. **Real run.** Back up `~/Library/Application Support/Tempo` to `~/Library/Application Support/Tempo-backup-<date>` first (a backup from 2026-11-13 exists, but make a fresh one). Quit any running Tempo, open `Doem.app`, and check:
   - Your tasks are there.
   - The Dock icon sits the same size as its neighbours.
   - The menu bar icon is the template mark and turns white in a dark menu bar.
   - The sidebar shows the indigo mark and "doem" in light and dark, including with the theme set by hand in Settings.
   - The browser tab icon on the dev server.
   - The About box and menus say Doem.
   - A notification says Doem.
6. **Auditors.** Run the project's `tempo-package-auditor` (bundle, signature, userData migration) and `tempo-shell-auditor` (IPC rename on both sides). Run `tempo-style-auditor` only if `app/globals.css` changed. Fix anything they BLOCK on.

## 6. Finish

- Update `rebuild/v2_build/decisions.md` decision 22 from "Not started" to "Done" with the date, and add a short section to `rebuild/v2_build/REPORT.md` listing what changed, what was verified and the open owner items.
- One commit on `rebrand/doem`: `feat: rename Tempo to Doem, new logo and icons`. Show the owner the diff stat and the contact sheet before committing, then ask before pushing or merging.
- Stop any server you started (`~/.claude/bin/port-check --stale`).

## Owner items to carry

- A simplified 16 px mark (the three bars blur together at 16 px).
- Whether the old `~/Library/Application Support/Tempo` folder (now empty or moved) and the backups can be deleted.
- The app is still unsigned (ad-hoc). Unchanged by this plan.
