import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import Pill from "@/components/ui/Pill";

describe("Pill", () => {
  test("renders children", () => {
    render(<Pill>Design</Pill>);
    expect(screen.getByText("Design")).toBeInTheDocument();
  });

  test("default tone has an inset line-2 ring", () => {
    render(<Pill>Design</Pill>);
    expect(screen.getByText("Design").className).toContain("inset-ring-line-2");
  });

  test("accent tone uses accent text on accent-soft", () => {
    render(<Pill tone="accent">Next</Pill>);
    const cls = screen.getByText("Next").className;
    expect(cls).toContain("text-accent");
    expect(cls).toContain("bg-accent-soft");
  });

  test("leading slot renders before the text", () => {
    render(<Pill leading={<i data-testid="lead" />}>Label</Pill>);
    const pill = screen.getByText("Label");
    expect(pill.firstElementChild).toBe(screen.getByTestId("lead"));
    expect(pill.textContent).toBe("Label");
  });

  test("title passes through", () => {
    render(<Pill title="Project">Label</Pill>);
    expect(screen.getByText("Label")).toHaveAttribute("title", "Project");
  });

  test("root carries data-part pill and the outlined pill classes", () => {
    render(<Pill>Design</Pill>);
    const el = screen.getByText("Design");
    expect(el).toHaveAttribute("data-part", "pill");
    expect(el).toHaveClass("text-meta", "rounded-full", "px-2", "py-0.5", "text-ink-2", "inset-ring", "inset-ring-line-2");
    expect(el.className).not.toMatch(/(^|\s)bg-/);
  });
});
