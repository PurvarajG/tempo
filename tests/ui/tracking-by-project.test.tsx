import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import ByProjectCard from "@/components/tracking/ByProjectCard";
import type { Project } from "@/lib/types";

const proj = (id: string, name: string): Project => ({
  id,
  name,
  color: "#123456",
  archived: false,
  sortOrder: 0,
  createdAt: "2026-01-01",
});

const rows = [
  { project: proj("a", "MSM26"), minutes: 460 },
  { project: proj("b", "Campus 2027"), minutes: 130 },
  { project: null, minutes: 230 },
];

describe("ByProjectCard", () => {
  test("heading, right label, rows in given order with fmt values", () => {
    render(<ByProjectCard rows={rows} rightLabel="Last 28 days" insight={null} />);
    expect(screen.getByRole("heading", { name: "By project" })).toBeInTheDocument();
    expect(screen.getByText("Last 28 days")).toBeInTheDocument();
    const items = screen.getAllByTestId("by-project-row");
    expect(items.map((r) => r.textContent)).toEqual(["MSM26" + "7h 40m", "Campus 2027" + "2h 10m", "No project" + "3h 50m"]);
  });

  test("bar width is proportional to the largest", () => {
    render(<ByProjectCard rows={rows} rightLabel="x" insight={null} />);
    const bars = screen.getAllByTestId("by-project-bar");
    expect(bars[0].style.width).toBe("100%");
    expect(parseFloat(bars[1].style.width)).toBeCloseTo((130 / 460) * 100, 3);
  });

  test("No project row is present", () => {
    render(<ByProjectCard rows={rows} rightLabel="x" insight={null} />);
    expect(screen.getByText("No project")).toBeInTheDocument();
  });

  test("insight sentence is exact, absent when null", () => {
    const { rerender } = render(
      <ByProjectCard rows={rows} rightLabel="x" insight={{ projectName: "Campus 2027", tracked: 130, planned: 300 }} />,
    );
    expect(screen.getByText("Campus 2027 got 2h 10m of the 5h you planned for it this week.")).toBeInTheDocument();
    rerender(<ByProjectCard rows={rows} rightLabel="x" insight={null} />);
    expect(screen.queryByText(/you planned for it/)).toBeNull();
  });

  test("values over 24h read in hours, never days", () => {
    render(<ByProjectCard rows={[{ project: proj("a", "Big"), minutes: 2915 }]} rightLabel="x" insight={null} />);
    expect(screen.getByTestId("by-project-row").textContent).toBe("Big" + "48h 35m");
  });

  test("empty text", () => {
    render(<ByProjectCard rows={[]} rightLabel="x" insight={null} />);
    expect(screen.getByText("No time on projects yet.")).toBeInTheDocument();
  });

  test("shows five rows and 'And N more'", () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ project: proj(`p${i}`, `P${i}`), minutes: 100 - i }));
    render(<ByProjectCard rows={many} rightLabel="x" insight={null} />);
    expect(screen.getAllByTestId("by-project-row")).toHaveLength(5);
    expect(screen.getByText("And 2 more")).toBeInTheDocument();
    expect(within(screen.getAllByTestId("by-project-row")[0]).getByText("P0")).toBeInTheDocument();
  });
});
