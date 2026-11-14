# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] - 2026-11-13

### Changed
- The app is now called Doem. It was called Tempo before. The name, lockup, mark and macOS icon are new.
- The v2 redesign: a new shell with a translucent sidebar, a refreshed top bar, and new styling for task rows, panels, cards and pickers in light and dark themes.
- Today is rebuilt around committed tasks, an Up next row, carried-over tasks, a day timeline and a done-today list.
- Calendar, Tracking, Next 7 days, project boards, Settings and the end-of-day wrap-up follow the same design language.

### Added
- A menu bar menu, opened by either click: the running timer with Stop Tracking, today's tracked total, pinned activities, today's tasks and tasks tracked earlier today. Picking one starts timing it without opening the window. The menu bar shows activity timers as well as task timers, and times past an hour as `1:02:34`.
- The quick capture shortcut can be recorded in Settings > Desktop, with a reset to the default.
- A once-a-day check for a newer release. The packaged app sends a GET request to `api.github.com/repos/PurvarajG/doem/releases/latest`. No data about you is sent.
- A README, an MIT licence and a release checklist.

### Fixed
- An activity timer started from the Tracking page now shows in the sidebar card and the top bar on every page, and after a restart.

### Migration
- On first launch, Doem moves data from the Tempo (or earlier DayPlan) data folder into its own folder, including the database, desktop settings, theme choice and sidebar state. If the old app is still running, the move waits until it has quit. Keep your own backup before upgrading if the data matters.

### Known issues
- The app is not signed or notarized. macOS asks for a one-time right-click, Open (or Open Anyway in System Settings, Privacy & Security) on first launch.
- At a window size of 1440 by 900 the sidebar Completed row can sit under the sidebar foot.
- The Up next row can truncate its last meta item.
- Apple Silicon only. There is no Intel build.

## [0.1.3]

### Added
- Focus-first design tokens and shared interface primitives.
- A week-planning grid for Next 7 days, a two-pane Settings layout, and a focus band on project pages.

### Changed
- Calendar and Tracking restyled; page headers unified; the sidebar became an opaque charcoal rail; project colours now come from one palette.

### Fixed
- The focus card no longer glows and the week grid no longer collapses.
- The tracking settings validator no longer truncates collapse keys.

## [0.1.2]

### Added
- Day and week views in the calendar.
- A complete dark mode and an in-app mark and wordmark.

### Changed
- Layout hierarchy refined; the window is reliably draggable.

### Fixed
- Category and task pickers in Tracking are no longer clipped.
- The macOS app bundle is now always sealed when packaged.

## [0.1.1]

### Fixed
- The DMG download opens outside the hosted site.
- Releases are published through the workflow action.

## [0.1.0]

- First release of the Tempo desktop app for Apple Silicon Macs.
