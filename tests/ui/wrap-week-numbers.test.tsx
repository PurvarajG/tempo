import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import WeekNumbers from "@/components/wrap/WeekNumbers";

const base = { done: 12, focusedMinutes: 2190, accuracy: 84 };

describe("WeekNumbers", () => {
  test("three tiles with captions", () => {
    render(<WeekNumbers numbers={base} />);
    for (const l of ["Done", "Focused", "Estimates"]) {
      expect(screen.getByText(l)).toBeInTheDocument();
    }
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("region", { name: "This week" })).toBeInTheDocument();
  });

  test("values", () => {
    render(<WeekNumbers numbers={base} />);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("tasks")).toBeInTheDocument();
    expect(screen.getByText("36h 30m")).toBeInTheDocument();
    expect(screen.getByText("84%")).toBeInTheDocument();
    expect(screen.getByText("On target")).toBeInTheDocument();
    expect(screen.getAllByText("Last 7 days")).toHaveLength(2);
  });

  test("singular task", () => {
    render(<WeekNumbers numbers={{ ...base, done: 1 }} />);
    expect(screen.getByText("task")).toBeInTheDocument();
  });

  test("None when accuracy is null", () => {
    render(<WeekNumbers numbers={{ ...base, accuracy: null }} />);
    expect(screen.getByText("None")).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  test("no sparks", () => {
    render(<WeekNumbers numbers={base} />);
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });

  test("three tiles: 1 column, 3 across from shell, never 2 plus 1", () => {
    render(<WeekNumbers numbers={base} />);
    const grid = screen.getByRole("list");
    expect(grid).toHaveClass("grid-cols-1", "shell:grid-cols-3", "gap-4");
    expect(grid).not.toHaveClass("grid-cols-2");
  });
});
