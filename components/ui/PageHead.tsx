/**
 * The page frame every route shares in v2: a two-tone H1, one plain
 * sentence, and an actions slot. Replaces PageShell; the breadcrumb that
 * used to be PageShell's `label` now lives in the top bar.
 *
 * Frame and rail mechanics are PageShell's, unchanged. Every frame rule uses
 * the `shell:` variant (`@media (min-width: 900px)`, the Electron window's
 * real minWidth), not Tailwind's stock `lg:`. The two-column rail grid only
 * engages at the wider `rail:` variant (1200px): below it the rail stacks
 * under the primary column inside the shell's own scrolling region.
 *
 * Each pane is `rail:min-h-0 rail:overflow-y-auto` inside a grid row held to
 * `minmax(0,1fr)` with the default `stretch` alignment. `align-items` must
 * never be overridden to `start` at `rail:`: that sizes each pane to its
 * content, which can never overflow, so the per-pane scroll goes inert. The
 * outer workspace scroll (`shell:overflow-y-auto`) is switched off at
 * `rail:` via `rail:overflow-hidden` so the two scroll mechanisms never both
 * apply to one element.
 *
 * Gutter: no scrolling box may clip a child's hairline, shadow or focus ring,
 * all of which paint outside the child's box. The scroll body (from `shell:`)
 * and both rail panes (from `rail:`) carry a 4px gutter, negative margin plus
 * equal padding, so the visible edges stay aligned with the head. The body
 * keeps its gutter at `rail:` too: it is `overflow-hidden` there, and the
 * panes' own -4px margins reach into its padding, which would otherwise be
 * clipped. `shell:mt-5` plus the 4px top padding keeps the first child at the
 * same 24px below the head.
 *
 * The one change from PageShell: the frame is `shell:h-full`, not
 * `shell:h-dvh`, because the page now sits inside AppChrome's inset main
 * panel under the top bar, whose container gives it a definite height.
 *
 * Rail children are `shrink-0` (`[&>*]:shrink-0` on the aside): each keeps its
 * natural height and the rail pane scrolls, so a clipped card (overflow-hidden)
 * can never collapse to a hairline.
 *
 * The panes scroll without a visible bar (`.pane-scroll`): a classic bar would
 * take 11px of a pane's width and pull the cards' right edge off the head's.
 * The frame has no bottom padding from `shell:`: the scroll body runs to the
 * panel's bottom edge, as the mockup's page does, and the panes carry the 32px
 * of end-of-page air as their own bottom padding (`pb-9` = 32px plus the gutter).
 *
 * The frame is left-aligned at the panel's 32px padding on every route, with no
 * max width; a page that wants a reading width wraps its own body.
 *
 * `actions` is wrapped in `.no-drag` so callers never have to remember to
 * opt out of the titlebar drag band.
 */
export default function PageHead({
  title,
  dim,
  subtitle,
  leading,
  actions,
  headerExtra,
  rail,
  workspaceTestId = "page-shell-workspace",
  children,
}: {
  title: React.ReactNode;
  /** Second tone of the H1, rendered inside it in a lighter weight and colour. */
  dim?: React.ReactNode;
  /** One plain sentence under the heading. */
  subtitle?: React.ReactNode;
  /** A mark before the title block (the Project page's letter logo); the block becomes a centred row. */
  leading?: React.ReactNode;
  actions?: React.ReactNode;
  /** Extra header content below the title row, before the body begins. */
  headerExtra?: React.ReactNode;
  /** An optional side rail; see the component comment for how it lays out. */
  rail?: React.ReactNode;
  /** Overrides the workspace container's data-testid (defaults to "page-shell-workspace"). */
  workspaceTestId?: string;
  children: React.ReactNode;
}) {
  const titleBlock = (
    <div className="min-w-0">
      <h1 className="text-h1 text-ink">
        {title}
        {dim != null && dim !== false && (
          <>
            {" "}
            <span className="font-normal text-ink-dim">{dim}</span>
          </>
        )}
      </h1>
      {subtitle && <p className="mt-2 text-title font-normal tracking-normal text-ink-3">{subtitle}</p>}
    </div>
  );

  return (
    <div
      className="w-full px-8 py-8 shell:flex shell:h-full shell:flex-col shell:overflow-hidden shell:px-8 shell:pb-0"
    >
      <header className="flex shrink-0 flex-col gap-6">
        <div data-part="head" className="flex items-end gap-6">
          {leading ? (
            <div className="flex min-w-0 items-center gap-4">
              {leading}
              {titleBlock}
            </div>
          ) : (
            titleBlock
          )}
          {actions && <div className="no-drag ml-auto flex items-center gap-2">{actions}</div>}
        </div>

        {headerExtra || null}
      </header>

      <div
        data-testid={rail ? workspaceTestId : undefined}
        className={`pane-scroll mt-6 grid grid-cols-1 gap-6 shell:-mx-1 shell:mt-5 shell:min-h-0 shell:flex-1 shell:overflow-y-auto shell:p-1 shell:pb-9${
          rail
            ? " rail:grid-cols-[minmax(28rem,1fr)_var(--width-rail)] rail:grid-rows-[minmax(0,1fr)] rail:gap-x-6 rail:overflow-hidden rail:pb-1"
            : ""
        }`}
      >
        <div className={rail ? "pane-scroll min-w-0 rail:-m-1 rail:min-h-0 rail:overflow-y-auto rail:p-1 rail:pb-9" : "min-w-0"}>
          {children}
        </div>
        {rail && (
          <aside className="pane-scroll flex min-w-0 flex-col gap-4 [&>*]:shrink-0 rail:-m-1 rail:min-h-0 rail:overflow-y-auto rail:p-1 rail:pb-9">
            {rail}
          </aside>
        )}
      </div>
    </div>
  );
}
