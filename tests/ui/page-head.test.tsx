import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import PageHead from "@/components/ui/PageHead";

describe("PageHead", () => {
  test("renders title and actions", () => {
    render(
      <PageHead title="Today" actions={<button>Settings</button>}>
        <p>Body</p>
      </PageHead>,
    );

    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  test("wraps header actions in .no-drag, so they never fall into the titlebar drag band", () => {
    render(
      <PageHead title="August" actions={<button>Month</button>}>
        <p>Body</p>
      </PageHead>,
    );

    const action = screen.getByRole("button", { name: "Month" });
    expect(action.closest(".no-drag")).not.toBeNull();
  });

  test("without a rail, renders children in a single scrolling column", () => {
    const railClasses = [
      "rail:grid-cols-[minmax(28rem,1fr)_var(--width-rail)]",
      "rail:grid-rows-[minmax(0,1fr)]",
      "rail:gap-x-6",
      "rail:overflow-hidden",
    ];
    const { container, rerender } = render(
      <PageHead title="Results">
        <p>Result row</p>
      </PageHead>,
    );

    expect(container.querySelector('[data-testid="page-shell-workspace"]')).toBeNull();
    expect(screen.getByText("Result row")).toBeInTheDocument();

    const workspaceWithoutRail = screen.getByText("Result row").parentElement?.parentElement;
    expect(workspaceWithoutRail).not.toBeNull();
    for (const cls of railClasses) {
      expect(workspaceWithoutRail?.className).not.toContain(cls);
    }

    // Falsification control: prove the assertions above target the actual
    // workspace classes by rendering the same shell with a rail and requiring
    // every guarded token to become observable.
    rerender(
      <PageHead title="Results" rail={<div>Rail content</div>}>
        <p>Result row</p>
      </PageHead>,
    );
    const workspaceWithRail = screen.getByTestId("page-shell-workspace");
    for (const cls of railClasses) {
      expect(workspaceWithRail.className).toContain(cls);
    }
  });

  test("with a rail, splits into a two-column workspace grid and honours a custom testid", () => {
    render(
      <PageHead
       
        title="Today"
        rail={<div>Rail content</div>}
        workspaceTestId="today-workspace"
      >
        <p>Primary content</p>
      </PageHead>,
    );

    expect(screen.getByTestId("today-workspace")).toBeInTheDocument();
    expect(screen.getByText("Rail content")).toBeInTheDocument();
    expect(screen.getByText("Primary content")).toBeInTheDocument();
  });

  test("the root frame carries the shell: variant classes, not the stock lg: breakpoint", () => {
    const { container } = render(
      <PageHead title="Today">
        <p>Body</p>
      </PageHead>,
    );

    const root = container.firstElementChild as HTMLElement;
    // These are the specific classes that silently compiled to nothing when
    // `@custom-variant shell (min-width: 900px)` (missing the `@media`
    // at-rule form) was used — this jsdom check only proves PageHead still
    // EMITS the right className tokens; whether the `shell:`/`rail:`
    // variants actually compile to real CSS is covered separately in
    // tests/shell-variant-compiles.test.ts, since jsdom doesn't run a CSS
    // engine and can't see that failure mode at all.
    for (const cls of ["shell:flex", "shell:h-full", "shell:flex-col", "shell:overflow-hidden"]) {
      expect(root.className).toContain(cls);
    }
    // The frame must not have regressed back onto Tailwind's stock `lg:`
    // (1024px) breakpoint, which is narrower than what the Electron window
    // can actually reach down to (900px).
    expect(root.className).not.toMatch(/(?:^|\s)lg:(?:flex|h-dvh|flex-col|overflow-hidden)(?:\s|$)/);
  });

  test("the rail grid engages at rail:, with a floored primary column and the shared rail-width token", () => {
    const { container } = render(
      <PageHead title="Tracking" rail={<div>Rail content</div>}>
        <p>Body</p>
      </PageHead>,
    );

    const workspace = container.querySelector('[data-testid="page-shell-workspace"]') as HTMLElement;
    expect(workspace.className).toContain("rail:grid-cols-[minmax(28rem,1fr)_var(--width-rail)]");
    // A hard floor on the primary column is the fix for it being squeezed
    // narrower than the rail — this must never silently drop back to an
    // unfloored `minmax(0,1fr)`.
    expect(workspace.className).not.toContain("minmax(0,1fr)_var(--width-rail)");
  });

  test("each pane scrolls independently at rail:, and nothing defeats that wiring", () => {
    const { container } = render(
      <PageHead title="Today" rail={<div>Rail content</div>}>
        <p>Primary content</p>
      </PageHead>,
    );

    const workspace = container.querySelector('[data-testid="page-shell-workspace"]') as HTMLElement;
    const mainPane = workspace.children[0] as HTMLElement;
    const railPane = workspace.children[1] as HTMLElement;

    // Regression test for a real incident: an `items-start` override on the
    // rail: grid replaced its default `stretch` alignment, so each pane's box resolved to
    // its own CONTENT height instead of the grid row's height. A box sized
    // to its content can never overflow, which made `rail:overflow-y-auto`
    // on both panes permanently inert — nothing actually scrolled except
    // the outer workspace (still carrying `shell:overflow-y-auto` at every
    // width, since it wasn't switched off at `rail:`), so scrolling the
    // rail dragged the whole page — including the primary column — up
    // with it, instead of the two panes holding position independently.
    for (const pane of [mainPane, railPane]) {
      expect(pane.className).toContain("rail:min-h-0");
      expect(pane.className).toContain("rail:overflow-y-auto");
    }

    // The grid itself must keep the default `stretch` alignment — no
    // `items-start`/`items-center`/`items-end` override at `rail:`, which
    // would resolve each pane to content height and silently defeat the
    // overflow rules above even though they're still present in the class
    // list.
    expect(workspace.className).not.toMatch(/rail:items-(?:start|center|end)/);

    // The outer workspace's own scroll (used below `rail:`, where the rail
    // stacks under the main column in one shared region) must be switched
    // OFF once the independent per-pane scrolling takes over at `rail:` —
    // otherwise the outer scroller and the two inner ones nest, and the
    // outer one — sized to fit exactly, so inert in practice, but still
    // wired — would be the thing that actually moves, dragging both panes
    // together instead of them holding position on their own.
    expect(workspace.className).toContain("shell:overflow-y-auto");
    expect(workspace.className).toContain("rail:overflow-hidden");
  });

  test("scroll body and rail panes carry a 4px gutter so hairlines and shadows are not clipped", () => {
    const { container, rerender } = render(
      <PageHead title="Inbox">
        <p>Body</p>
      </PageHead>,
    );
    const body = screen.getByText("Body").parentElement?.parentElement as HTMLElement;
    for (const cls of ["shell:-mx-1", "shell:pb-9", "shell:mt-5", "shell:p-1", "pane-scroll"]) {
      expect(body.className).toContain(cls);
    }
    expect(body.className).not.toMatch(/rail:-?(?:m|p)[xytblr]?-/);
    // The frame ends flush with the panel, so the body runs to its bottom edge.
    expect((container.firstElementChild as HTMLElement).className).toContain("shell:pb-0");

    rerender(
      <PageHead title="Today" rail={<div>Rail content</div>}>
        <p>Body</p>
      </PageHead>,
    );
    const workspace = container.querySelector('[data-testid="page-shell-workspace"]') as HTMLElement;
    // Sub-rail the body itself scrolls, so it keeps the gutter; at rail: it
    // must not add a second one (no rail: margin or padding on the body).
    expect(workspace.className).toContain("shell:-m");
    expect(workspace.className).toContain("shell:p-1");
    // The only rail: spacing on the body drops its end-of-page air back to the
    // 4px gutter: the panes carry that air themselves (rail:pb-9).
    expect(workspace.className.match(/rail:-?(?:m|p)[xytblr]?-[^\s]+/g)).toEqual(["rail:pb-1"]);
    for (const pane of [workspace.children[0], workspace.children[1]]) {
      expect(pane.className).toContain("pane-scroll");
      expect(pane.className).toContain("rail:-m-1");
      expect(pane.className).toContain("rail:p-1");
      expect(pane.className).toContain("rail:pb-9");
      expect(pane.className).not.toContain("rail:pr-1");
    }
  });

  test("dim renders inside the h1, so the heading name includes both tones", () => {
    render(
      <PageHead title="Thursday" dim="12 November">
        <p>Body</p>
      </PageHead>,
    );

    const h1 = screen.getByRole("heading", { level: 1, name: "Thursday 12 November" });
    expect(h1).toContainElement(screen.getByText("12 November"));
  });

  test("subtitle renders as a paragraph", () => {
    render(
      <PageHead title="Today" subtitle="Five tasks left.">
        <p>Body</p>
      </PageHead>,
    );

    const sub = screen.getByText("Five tasks left.");
    expect(sub.tagName).toBe("P");
  });

  test("renders no eyebrow label: the heading is the first thing in the header row", () => {
    const { container } = render(
      <PageHead title="Today" actions={<button>Settings</button>}>
        <p>Body</p>
      </PageHead>,
    );

    const header = container.querySelector("header") as HTMLElement;
    const h1 = screen.getByRole("heading", { level: 1, name: "Today" });
    const row = header.firstElementChild as HTMLElement;
    // Title block is the row's first child and the h1 is its first child, so
    // nothing (an eyebrow pill) precedes the heading.
    expect(row.firstElementChild).toBe(h1.parentElement);
    expect(h1.parentElement?.firstElementChild).toBe(h1);
    // Only the title block and the actions wrapper live in the row.
    expect(row.children).toHaveLength(2);
  });

  test("the frame uses shell:h-full, not shell:h-dvh", () => {
    const { container } = render(
      <PageHead title="Today">
        <p>Body</p>
      </PageHead>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).not.toContain("shell:h-dvh");
  });

  test("leading sits first in a centred row beside the title block", () => {
    render(
      <PageHead title="Website" subtitle="Two tasks." leading={<span data-testid="logo">W</span>}>
        <p>Body</p>
      </PageHead>,
    );

    const logo = screen.getByTestId("logo");
    const row = logo.parentElement as HTMLElement;
    expect(row.className).toContain("items-center");
    expect(row.className).toContain("gap-4");
    expect(row.firstElementChild).toBe(logo);
    expect(row.querySelector("h1")).toHaveTextContent("Website");
  });

  test("with a rail, the aside keeps every child at its natural height", () => {
    const { container } = render(
      <PageHead title="Today" rail={<div>Rail content</div>}>
        <p>Body</p>
      </PageHead>,
    );
    const aside = container.querySelector("aside") as HTMLElement;
    expect(aside.className).toContain("[&>*]:shrink-0");
    expect(aside.className).not.toMatch(/rail:items-/);
  });

  test("the frame is left-aligned with no max width", () => {
    const { container } = render(
      <PageHead title="Today">
        <p>Body</p>
      </PageHead>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).not.toContain("mx-auto");
    expect(root.className).not.toMatch(/(?:^|\s)max-w-/);
  });

  test("the head row carries data-part head, bottom-aligned with a 24px gap", () => {
    const { container } = render(
      <PageHead title="Today" actions={<button>Go</button>}>
        <p>Body</p>
      </PageHead>,
    );
    const row = container.querySelector('[data-part="head"]') as HTMLElement;
    expect(row).not.toBeNull();
    expect(row).toHaveClass("flex", "items-end", "gap-6");
    expect(row.parentElement?.tagName).toBe("HEADER");
  });

  test("subtitle is 15px weight 400 with no tracking, 8px under the H1", () => {
    render(
      <PageHead title="Today" subtitle="Five tasks left.">
        <p>Body</p>
      </PageHead>,
    );
    expect(screen.getByText("Five tasks left.")).toHaveClass(
      "mt-2",
      "text-title",
      "font-normal",
      "tracking-normal",
      "text-ink-3",
    );
  });
});
