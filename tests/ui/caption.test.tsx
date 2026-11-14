import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import Caption from "@/components/ui/Caption";

describe("Caption", () => {
  test("renders children", () => {
    render(<Caption>Today</Caption>);
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  test("defaults to a span", () => {
    render(<Caption>Today</Caption>);
    expect(screen.getByText("Today").tagName).toBe("SPAN");
  });

  test("as h2 renders a heading", () => {
    render(<Caption as="h2">Backlog</Caption>);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Backlog");
  });

  test("renders a label with htmlFor", () => {
    render(<Caption as="label" htmlFor="x">Name</Caption>);
    expect(screen.getByText("Name")).toHaveAttribute("for", "x");
  });

  test("has the caption classes", () => {
    render(<Caption>Today</Caption>);
    const el = screen.getByText("Today");
    for (const c of ["font-mono", "uppercase", "text-caption", "tracking-caption", "text-ink-3"]) {
      expect(el).toHaveClass(c);
    }
  });

  test("merges className", () => {
    render(<Caption className="mt-2">Today</Caption>);
    const el = screen.getByText("Today");
    expect(el).toHaveClass("mt-2");
    expect(el).toHaveClass("font-mono");
  });
});
