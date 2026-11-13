import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import Card, { CardHeader } from "@/components/ui/Card";

describe("Card", () => {
  test("renders a section by default", () => {
    const { container } = render(<Card>body</Card>);
    expect(container.firstElementChild?.tagName).toBe("SECTION");
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  test("the as prop changes the element", () => {
    const { container } = render(<Card as="article">body</Card>);
    expect(container.firstElementChild?.tagName).toBe("ARTICLE");
  });

  test("clip adds overflow-hidden only when set", () => {
    const { container, rerender } = render(<Card>x</Card>);
    expect(container.firstElementChild).not.toHaveClass("overflow-hidden");
    rerender(<Card clip>x</Card>);
    expect(container.firstElementChild).toHaveClass("overflow-hidden");
  });

  test("aria-labelledby points at the header title id", () => {
    render(
      <Card aria-labelledby="t1">
        <CardHeader title="Today" titleId="t1" />
      </Card>,
    );
    expect(screen.getByRole("region", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Today" })).toHaveAttribute("id", "t1");
  });
});

describe("CardHeader", () => {
  test("renders the title as an h2 by default and h3 on request", () => {
    const { rerender } = render(<CardHeader title="Plan" />);
    expect(screen.getByRole("heading", { level: 2, name: "Plan" })).toBeInTheDocument();
    rerender(<CardHeader title="Plan" titleAs="h3" />);
    expect(screen.getByRole("heading", { level: 3, name: "Plan" })).toBeInTheDocument();
  });

  test("renders count, right and action slots", () => {
    render(
      <CardHeader
        title="Plan"
        count={4}
        right="2h 30m"
        action={<button type="button">Add</button>}
      />,
    );
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("2h 30m")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });

  test("icon renders inside a hidden tile and is not announced", () => {
    render(<CardHeader title="Plan" icon={<svg data-testid="ic" />} />);
    const icon = screen.getByTestId("ic");
    expect(icon.parentElement).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("heading", { name: "Plan" })).toBeInTheDocument();
  });
});

describe("style-check hooks and mockup classes", () => {
  test("Card root carries data-part card and the ring plus shadow classes", () => {
    const { container } = render(<Card>x</Card>);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("data-part", "card");
    for (const c of ["rounded-card", "bg-surface", "ring-1", "ring-line", "shadow-sm"]) {
      expect(root).toHaveClass(c);
    }
  });

  test("CardHeader root carries data-part card-h, with an outlined 28px tile and plain count", () => {
    const { container } = render(
      <CardHeader title="Plan" icon={<svg data-testid="ic" />} count={3} />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("data-part", "card-h");
    for (const c of ["flex", "items-center", "gap-2", "px-4", "pt-4", "pb-2"]) {
      expect(root).toHaveClass(c);
    }
    const tile = screen.getByTestId("ic").parentElement as HTMLElement;
    for (const c of ["size-7", "rounded-tile", "ring-1", "ring-line", "text-ink-2"]) {
      expect(tile).toHaveClass(c);
    }
    const count = screen.getByText("3");
    expect(count).toHaveClass("text-body", "text-ink-3");
    expect(count).not.toHaveClass("ring-1");
    expect(screen.getByRole("heading", { name: "Plan" })).toHaveClass("text-title", "font-medium");
  });
});
