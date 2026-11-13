import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import DayCapacity, { type DayCapacityProps } from "@/components/week/DayCapacity";

const base: DayCapacityProps = {
  plannedMinutes: 95,
  ceilingMinutes: 360,
  freeMinutes: 265,
  overByMinutes: 0,
  over: false,
  ratio: 0.26,
  provisional: false,
  dayLabel: "Friday",
};

describe("DayCapacity", () => {
  test("normal day shows planned, ceiling and free", () => {
    render(<DayCapacity {...base} />);
    expect(screen.getByText("1h 35m")).toBeInTheDocument();
    expect(screen.getByText(/of 6h/)).toBeInTheDocument();
    expect(screen.getByText("4h 25m free")).toBeInTheDocument();
    const m = screen.getByRole("meter", { name: "Friday capacity" });
    expect(m).toHaveAttribute("aria-valuenow", "26");
    expect(m).toHaveAttribute("aria-valuetext", "1h 35m of 6h");
  });

  test("normal day keeps the accent bar and no hi text", () => {
    const { container } = render(<DayCapacity {...base} />);
    expect(screen.getByRole("meter")).toHaveAttribute("data-tone", "accent");
    expect(container.querySelector(".text-hi")).toBeNull();
    expect(container.firstElementChild).toHaveAttribute("data-over", "false");
  });

  test("over capacity is a full hi bar with hi 'Over by' text", () => {
    const { container } = render(
      <DayCapacity
        {...base}
        plannedMinutes={440}
        freeMinutes={0}
        overByMinutes={80}
        over
        ratio={1.22}
        dayLabel="Tuesday"
      />,
    );
    const overText = screen.getByText("Over by 1h 20m");
    expect(overText).toBeInTheDocument();
    expect(overText).toHaveClass("text-hi");
    expect(overText).not.toHaveClass("font-medium");
    const m = screen.getByRole("meter");
    expect(m).toHaveAttribute("data-tone", "hi");
    expect(m).toHaveAttribute("aria-valuenow", "100");
    expect(container.firstElementChild).toHaveAttribute("data-over", "true");
  });

  test("provisional shows planned only", () => {
    render(<DayCapacity {...base} provisional />);
    expect(screen.getByText(/planned/)).toBeInTheDocument();
    expect(screen.queryByText(/of 6h/)).toBeNull();
    expect(screen.queryByText(/free/)).toBeNull();
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "0");
  });
});
