import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DayRow from "@/components/week/DayRow";
import type { WeekRow } from "@/lib/week-capacity";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

const mk = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    makeTask({ id: `00000000-0000-4000-8000-00000000000${i + 1}`, title: `Task ${i + 1}`, minutes: 30 }),
  );

function row(over: Partial<WeekRow> = {}): WeekRow {
  return {
    date: "2026-11-18",
    isToday: false,
    tasks: [],
    plannedMinutes: 0,
    ceilingMinutes: 360,
    freeMinutes: 360,
    overByMinutes: 0,
    over: false,
    ratio: 0,
    provisional: false,
    ...over,
  };
}

function setup(r: WeekRow, planIt?: ReturnType<typeof makeTask> | null, onPlanIt = vi.fn()) {
  renderWorkspace(<DayRow row={r} planIt={planIt} onPlanIt={onPlanIt} />, emptyWorkspace({ tasks: r.tasks }));
  return onPlanIt;
}

describe("DayRow", () => {
  it("shows numeral and short weekday, or Today", async () => {
    setup(row({ tasks: mk(1) }));
    expect(await screen.findByText("18")).toBeTruthy();
    expect(screen.getByText("18").className).toContain("text-day-num");
    expect(screen.getByText("18").className).not.toContain("text-h1");
    expect(screen.getByText("Wed")).toBeTruthy();
  });

  it("shows Today caption", async () => {
    setup(row({ isToday: true, tasks: mk(1) }));
    expect(await screen.findByText("Today")).toBeTruthy();
  });

  it("shows 3 lines plus +1 more, then 4 after click", async () => {
    setup(row({ tasks: mk(4) }));
    await screen.findByText("Task 1");
    expect(screen.getAllByRole("listitem").filter((li) => li.querySelector("input,[role=checkbox]")).length).toBe(3);
    expect(screen.queryByText("Task 4")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "+1 more" }));
    expect(screen.getByText("Task 4")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /more/ })).toBeNull();
  });

  it("empty day without suggestion has no chip", async () => {
    setup(row(), null);
    expect(await screen.findByText("Nothing planned yet.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Plan it/ })).toBeNull();
  });

  it("empty day with suggestion offers the chip", async () => {
    const t = makeTask({ title: "Briefing pack", minutes: 180 });
    const onPlanIt = setup(row(), t);
    expect(await screen.findByText(/fits here/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Plan it for Wednesday" }));
    expect(onPlanIt).toHaveBeenCalledWith(t);
  });

  it("over row is marked and says Over by", async () => {
    setup(row({ tasks: mk(1), over: true, overByMinutes: 80, plannedMinutes: 440, freeMinutes: 0, ratio: 1 }));
    expect(await screen.findByText(/Over by 1h 20m/)).toBeTruthy();
    expect(document.querySelector('[data-over="true"]')).not.toBeNull();
  });
});
