import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TrackedWeek from "@/components/today/TrackedWeek";
import { emptyWorkspace, renderWorkspace } from "./harness";

// lib/today.ts lands in parallel; small stand-ins until it does.
vi.mock("@/lib/today", () => ({
  weekDays: () => [
    "2026-11-09",
    "2026-11-10",
    "2026-11-11",
    "2026-11-12",
    "2026-11-13",
    "2026-11-14",
    "2026-11-15",
  ],
  trackedByDay: () => [60, 120, 0, 105, 0, 0, 0],
  plannedByDay: () => [260],
}));

describe("TrackedWeek", () => {
  it("shows the week total and seven named columns", async () => {
    renderWorkspace(<TrackedWeek todayISO="2026-11-12" />, emptyWorkspace());
    expect(await screen.findByRole("heading", { name: "Tracked this week" })).toBeTruthy();
    expect(screen.getByText("4h 45m")).toBeTruthy();
    expect(screen.getAllByRole("img")).toHaveLength(7);
    expect(screen.getByRole("img", { name: "Mon 9 Nov, 1h tracked" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Sun 15 Nov, 0m tracked" })).toBeTruthy();
  });

  it("marks only today's column", async () => {
    renderWorkspace(<TrackedWeek todayISO="2026-11-12" />, emptyWorkspace());
    const today = await screen.findByRole("img", { name: "Thu 12 Nov, 1h 45m tracked" });
    expect(today.getAttribute("data-today")).toBe("true");
    expect(today.getAttribute("aria-current")).toBe("date");
    expect(document.querySelectorAll("[data-today]")).toHaveLength(1);
    expect(today.querySelectorAll(".bg-accent")).toHaveLength(4);
  });

  it("summarises today with readable dates only", async () => {
    const { container } = renderWorkspace(<TrackedWeek todayISO="2026-11-12" />, emptyWorkspace());
    await screen.findByText("Planned");
    expect(screen.getByText("Thu 12 Nov")).toBeTruthy();
    expect(screen.getByText("4h 20m")).toBeTruthy();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/[A-Z]{3} \d+ [A-Z]{3}/);
    expect(text).not.toMatch(/\d{1,4}[/-]\d{1,2}[/-]\d{1,4}/);
  });
});
