import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import EmptyState from "@/components/ui/EmptyState";

describe("EmptyState", () => {
  test("block renders title, description, icon and action", () => {
    render(
      <EmptyState
        title="Nothing here"
        description="Add a task to begin."
        icon={<svg data-testid="icon" />}
        action={<button type="button">Add task</button>}
      />,
    );

    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByText("Add a task to begin.")).toBeInTheDocument();
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add task" })).toBeInTheDocument();
  });

  test("inline renders title and action in one row", () => {
    const { container } = render(
      <EmptyState layout="inline" title="Nothing planned" action={<button type="button">Plan</button>} />,
    );
    const root = container.firstElementChild as HTMLElement;

    expect(root.className).toContain("flex");
    expect(root.className).toContain("items-center");
    expect(root).toContainElement(screen.getByText("Nothing planned"));
    expect(root).toContainElement(screen.getByRole("button", { name: "Plan" }));
  });

  test("no description renders no empty paragraph", () => {
    const { container } = render(<EmptyState title="Empty" />);

    expect(container.querySelectorAll("p")).toHaveLength(1);
  });

  test("live adds role status, default does not", () => {
    const { rerender } = render(<EmptyState title="Empty" />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    rerender(<EmptyState title="Empty" live />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
