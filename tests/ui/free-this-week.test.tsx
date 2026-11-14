import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import FreeThisWeek from "@/components/inbox/FreeThisWeek";
import type { FreeSlot } from "@/components/inbox/inbox-data";
import { makeTask, renderWorkspace } from "./harness";

const state: { slots: FreeSlot[]; totalMinutes: number; provisional: boolean } = {
  slots: [],
  totalMinutes: 0,
  provisional: false,
};

vi.mock("@/components/inbox/inbox-data", async (orig) => ({
  ...(await orig<typeof import("@/components/inbox/inbox-data")>()),
  freeThisWeek: () => state,
}));

const caterers = makeTask({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", title: "Shortlist caterers", minutes: 60 });

beforeEach(() => {
  state.slots = [];
  state.totalMinutes = 0;
  state.provisional = false;
});

describe("FreeThisWeek", () => {
  test("rows show weekday, time range, fit, duration and the header total", () => {
    state.slots = [
      { date: "2026-11-12", start: "16:15", end: "18:00", minutes: 105, fits: caterers },
      { date: "2026-11-13", start: "11:00", end: "15:00", minutes: 240, fits: null },
    ];
    state.totalMinutes = 345;
    const { container } = renderWorkspace(<FreeThisWeek todayISO="2026-11-12" inbox={[caterers]} />);
    expect(screen.getByText("Free this week")).toBeInTheDocument();
    expect(screen.getByText("5h 45m")).toBeInTheDocument();
    expect(screen.getByText("Thu")).toHaveClass("font-mono");
    expect(screen.getByText("Fri")).toHaveClass("font-mono");
    expect(screen.getByText("16:15 to 18:00, fits Shortlist caterers")).toBeInTheDocument();
    expect(screen.getByText("11:00 to 15:00")).toBeInTheDocument();
    expect(screen.getByText("1h 45m")).toHaveClass("font-mono");
    expect(screen.getByText("4h")).toHaveClass("font-mono");
    expect(screen.queryByText(/Free,/)).toBeNull();
    expect(container.textContent).not.toMatch(/Free(?! this week)/);
  });

  test("provisional shows one quiet line", () => {
    state.provisional = true;
    renderWorkspace(<FreeThisWeek todayISO="2026-11-12" inbox={[]} />);
    expect(screen.getByText("Free this week")).toBeInTheDocument();
    expect(screen.getByText("Working out your week.")).toBeInTheDocument();
  });

  test("no slots shows the empty line", () => {
    renderWorkspace(<FreeThisWeek todayISO="2026-11-12" inbox={[]} />);
    expect(screen.getByText("Free this week")).toBeInTheDocument();
    expect(screen.getByText("No free time left this week.")).toBeInTheDocument();
  });
});
