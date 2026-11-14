import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import WeekBoard from "@/components/week/WeekBoard";
import { fmtWeekday } from "@/lib/format";
import { addDays } from "@/lib/parse";
import type { WeekRow } from "@/lib/week-capacity";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

const today = "2026-11-13";

function row(i: number, over: Partial<WeekRow> = {}): WeekRow {
  return {
    date: addDays(today, i),
    isToday: i === 0,
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

const rows = (overrides: Record<number, Partial<WeekRow>> = {}) =>
  Array.from({ length: 7 }, (_, i) => row(i, overrides[i]));

describe("WeekBoard", () => {
  it("draws one lane per day, and Carried over first when present", () => {
    const carried = [makeTask({ id: "c1", title: "Left behind", scheduled: addDays(today, -1) })];
    const t = makeTask({ id: "t1", title: "Tomorrow thing", scheduled: addDays(today, 1) });
    renderWorkspace(
      <WeekBoard
        rows={rows({ 1: { tasks: [t], plannedMinutes: 30 } })}
        carried={carried}
        planIts={[]}
        todayISO={today}
        onPlanIt={() => {}}
      />,
      emptyWorkspace(),
    );
    const lanes = document.querySelectorAll("section");
    expect(lanes).toHaveLength(8);
    expect(lanes[0].getAttribute("aria-label")).toBe("Carried over, 1 task");
    expect(lanes[1].getAttribute("aria-label")).toBe("Today, 0 tasks");
    expect(lanes[2].getAttribute("aria-label")).toBe("Sat 14, 1 task");
    expect(within(lanes[2]).getByText("Tomorrow thing")).toBeTruthy();
  });

  it("omits Carried over when nothing is carried and puts a capacity footer in every lane", () => {
    renderWorkspace(
      <WeekBoard rows={rows()} carried={[]} planIts={[]} todayISO={today} onPlanIt={() => {}} />,
      emptyWorkspace(),
    );
    expect(screen.queryByText("Carried over")).toBeNull();
    expect(document.querySelectorAll("section")).toHaveLength(7);
    expect(document.querySelectorAll("[data-over]")).toHaveLength(7);
  });

  it("marks an over day's footer", () => {
    renderWorkspace(
      <WeekBoard
        rows={rows({ 2: { over: true, overByMinutes: 60, plannedMinutes: 420, ratio: 1 } })}
        carried={[]}
        planIts={[]}
        todayISO={today}
        onPlanIt={() => {}}
      />,
      emptyWorkspace(),
    );
    expect(document.querySelectorAll('[data-over="true"]')).toHaveLength(1);
    expect(screen.getByText("Over by 1h")).toBeTruthy();
  });

  it("an empty day offers Plan it and calls onPlanIt", async () => {
    const pick = makeTask({ id: "p1", title: "Floating errand", scheduled: null });
    const onPlanIt = vi.fn();
    const planIts = [null, pick, null, null, null, null, null];
    renderWorkspace(
      <WeekBoard rows={rows()} carried={[]} planIts={planIts} todayISO={today} onPlanIt={onPlanIt} />,
      emptyWorkspace(),
    );
    expect(screen.getAllByText("Nothing planned yet.")).toHaveLength(7);
    const date = addDays(today, 1);
    await userEvent.click(screen.getByRole("button", { name: `Plan it for ${fmtWeekday(date)}` }));
    expect(onPlanIt).toHaveBeenCalledWith(pick, date);
  });

  it("every day lane has a plus button, and Carried over has none", () => {
    const carried = [makeTask({ id: "c1", title: "Left behind", scheduled: addDays(today, -1) })];
    renderWorkspace(
      <WeekBoard rows={rows()} carried={carried} planIts={[]} todayISO={today} onPlanIt={() => {}} />,
      emptyWorkspace(),
    );
    expect(screen.getByRole("button", { name: "Add task to Today" })).toBeTruthy();
    const d = addDays(today, 1);
    const label = `Add task to ${fmtWeekday(d, "short")} ${Number(d.split("-")[2])}`;
    expect(screen.getByRole("button", { name: label })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Add task to / })).toHaveLength(7);
    expect(screen.queryByRole("button", { name: "Add task to Carried over" })).toBeNull();
  });

  it("the plus on a later day adds a task scheduled that day", async () => {
    const date = addDays(today, 2);
    const label = `${fmtWeekday(date, "short")} ${Number(date.split("-")[2])}`;
    const { mock } = renderWorkspace(
      <WeekBoard rows={rows()} carried={[]} planIts={[]} todayISO={today} onPlanIt={() => {}} />,
      emptyWorkspace(),
    );
    await userEvent.click(screen.getByRole("button", { name: `Add task to ${label}` }));
    await userEvent.type(screen.getByLabelText(`New task for ${label}`), "Ship it{Enter}");
    await waitFor(() => {
      const post = mock.calls.find((c) => c.method === "POST" && c.url.includes("/api/tasks"));
      expect(post).toBeTruthy();
      expect(JSON.stringify(post)).toContain(`"scheduled":"${date}"`);
    });
  });
});
