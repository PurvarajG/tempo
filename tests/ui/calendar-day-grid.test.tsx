import { describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DayGrid from "@/components/calendar/DayGrid";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

const DATE = "2026-03-10";
const day = { iso: DATE, dayOfMonth: 10, inMonth: true, isWeekend: false };

vi.mock("@/lib/useNow", () => ({
  useNow: () => new Date(2026, 2, 10, 12, 0, 0),
}));

function grid(tasks: ReturnType<typeof makeTask>[], extra: Record<string, unknown> = {}, onSelectDay = vi.fn()) {
  const byDate = new Map([[DATE, tasks]]);
  return {
    onSelectDay,
    ...renderWorkspace(
      <DayGrid day={day} todayISO={DATE} tasksByDate={byDate} onSelectDay={onSelectDay} {...extra} />,
      emptyWorkspace({ tasks, ...((extra.ws as object) ?? {}) }),
    ),
  };
}

describe("DayGrid", () => {
  test("a timed task is a solid block button and is not draggable", async () => {
    grid([makeTask({ scheduled: DATE, title: "Ship it", dueTime: "09:00", minutes: 60 })]);
    const block = await screen.findByRole("button", { name: "Ship it" });
    expect(block).toHaveClass("cal-ev");
    expect(block).not.toHaveClass("is-tracked");
    expect(block).not.toHaveAttribute("draggable");
    expect(block).toHaveTextContent("09:00 to 10:00");
  });

  test("a time entry renders a tracked block", async () => {
    const task = makeTask({ scheduled: DATE, title: "Deep work" });
    const entry = {
      id: "e1",
      taskId: task.id,
      startedAt: new Date(2026, 2, 10, 14, 0).toISOString(),
      endedAt: new Date(2026, 2, 10, 15, 0).toISOString(),
    };
    renderWorkspace(
      <DayGrid day={day} todayISO={DATE} tasksByDate={new Map([[DATE, [task]]])} onSelectDay={vi.fn()} />,
      emptyWorkspace({ tasks: [task], timeEntries: [entry as never] }),
    );
    const block = await screen.findByRole("button", { name: /Deep work, tracked/ });
    expect(block).toHaveClass("is-tracked");
  });

  test("add control calls onSelectDay without an input, focuses one when present", async () => {
    const { onSelectDay } = grid([]);
    const add = await screen.findByRole("button", { name: "Add a task on this day" });
    await userEvent.click(add);
    expect(onSelectDay).toHaveBeenCalledWith(DATE);

    const input = document.createElement("input");
    input.setAttribute("data-day-add-input", "");
    document.body.appendChild(input);
    await userEvent.click(add);
    expect(input).toHaveFocus();
    input.remove();
  });

  test("untimed tasks and all-day Apple events show in the strip", async () => {
    const external = new Map([
      [DATE, [{ id: "x1", title: "Bank holiday", start: DATE, end: "2026-03-11", allDay: true }]],
    ]);
    grid([makeTask({ scheduled: DATE, title: "No time task" })], { externalByDate: external });
    const chip = await screen.findByRole("button", { name: "No time task" });
    expect(chip).toHaveClass("is-flow");
    expect(screen.getByText("Bank holiday").closest("[data-external-event]")).toHaveClass("is-external");
  });

  test("scrolls to wakingStartHour once settings exist", async () => {
    const { container } = grid([]);
    const body = container.querySelector(".overflow-y-auto") as HTMLElement;
    // Quarter-hour lead so the first hour label is not cut by the top edge.
    await waitFor(() => expect(body.scrollTop).toBe((7 - 0.25) * 56));
  });
});
