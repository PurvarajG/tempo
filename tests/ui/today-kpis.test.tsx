import { screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import TodayKpis from "@/components/today/TodayKpis";
import type { Capacity } from "@/lib/today";
import { emptyWorkspace, renderWorkspace } from "./harness";

// Small stand-in until lib/today.ts lands: flat series, Monday-first week.
vi.mock("@/lib/today", async (importOriginal) => ({
  overBy: (await importOriginal<typeof import("@/lib/today")>()).overBy,
  plannedByDay: (_t: unknown, _e: string, days: number) => Array(days).fill(60),
  trackedByDay: (_e: unknown, _d: string, days: number) => Array(days).fill(30),
  weekDays: (today: string) => {
    const [y, m, d] = today.split("-").map(Number);
    const dow = (new Date(y, m - 1, d).getDay() + 6) % 7;
    return Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(y, m - 1, d - dow + i);
      const p = (n: number) => String(n).padStart(2, "0");
      return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
    });
  },
}));

const cap = (o: Partial<Capacity> = {}): Capacity => ({
  endHour: 18,
  endLabel: "18:00",
  minutesLeft: 120,
  plannedMinutes: 90,
  committedMinutes: 90,
  freeMinutes: 130,
  dayDone: false,
  over: false,
  ...o,
});

function setup(c: Capacity, carried = 2) {
  // 2026-11-12 is a Thursday.
  renderWorkspace(
    <TodayKpis todayISO="2026-11-12" cap={c} carriedCount={carried} />,
    emptyWorkspace(),
  );
}

describe("TodayKpis", () => {
  test("renders the four labels and no Overdue", () => {
    setup(cap());
    for (const l of ["Planned", "Tracked", "Free today", "Carried over"]) {
      expect(screen.getByText(l)).toBeInTheDocument();
    }
    expect(screen.queryByText(/overdue/i)).not.toBeInTheDocument();
  });

  test("planned and tracked values and feet", () => {
    setup(cap());
    expect(screen.getByText("1h 30m")).toBeInTheDocument();
    expect(screen.getByText("vs last Thu")).toBeInTheDocument();
    expect(screen.getByText("+30m").parentElement).toHaveClass("text-ok");
    expect(screen.getByText("Week so far")).toBeInTheDocument();
    // Mon..Thu at 30m each
    expect(screen.getByText("2h")).toBeInTheDocument();
  });

  test("Free today shows time and the end label", () => {
    setup(cap());
    expect(screen.getByText("2h 10m")).toBeInTheDocument();
    expect(screen.getByText("18:00")).toBeInTheDocument();
  });

  test("Day's done replaces the free time", () => {
    setup(cap({ dayDone: true }));
    expect(screen.getByText("Day's done")).toBeInTheDocument();
  });

  test("Over by replaces the free time, in hi red", () => {
    setup(cap({ over: true, minutesLeft: 60, plannedMinutes: 90, freeMinutes: 0 }));
    const v = screen.getByText("Over by 30m");
    expect(v).toBeInTheDocument();
    expect(v.closest(".text-hi")).not.toBeNull();
  });

  test("Free time is not hi when not over", () => {
    setup(cap());
    const v = screen.getByText("2h 10m");
    expect(v.closest(".text-hi")).toBeNull();
  });

  test("Carried over shows a count and a Reschedule link", () => {
    setup(cap(), 1);
    const link = screen.getByRole("link", { name: "Reschedule" });
    expect(link).toHaveAttribute("href", "#carried-over");
    const tile = screen.getByText("Carried over").closest("div")!.parentElement!;
    expect(within(tile.parentElement!).getByText("task")).toBeInTheDocument();
  });

  test("sparks only on Planned and Tracked", () => {
    setup(cap());
    expect(screen.getAllByRole("img")).toHaveLength(2);
  });
});
