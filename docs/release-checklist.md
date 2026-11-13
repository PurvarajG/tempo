# Doem release checklist

Run `npm run smoke:app -- <path-to-Doem.app>` first. It covers first launch, 20 quit and relaunch cycles, the second-launch handoff, kill -9 recovery and the Tempo upgrade, all against an isolated data folder. Everything below is what no script can do. Use a copy of the build installed the way a user would, not the dev build.

Tick each box only after seeing the "pass" result.

## Install and first open

- [ ] **Install from the DMG.** Download the DMG from the release page in a browser (so it gets the quarantine flag), open it, drag Doem to /Applications, eject. Pass: Doem.app sits in /Applications with the Doem icon.
- [ ] **First open past Gatekeeper.** Open Doem from /Applications. If macOS blocks it, use System Settings > Privacy & Security > Open Anyway. Pass: the splash shows, then the app loads, with no "damaged" message and no second prompt on later launches.
- [ ] **Notification permission prompt.** On a first run (or after `tccutil reset Notifications com.purvarajsinh.doem`), trigger the first reminder or nudge. Pass: macOS asks once, and after Allow a notification appears.

## Desktop shell

- [ ] **Capture shortcut.** Press Ctrl+Option+Space from another app. Pass: the capture bar appears over it, typing and Enter adds a task to the Inbox, the shortcut again (or Esc) hides the bar.
- [ ] **Tray menu.** Click the menu bar icon. Pass: Quick add opens the capture bar, Start/Stop timer starts and stops the timer (the tray label shows elapsed time while running), Open brings the window forward.
- [ ] **Closing and reopening.** Close the window with the red button, then click the Dock icon. Pass: the window returns with the same page, no second server starts, and the timer (if running) kept counting.
- [ ] **Second launch focuses.** With Doem open, open it again from Spotlight. Pass: the existing window comes to the front, no second Dock icon.
- [ ] **Dock badge.** Create overdue or due-today tasks. Pass: the Dock icon shows the count, and it clears when the tasks are done.
- [ ] **Quit while a timer runs.** Start a timer, press Cmd+Q, reopen. Pass: no error dialog, the timer is still running or was stopped cleanly with a believable duration, no entry is lost.

## Time and reminders

- [ ] **Reminder with the window hidden.** Give a task a due time two minutes ahead, close the window (keep the app running), wait. Pass: a notification appears with actions Start, Snooze 15m and Tomorrow. Start starts the timer on that task. Snooze 15m fires again 15 minutes later. Tomorrow moves the task to tomorrow.
- [ ] **Away prompt.** Start a timer, lock the screen (Ctrl+Cmd+Q) for more than 60 seconds, unlock. Pass: a prompt asks what to do with the away time (keep, break, discard) and each choice is applied to the entry.
- [ ] **Nudge.** With no timer running and the screen unlocked and active for the configured period, wait. Pass: a "not tracking" notification appears once, and not while the screen is locked or the machine idle.
- [ ] **Focus session.** Press `f` on a task and start a session. Pass: the countdown runs, and when it ends a "Time's up" notification and the in-app state appear.
- [ ] **End-of-day wrap and weekly reset.** Open the end-of-day wrap (set the wrap time to a minute from now if needed), and open the weekly reset. Pass: both show the day or week's real numbers, finishing them records the review, and unfinished tasks are offered for tomorrow.

## Updates and theme

- [ ] **Update notification.** Quit Doem. Set `"version"` in the installed app's Contents/Resources/app/package.json to a lower number (for example 0.0.1), relaunch with the update check enabled (do not set `DOEM_NO_UPDATE_CHECK`). Pass: the app reports the newer release with a link to download it. Restore the version afterwards, or reinstall.
- [ ] **Dark theme.** In Settings, switch the theme to dark, then back to system. Walk Today, Inbox, Upcoming, Calendar, Tracking and Settings. Pass: no white flashes, no unreadable text, the sidebar and capture bar match, and the choice survives a restart.

## Release steps

1. Quit your own running Doem. `npm run electron:pack` writes into `dist-electron/mac-arm64/Doem.app`, the bundle you may be running, so it must not be open.
2. Bump `"version"` in package.json to `1.0.0` (the version is the only thing that changes in the commit), and commit it.
3. Open a PR from the release branch, wait for CI, merge it.
4. Tag the merge commit `v1.0.0` and push the tag.
5. Check the release workflow (`.github/workflows/release.yml`) finished green and the release has the DMG attached.
6. Check the download link on the release page: download the DMG, confirm the size and that it opens, then run the install and first-open checks above on it.
7. Deploy the site last, once the download link works, so the site never points at a missing file.
