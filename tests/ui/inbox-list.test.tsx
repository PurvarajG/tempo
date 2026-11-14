import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import InboxList from "@/components/inbox/InboxList";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

const TODAY = "2026-03-10";
const id = (n: number) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, "0")}`;
const old = (n: number, minutes: number) =>
  makeTask({ id: id(n), title: `Old ${n}`, scheduled: null, minutes, createdAt: "2026-02-20T09:00:00.000Z" });
const fresh = (n: number, minutes: number) =>
  makeTask({ id: id(n), title: `New ${n}`, scheduled: null, minutes, createdAt: "2026-03-09T09:00:00.000Z" });

const setup = (tasks: ReturnType<typeof makeTask>[], ready = true) =>
  renderWorkspace(<InboxList tasks={tasks} todayISO={TODAY} ready={ready} />, emptyWorkspace({ tasks }));

describe("InboxList", () => {
  it("renders both groups in order with counts and totals", () => {
    const { container } = setup([old(1, 30), old(2, 40), fresh(3, 15), fresh(4, 20), fresh(5, 10)]);
    const older = container.querySelector('[data-group="older"]')!;
    const olderHead = older.firstElementChild as HTMLElement;
    expect(within(olderHead).getByText("Older than a week, 2")).toBeTruthy();
    expect(within(olderHead).getByText("1h 10m")).toBeTruthy();
    const week = container.querySelector('[data-group="week"]')!;
    const weekHead = week.firstElementChild as HTMLElement;
    expect(within(weekHead).getByText("This week, 3")).toBeTruthy();
    expect(within(weekHead).getByText("45m")).toBeTruthy();
    const groups = [...container.querySelectorAll("[data-group]")].map((g) => g.getAttribute("data-group"));
    expect(groups).toEqual(["older", "week"]);
    expect(screen.getByText("Old 1")).toBeTruthy();
    expect(screen.getByText("New 3")).toBeTruthy();
  });

  it("renders one group when the other is empty", () => {
    setup([fresh(1, 15)]);
    expect(screen.getByText("This week, 1")).toBeTruthy();
    expect(screen.queryByText(/Older than a week/)).toBeNull();
  });

  it("header has the inbox card title, count and right text", () => {
    setup([old(1, 30), fresh(2, 15)]);
    const card = screen.getByRole("region", { name: "Inbox" });
    expect(within(card).getByText("2")).toBeTruthy();
    expect(within(card).getByText("Pick a day for each, or move it to trash")).toBeTruthy();
  });

  it("shows a quiet line when empty", () => {
    setup([]);
    expect(screen.getByText("Nothing waiting for a day.")).toBeTruthy();
  });

  it("shows the header only when not ready", () => {
    setup([], false);
    expect(screen.queryByText("Nothing waiting for a day.")).toBeNull();
    expect(screen.getByRole("heading", { name: "Inbox" })).toBeTruthy();
  });
});
