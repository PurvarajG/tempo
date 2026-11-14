import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CarriedRow from "@/components/week/CarriedRow";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

const TODAY = "2026-03-10";
const ids = ["a", "b", "c", "d"].map((c) => c.repeat(8) + `-${c.repeat(4)}-4${c.repeat(3)}-8${c.repeat(3)}-${c.repeat(12)}`);
const tasks = ids.map((id, i) => makeTask({ id, title: `Task ${i + 1}`, scheduled: "2026-03-08" }));

const setup = (list = tasks) =>
  renderWorkspace(<CarriedRow tasks={list} todayISO={TODAY} />, emptyWorkspace({ tasks: list }));

describe("CarriedRow", () => {
  it("renders nothing for no tasks", () => {
    const { container } = setup([]);
    expect(container.querySelector("section")).toBeNull();
  });

  it("shows the count and the label", () => {
    setup(tasks.slice(0, 2));
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("2").className).toContain("text-day-num");
    expect(screen.getByText("2").className).not.toContain("text-h1");
    expect(screen.getAllByText("Carried over").length).toBeGreaterThan(0);
  });

  it("is a region named Carried over", () => {
    setup();
    expect(screen.getByRole("region", { name: "Carried over" })).toBeTruthy();
  });

  it("shows 3 tasks and +1 more, then all 4 after a click", () => {
    setup();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "+1 more" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.queryByRole("button", { name: /more/ })).toBeNull();
  });

  it("Move all to today reschedules every id in one request", async () => {
    const { mock } = setup();
    mock.respondWith("/api/tasks/reschedule", tasks);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Move all to today" })));
    await waitFor(() => expect(mock.calls).toHaveLength(1));
    expect(mock.calls[0].body).toEqual({ ids, day: TODAY });
  });

  it("never says Overdue", () => {
    const { container } = setup();
    expect(container.textContent).not.toMatch(/overdue/i);
  });
});
