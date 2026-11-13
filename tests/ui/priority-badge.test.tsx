import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import PriorityBadge from "@/components/ui/PriorityBadge";

describe("PriorityBadge", () => {
  test("1 renders High with the hi tone", () => {
    render(<PriorityBadge priority={1} />);
    const el = screen.getByText("High");
    expect(el).toHaveClass("text-hi", "bg-hi-bg");
  });

  test("2 renders Medium with the med tone", () => {
    render(<PriorityBadge priority={2} />);
    expect(screen.getByText("Medium")).toHaveClass("text-med", "bg-med-bg");
  });

  test("3 renders Low plain: meta colour, no ring, no fill, no pill", () => {
    render(<PriorityBadge priority={3} />);
    const el = screen.getByText("Low");
    expect(el).toHaveClass("text-ink-3");
    expect(el.className).not.toMatch(/bg-|inset-ring|rounded-full|font-medium/);
  });

  test("0 renders nothing", () => {
    const { container } = render(<PriorityBadge priority={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("compact drops the word but keeps an accessible name", () => {
    render(<PriorityBadge priority={1} compact />);
    expect(screen.queryByText("High")).not.toBeInTheDocument();
    const el = screen.getByLabelText("High");
    expect(el).toHaveAttribute("title", "High");
  });

  test("the flag svg is aria-hidden", () => {
    const { container } = render(<PriorityBadge priority={2} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  test("root carries data-part prio on every visible priority", () => {
    const { container, rerender } = render(<PriorityBadge priority={1} />);
    expect(container.querySelector("[data-part='prio']")).not.toBeNull();
    rerender(<PriorityBadge priority={3} />);
    expect(container.querySelector("[data-part='prio']")).not.toBeNull();
  });

  test("High is a tinted pill with a filled flag", () => {
    const { container } = render(<PriorityBadge priority={1} />);
    expect(screen.getByText("High")).toHaveClass("inline-flex", "gap-1", "text-meta", "rounded-full", "font-medium", "px-2", "py-0.5");
    expect(container.querySelector("svg")).toHaveClass("fill-current");
  });
});
