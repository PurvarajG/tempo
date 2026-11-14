<a href="https://github.com/PurvarajG/doem/releases/latest/download/Doem-latest-arm64.dmg">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/media/banners/hero-dark.png">
    <img src="docs/media/banners/hero-light.png" alt="doem. Plan the day. Know where it went. Tasks, calendar and a timer in one window.">
  </picture>
</a>

<p align="center">
  <a href="https://github.com/PurvarajG/doem/releases/latest/download/Doem-latest-arm64.dmg"><img src="https://img.shields.io/badge/Download%20for%20Mac-Free-4a4ae8?style=for-the-badge&logo=apple&logoColor=white" alt="Download for Mac, free"></a>
</p>

<p align="center">
  <a href="https://github.com/PurvarajG/doem/releases/latest"><img src="https://img.shields.io/github/v/release/PurvarajG/doem?style=flat-square&color=4a4ae8&label=latest" alt="Latest release"></a>
  <img src="https://img.shields.io/badge/Apple%20Silicon-macOS%2012%2B-141519?style=flat-square" alt="Apple Silicon, macOS 12 or later">
  <a href="LICENSE"><img src="https://img.shields.io/badge/open%20source-MIT-141519?style=flat-square" alt="Open source, MIT"></a>
</p>

<h3 align="center">Your to-do list doesn't know how long things take.<br>Your calendar doesn't know what you need to do.<br>Doem knows both.</h3>

<br>

## Know what fits before you say yes

Most to-do apps let you pile twelve hours of work onto an eight-hour day and wish you luck. Doem gives every task an estimate and every day a capacity, so you can see the day is full before you agree to one more thing.

- **Every day shows how full it is.** Planned time adds up as you add tasks, and a day that's overbooked says so: *Over by 3h 31m*.
- **Capture in a second, from any app.** Press Control+Option+Space, type `Call printer 20m tomorrow #project`, and the date, estimate and project fill themselves in.
- **Commit to today.** Press `*` on the tasks that really matter and keep the rest for later.

<img src="docs/media/banners/feature-plan.png" alt="Know what fits before you say yes. The Next 7 days view, with a day flagged as over by 3 hours 31 minutes.">

## Your week, blocked out

A list tells you what to do. A calendar tells you when. Doem puts both in one view, so a plan turns into actual hours in your week.

- **Plans change. Drag them.** Move a task to another day and the week rebalances.
- **See planned time beside tracked time.** Planned blocks are solid and tracked time is striped, so you can see where the day went to plan and where it didn't.
- **Your iCloud calendar sits in the same view.** Meetings and tasks share one timeline. Doem can also publish its tasks as a feed that macOS Calendar subscribes to.

<img src="docs/media/banners/feature-calendar.png" alt="Your week, blocked out. The week calendar with tasks and events side by side.">

## See where the hours went

Tracking time usually takes so much effort that people give up after a week. In Doem it takes one key: press S on a task to start the timer, and S again to stop it.

- **The timer lives in the menu bar.** The running task and its time are always one glance away, with an optional nudge when nothing has been tracked for a while.
- **Find out how good your guesses are.** Tracking compares what you planned with what you spent, by day and by project, and shows your plan accuracy.
- **End the day with a clean slate.** A two-minute wrap-up shows what got done, which estimates ran over and what's on for tomorrow.

<img src="docs/media/banners/feature-tracking.png" alt="See where the hours went. Time by day and project, with plan accuracy at 38 percent.">

## Made for people who ship with Claude Code

Doem watches your Claude Code sessions without changing them. When one stops to wait for your reply, you get a notification: *Claude is waiting in pricing-site*. Doem can then add that session to your day as a time block, so agent work shows up in your plan like any other task.

## Never reach for the mouse

Everything has a key. `J` and `K` to move, `X` to finish, `T` for tomorrow, `F` to start a focus session, `Cmd K` for everything else. Learn five keys and you'll fly through your list.

## And everything else you'd want

- **Projects as boards**, each with its own stages.
- **Light and dark themes**, each designed separately, plus an optional Dock badge that counts today's tasks.
- **No account, no sign-up.** Open it and start. Everything is saved on your Mac.

## Get started

1. **[Download Doem](https://github.com/PurvarajG/doem/releases/latest/download/Doem-latest-arm64.dmg)** and drag it into Applications.
2. The first time, right-click Doem and choose **Open**. You only need to do this once.

<details>
<summary>Requirements and first-launch help</summary>

<br>

Doem runs on Apple Silicon Macs (M1 and later) with macOS 12 or newer.

The app is not yet signed with an Apple Developer certificate, so macOS asks before the first launch. Right-click Doem in Applications and choose Open, then choose Open in the dialog. If that option does not appear, open System Settings, go to Privacy & Security, find the message about Doem and choose Open Anyway. Later launches open normally.

If you used the app under its earlier name, Tempo, Doem moves your existing data over on first launch.

Doem keeps your data in a local database on your Mac. It contacts the internet only to check once a day for a new version (`api.github.com`), and to read your iCloud calendar if you connect one in Settings.

</details>

<details>
<summary>Keyboard shortcuts</summary>

<br>

In a task list:

| Key | Action |
| --- | --- |
| J / K | Next / previous task |
| X or Space | Mark done |
| T | Move to tomorrow |
| D | Pick a day |
| S | Start or stop the timer |
| F | Start a focus session |
| * | Commit to today |
| E or Enter | Open task |
| Backspace | Move to trash |
| / | Add a task |
| ? | Show shortcuts |

Anywhere in the app:

| Keys | Action |
| --- | --- |
| Cmd K | Search and commands |
| Cmd N | New task |
| Cmd Z | Undo |
| Cmd 0 to 5 | Inbox, Today, Calendar, Tracking, Next 7 days, All tasks |
| Cmd Shift E | Wrap up the day |

</details>

<details>
<summary>Build from source</summary>

<br>

Requires Node.js 22 and macOS.

```sh
npm ci
npm run dev            # Next.js dev server on http://localhost:4700
npm run electron:pack  # unpacked app in dist-electron/mac-arm64/Doem.app
npm run electron:build # .dmg for Apple Silicon
```

Other useful scripts: `npm test` (unit and UI tests), `npm run typecheck`, `npm run lint`. Set `PGLITE_DIR` to a folder of your choice to keep a development database apart from the app's own data.

Design documents for the v2 redesign are in [docs/design/v2/](docs/design/v2/), release steps in [docs/release-checklist.md](docs/release-checklist.md), brand assets in [brand/doem/](brand/doem/START-HERE.md) and these README banners in [docs/media/banners/](docs/media/banners/).

</details>

<br>

<a href="https://github.com/PurvarajG/doem/releases/latest/download/Doem-latest-arm64.dmg"><img src="docs/media/banners/footer.png" alt="Your day, finally in one place. Download Doem, free for Apple Silicon Macs."></a>

<p align="center"><sub>MIT licensed. See <a href="LICENSE">LICENSE</a>.</sub></p>
