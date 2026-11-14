import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import Panel from "@/components/ui/Panel";

describe("Panel", () => {
  test("renders title and content when not collapsed", () => {
    render(
      <Panel title="Signals">
        <p>Signal list</p>
      </Panel>,
    );

    expect(screen.getByText("Signals")).toBeInTheDocument();
    expect(screen.getByText("Signal list")).toBeInTheDocument();
  });

  test("uncontrolled collapse toggles locally", () => {
    render(
      <Panel title="Signals">
        <p>Signal list</p>
      </Panel>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Collapse Signals" }));
    expect(screen.queryByText("Signal list")).not.toBeInTheDocument();
  });

  test("controlled collapse calls onToggleCollapse and respects the collapsed prop", () => {
    const onToggleCollapse = vi.fn();
    render(
      <Panel title="Signals" collapsed={false} onToggleCollapse={onToggleCollapse}>
        <p>Signal list</p>
      </Panel>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Collapse Signals" }));
    expect(onToggleCollapse).toHaveBeenCalledOnce();
    // Controlled: content still shown because the `collapsed` prop hasn't changed.
    expect(screen.getByText("Signal list")).toBeInTheDocument();
  });

  test("empty renders the quiet one-line row instead of the card", () => {
    render(
      <Panel title="Due today" empty emptyText="Nothing scheduled.">
        <p>Should not render</p>
      </Panel>,
    );

    expect(screen.getByText("Due today")).toBeInTheDocument();
    expect(screen.getByText("Nothing scheduled.")).toBeInTheDocument();
    expect(screen.queryByText("Should not render")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  test("collapsed state shows Expand label, hides the body and aria-expanded is false", () => {
    render(
      <Panel title="Signals" defaultCollapsed>
        <p>Signal list</p>
      </Panel>,
    );

    const toggle = screen.getByRole("button", { name: "Expand Signals" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Signal list")).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Collapse Signals" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Signal list")).toBeInTheDocument();
  });

  test("renders the action slot beside the toggle", () => {
    render(
      <Panel title="Signals" action={<button type="button">Add</button>}>
        <p>Signal list</p>
      </Panel>,
    );

    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse Signals" })).toBeInTheDocument();
  });

  test("the card is labelled by its title", () => {
    render(
      <Panel title="Signals" collapsible={false}>
        <p>Signal list</p>
      </Panel>,
    );

    expect(screen.getByRole("region", { name: "Signals" })).toBeInTheDocument();
  });

  test("collapsible=false hides the toggle button", () => {
    render(
      <Panel title="Signals" collapsible={false}>
        <p>Signal list</p>
      </Panel>,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
