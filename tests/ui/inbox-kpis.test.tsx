import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import InboxKpis from "@/components/inbox/InboxKpis";
import type { InboxStats } from "@/components/inbox/inbox-data";
import { emptyWorkspace, renderWorkspace } from "./harness";

// The stats maths is tested with inbox-data; here the tiles are checked
// against a controlled InboxStats.
const stats = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/components/inbox/inbox-data", () => ({
  inboxStats: () => stats.current,
}));

const series = Array(12).fill(1);
const base = (o: Partial<InboxStats> = {}): InboxStats => ({
  count: 6,
  addedThisWeek: 4,
  oldestDays: 12,
  oldestSince: "2026-11-01",
  estimatedMinutes: 185,
  noEstimate: 2,
  clearedThisWeek: 9,
  clearedToday: 3,
  addedByDay: series,
  minutesByDay: series,
  clearedByDay: series,
  ...o,
});

function setup(o: Partial<InboxStats> = {}) {
  stats.current = base(o);
  renderWorkspace(<InboxKpis todayISO="2026-11-13" />, emptyWorkspace());
}

describe("InboxKpis", () => {
  beforeEach(() => {
    stats.current = null;
  });

  test("renders the four captions and sparks", () => {
    setup();
    for (const l of ["In inbox", "Oldest", "Estimated", "Cleared"]) {
      expect(screen.getByText(l)).toBeInTheDocument();
    }
    expect(screen.getAllByTestId("kpi-foot")).toHaveLength(4);
    expect(screen.getAllByRole("img")).toHaveLength(4);
  });

  test("values, units and foots", () => {
    setup();
    expect(screen.getByText("tasks")).toBeInTheDocument();
    const feet = screen.getAllByTestId("kpi-foot");
    expect(feet[0]).toHaveTextContent("Added this week");
    expect(feet[0]).toHaveTextContent("4");
    expect(screen.getByText("days")).toBeInTheDocument();
    expect(feet[1]).toHaveTextContent("Since");
    expect(feet[1]).toHaveTextContent("Sun 1 Nov");
    expect(screen.getByText("3h 5m")).toBeInTheDocument();
    expect(feet[2]).toHaveTextContent("No estimate");
    expect(feet[2]).toHaveTextContent("2 tasks");
    expect(screen.getByText("this week")).toBeInTheDocument();
    expect(feet[3]).toHaveTextContent("Done today");
    expect(feet[3]).toHaveTextContent("3");
  });

  test("singular units", () => {
    setup({ count: 1, oldestDays: 1, noEstimate: 1 });
    expect(screen.getByText("task")).toBeInTheDocument();
    expect(screen.getByText("day")).toBeInTheDocument();
    const feet = screen.getAllByTestId("kpi-foot");
    expect(feet[2]).toHaveTextContent("No estimate");
    expect(feet[2]).toHaveTextContent("1 task");
    expect(feet[2]).not.toHaveTextContent("1 tasks");
  });

  test("empty inbox", () => {
    setup({
      count: 0,
      addedThisWeek: 0,
      oldestDays: null,
      oldestSince: null,
      estimatedMinutes: 0,
      noEstimate: 0,
    });
    expect(screen.getByText("Nothing waiting")).toBeInTheDocument();
    expect(screen.getByText("days")).toBeInTheDocument();
    expect(screen.getByText("0m")).toBeInTheDocument();
    expect(screen.queryByText("-")).not.toBeInTheDocument();
  });
});
