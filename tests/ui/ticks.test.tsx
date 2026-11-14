import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import Ticks from "@/components/ui/Ticks";

describe("Ticks", () => {
  test("renders a meter with an accessible name", () => {
    render(<Ticks value={0.4} label="Week capacity" />);
    expect(screen.getByRole("meter", { name: "Week capacity" })).toBeInTheDocument();
  });

  test("reports the percentage for 0.4", () => {
    render(<Ticks value={0.4} label="m" />);
    const m = screen.getByRole("meter");
    expect(m).toHaveAttribute("aria-valuenow", "40");
    expect(m).toHaveAttribute("aria-valuemin", "0");
    expect(m).toHaveAttribute("aria-valuemax", "100");
  });

  test("clamps negative to 0 and above 1 to 100", () => {
    const { rerender } = render(<Ticks value={-0.5} label="m" />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "0");
    rerender(<Ticks value={1.7} label="m" />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "100");
  });

  test("value above 1 switches to the hi tone unless tone is given", () => {
    const { rerender } = render(<Ticks value={0.5} label="m" />);
    expect(screen.getByRole("meter")).toHaveAttribute("data-tone", "accent");
    rerender(<Ticks value={1.2} label="m" />);
    expect(screen.getByRole("meter")).toHaveAttribute("data-tone", "hi");
    rerender(<Ticks value={1.2} label="m" tone="accent" />);
    expect(screen.getByRole("meter")).toHaveAttribute("data-tone", "accent");
  });

  test("sm size changes the height class", () => {
    const { rerender } = render(<Ticks value={0.5} label="m" />);
    expect(screen.getByRole("meter")).toHaveClass("h-6");
    rerender(<Ticks value={0.5} label="m" size="sm" />);
    expect(screen.getByRole("meter")).toHaveClass("h-5");
  });

  test("valueText reaches aria-valuetext", () => {
    render(<Ticks value={0.9} label="m" valueText="5h 30m of 6h" />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext", "5h 30m of 6h");
  });
});
