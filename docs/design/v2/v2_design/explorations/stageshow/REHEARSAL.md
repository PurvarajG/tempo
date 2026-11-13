# Rehearsal notes

## Round 3 (current)

The user asked to make the three dashboards "interesting, modern and functional". Same three directions, pushed further:

- **G. Docket:** a large date, an Add or Find switch in the command bar, project filters, a just-finished task with an Undo toast, hover quick actions, and a done, planned and free bar.
- **H. Ledger:** the day tape with the past shaded, hour rules and a now capsule; the selected row expanded with its note, three verbs and key hints.
- **I. Planner:** a week strip with daily load, a task mid-drag with its landing slot, and a done-today list.

`film.mjs --still --gate` passed for all six stills. Round 2 is in `shots/round-2` and `src/round-2`.

## Round 2

Three still mock screens of Today as a dashboard (G. Docket, H. Ledger, I. Planner), each in light and dark. They are compared against the C. Fader baseline, captured from `../directions.html`. `index.html` shows them side by side.

- **Brief changes from round 1:**
  - Fader's centred tab bar is kept: `src/tempo-shared/TopBar.tsx`.
  - Today shows tasks, input and the day. No single task is enlarged; the first task is selected and carries Start.
  - Each direction uses a different input:
    - G: a command bar with a chip preview.
    - H: a table row that fills its own columns.
    - I: a docked composer with chips inside the field.
- **Gold copied:** `linear` and `fade-crop` for the wide-hero framing. The window sits inset at the top and sides and runs off the bottom.
- **Gate:** `film.mjs --still --gate` passed for all six stills.
- **Not done:**
  - No `compact` (358px) design.
  - No motion, so typing, parsing and dragging are not animated.
  - No fresh-eye review by a second agent.
- **Rebuild:** copy `src/tempo-*` into the stageshow skill's `examples/` folder next to `kit/` and film with `?capture=tempo-<name>`. Fonts load from Google Fonts.

## Round 1

D. Meridian, E. Folio and F. Station are in `shots/round-1` and `src/round-1`. Each was built around one large next task. The user set that idea aside because the big task may not be the one they mean to do, and because their nav placement didn't match Fader's.
