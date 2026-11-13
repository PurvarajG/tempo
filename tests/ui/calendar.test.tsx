import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import MonthGrid from "@/components/calendar/MonthGrid";
import WeekGrid from "@/components/calendar/WeekGrid";
import DayGrid from "@/components/calendar/DayGrid";
import DayPanel from "@/components/calendar/DayPanel";
import TaskPanel from "@/components/TaskPanel";
import { dayRange, monthGrid, weekGrid } from "@/lib/calendar";
import type { ExternalEvent } from "@/lib/icloud";
import { emptyWorkspace, makeProject, makeTask, renderWorkspace } from "./harness";

const TODAY = "2026-03-10";
const task = makeTask({ scheduled: TODAY, title: "Ship the board" });
const project = makeProject();

function tasksByDate() {
  return new Map([[TODAY, [task]]]);
}

describe("month calendar", () => {
  test("renders the month with adjacent days present but muted", async () => {
    renderWorkspace(
      <MonthGrid
        days={monthGrid(2026, 2)}
        todayISO={TODAY}
        tasksByDate={tasksByDate()}
        onSelectDay={() => {}}
        onAnnounce={() => {}}
      />,
      emptyWorkspace({ tasks: [task], projects: [project] }),
    );

    // Every day is a labelled button, including the borrowed April days.
    expect(await screen.findByRole("button", { name: /^Sun 1 Mar, / })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Wed 1 Apr, / })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tue 10 Mar, 1 task" })).toBeInTheDocument();
  });

  test("dragging a task marker to another date reschedules it and announces the move", async () => {
    const announcements: string[] = [];
    const { mock } = renderWorkspace(
      <MonthGrid
        days={monthGrid(2026, 2)}
        todayISO={TODAY}
        tasksByDate={tasksByDate()}
        onSelectDay={() => {}}
        onAnnounce={(m) => announcements.push(m)}
      />,
      emptyWorkspace({ tasks: [task], projects: [project] }),
    );

    const marker = (await screen.findByRole("button", { name: "Ship the board" }))
      .parentElement as HTMLElement;
    const targetCell = screen.getByRole("button", { name: /^Thu 12 Mar, / })
      .parentElement as HTMLElement;

    const dataTransfer = {
      effectAllowed: "",
      setData: () => {},
      getData: () => task.id,
    };

    // Each step is awaited separately: dispatching all three in one tick would
    // batch the state updates, and the drop handler would still see no drag.
    const fire = async (node: HTMLElement, type: string) => {
      node.dispatchEvent(
        Object.assign(new Event(type, { bubbles: true, cancelable: true }), { dataTransfer }),
      );
      await waitFor(() => {});
    };

    await fire(marker, "dragstart");
    await fire(targetCell, "dragover");
    await fire(targetCell, "drop");

    await waitFor(() =>
      expect(mock.calls).toContainEqual({
        url: `/api/tasks/${task.id}`,
        method: "PATCH",
        body: { scheduled: "2026-03-12" },
      }),
    );
    expect(announcements).toContain("Ship the board moved to Thu 12 Mar.");
  });

  test("a drop announces a readable date, never an ISO one, even across years", async () => {
    const decTask = makeTask({ scheduled: "2026-12-10", title: "Ship the board" });
    const announcements: string[] = [];
    renderWorkspace(
      <MonthGrid
        days={monthGrid(2026, 11)}
        todayISO="2026-12-10"
        tasksByDate={new Map([["2026-12-10", [decTask]]])}
        onSelectDay={() => {}}
        onAnnounce={(m) => announcements.push(m)}
      />,
      emptyWorkspace({ tasks: [decTask], projects: [project] }),
    );
    const marker = (await screen.findByRole("button", { name: "Ship the board" }))
      .parentElement as HTMLElement;
    const targetCell = screen.getByRole("button", { name: /^1 Jan 2027, / })
      .parentElement as HTMLElement;
    const dataTransfer = { effectAllowed: "", setData: () => {}, getData: () => decTask.id };
    const fire = async (node: HTMLElement, type: string) => {
      node.dispatchEvent(
        Object.assign(new Event(type, { bubbles: true, cancelable: true }), { dataTransfer }),
      );
      await waitFor(() => {});
    };
    await fire(marker, "dragstart");
    await fire(targetCell, "dragover");
    await fire(targetCell, "drop");
    await waitFor(() => expect(announcements).toHaveLength(1));
    expect(announcements[0]).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(announcements[0]).toMatch(/^Ship the board moved to (Fri 1 Jan|1 Jan 2027)\.$/);
  });
});

describe("month calendar — complex tasks", () => {
  const spanTask = makeTask({
    id: "44444444-4444-4444-8444-444444444444",
    scheduled: "2026-03-10",
    isComplex: true,
    finishDate: "2026-03-12",
    title: "Write the report",
  });

  function spanTasksByDate() {
    return new Map([
      ["2026-03-10", [spanTask]],
      ["2026-03-11", [spanTask]],
      ["2026-03-12", [spanTask]],
    ]);
  }

  test("a complex task is listed on every day in its range", async () => {
    renderWorkspace(
      <MonthGrid
        days={monthGrid(2026, 2)}
        todayISO={TODAY}
        tasksByDate={spanTasksByDate()}
        onSelectDay={() => {}}
        onAnnounce={() => {}}
      />,
      emptyWorkspace({ tasks: [spanTask], projects: [project] }),
    );

    for (const label of [/^Tue 10 Mar, /, /^Wed 11 Mar, /, /^Thu 12 Mar, /]) {
      const button = await screen.findByRole("button", { name: label });
      expect(within(button.parentElement as HTMLElement).getByText("Write the report")).toBeInTheDocument();
    }
  });

  test("dragging a complex task's marker shifts the whole range, preserving span length", async () => {
    const { mock } = renderWorkspace(
      <MonthGrid
        days={monthGrid(2026, 2)}
        todayISO={TODAY}
        tasksByDate={spanTasksByDate()}
        onSelectDay={() => {}}
        onAnnounce={() => {}}
      />,
      emptyWorkspace({ tasks: [spanTask], projects: [project] }),
    );

    const markers = await screen.findAllByRole("button", { name: "Write the report" });
    const marker = markers[0].parentElement as HTMLElement;
    const targetCell = screen.getByRole("button", { name: /^Sun 15 Mar, / })
      .parentElement as HTMLElement;

    const dataTransfer = { effectAllowed: "", setData: () => {}, getData: () => spanTask.id };
    const fire = async (node: HTMLElement, type: string) => {
      node.dispatchEvent(
        Object.assign(new Event(type, { bubbles: true, cancelable: true }), { dataTransfer }),
      );
      await waitFor(() => {});
    };

    await fire(marker, "dragstart");
    await fire(targetCell, "dragover");
    await fire(targetCell, "drop");

    // Dragged the day-10 marker to the 15th: a 5-day shift, so the 2-day span
    // (10th->12th) becomes 15th->17th.
    await waitFor(() =>
      expect(mock.calls).toContainEqual({
        url: `/api/tasks/${spanTask.id}`,
        method: "PATCH",
        body: { scheduled: "2026-03-15", finishDate: "2026-03-17" },
      }),
    );
  });
});

describe("day panel", () => {
  test("lists the day's tasks and adds a new one on that date", async () => {
    const { mock } = renderWorkspace(
      <DayPanel iso={TODAY} tasks={[task]} onClose={() => {}} />,
      emptyWorkspace({ tasks: [task], projects: [project] }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Ship the board" })).toBeInTheDocument();

    await userEvent.type(
      within(dialog).getByLabelText("Add a task on this day"),
      "Write the release note{Enter}",
    );

    await waitFor(() =>
      expect(mock.calls).toContainEqual({
        url: "/api/tasks",
        method: "POST",
        body: { text: "Write the release note", scheduled: TODAY },
      }),
    );
  });

  test("Move date is the accessible equivalent of dragging, and keeps the time", async () => {
    const timed = makeTask({ scheduled: TODAY, title: "Standup", dueTime: "09:30" });
    const { mock } = renderWorkspace(
      <DayPanel iso={TODAY} tasks={[timed]} onClose={() => {}} />,
      emptyWorkspace({ tasks: [timed] }),
    );

    await userEvent.click(await screen.findByRole("button", { name: "Move date for Standup" }));
    const field = screen.getByLabelText("New date for Standup");
    await userEvent.clear(field);
    await userEvent.type(field, "2026-03-18");

    await waitFor(() =>
      expect(mock.calls).toContainEqual({
        url: `/api/tasks/${timed.id}`,
        method: "PATCH",
        // Only the date is sent, so the 09:30 stays untouched.
        body: { scheduled: "2026-03-18" },
      }),
    );
  });

  test("an empty day offers task creation rather than a dead end", async () => {
    renderWorkspace(<DayPanel iso="2026-03-22" tasks={[]} onClose={() => {}} />, emptyWorkspace());

    expect(await screen.findByText(/Nothing scheduled/)).toBeInTheDocument();
    expect(screen.getByLabelText("Add a task on this day")).toBeInTheDocument();
  });

  test("selecting a task opens the shared task panel", async () => {
    renderWorkspace(
      <>
        <DayPanel iso={TODAY} tasks={[task]} onClose={() => {}} />
        <TaskPanel />
      </>,
      emptyWorkspace({ tasks: [task] }),
    );

    await userEvent.click(await screen.findByRole("button", { name: "Ship the board" }));
    expect(await screen.findByRole("dialog", { name: "Task" })).toBeInTheDocument();
  });
});

describe("imported Apple Calendar events", () => {
  const external: ExternalEvent = {
    id: "icloud-1",
    title: "Dentist",
    start: "2026-03-10T14:00:00.000Z",
    end: "2026-03-10T15:00:00.000Z",
    allDay: false,
  };

  function externalByDate(events = [external]) {
    return new Map([[TODAY, events]]);
  }

  test("renders imported events alongside tasks, without drag or click affordances", async () => {
    renderWorkspace(
      <MonthGrid
        days={monthGrid(2026, 2).slice(0, 35)}
        todayISO={TODAY}
        tasksByDate={tasksByDate()}
        externalByDate={externalByDate()}
        onSelectDay={() => {}}
        onAnnounce={() => {}}
      />,
      emptyWorkspace({ tasks: [task], projects: [project] }),
    );

    const pill = await screen.findByText("Dentist");
    const marker = pill.closest("[data-external-event]") as HTMLElement;

    expect(marker).not.toBeNull();
    expect(marker.getAttribute("draggable")).toBeNull();
    expect(within(marker).queryByRole("button")).toBeNull();
    // The task marker beside it is still fully interactive.
    expect(screen.getByRole("button", { name: "Ship the board" })).toBeInTheDocument();
  });

  test("clicking an imported event does nothing at all", async () => {
    const selections: string[] = [];
    const { mock } = renderWorkspace(
      <MonthGrid
        days={monthGrid(2026, 2).slice(0, 35)}
        todayISO={TODAY}
        tasksByDate={tasksByDate()}
        externalByDate={externalByDate()}
        onSelectDay={(iso) => selections.push(iso)}
        onAnnounce={() => {}}
      />,
      emptyWorkspace({ tasks: [task], projects: [project] }),
    );

    await userEvent.click(await screen.findByText("Dentist"));

    expect(selections).toEqual([]);
    // No write of any kind reached the API — the mock only records non-GETs.
    expect(mock.calls).toEqual([]);
  });

  test("the grid is unchanged when iCloud is not configured", async () => {
    renderWorkspace(
      <MonthGrid
        days={monthGrid(2026, 2).slice(0, 35)}
        todayISO={TODAY}
        tasksByDate={tasksByDate()}
        onSelectDay={() => {}}
        onAnnounce={() => {}}
      />,
      emptyWorkspace({ tasks: [task], projects: [project] }),
    );

    expect(await screen.findByRole("button", { name: "Ship the board" })).toBeInTheDocument();
    expect(document.querySelector("[data-external-event]")).toBeNull();
  });

  test("the day panel lists them read-only under their own heading", async () => {
    renderWorkspace(
      <DayPanel iso={TODAY} tasks={[task]} externalEvents={[external]} onClose={() => {}} />,
      emptyWorkspace({ tasks: [task], projects: [project] }),
    );

    const section = (await screen.findByText("From Apple Calendar")).closest("section") as HTMLElement;
    expect(within(section).getByText("Dentist")).toBeInTheDocument();
    expect(within(section).queryByRole("button")).toBeNull();
    expect(within(section).queryByRole("textbox")).toBeNull();
    // No "Move date" control, unlike the task above it.
    expect(within(section).queryByText(/move date/i)).toBeNull();
  });

  test("an all-day event is labelled as such", async () => {
    renderWorkspace(
      <DayPanel
        iso={TODAY}
        tasks={[]}
        externalEvents={[{ ...external, allDay: true, start: TODAY, end: "2026-03-11" }]}
        onClose={() => {}}
      />,
      emptyWorkspace(),
    );

    expect(await screen.findByText("All day")).toBeInTheDocument();
  });

  test("the panel shows no Apple Calendar section when there is nothing to show", async () => {
    renderWorkspace(
      <DayPanel iso={TODAY} tasks={[task]} onClose={() => {}} />,
      emptyWorkspace({ tasks: [task], projects: [project] }),
    );

    expect(await screen.findByText("Ship the board")).toBeInTheDocument();
    expect(screen.queryByText("From Apple Calendar")).toBeNull();
  });
});

// The three grids share `useDragReschedule` for cross-day drop targets.
// WeekGrid's whole day column (header + chip strip + hour box) is one drop
// zone, exactly like MonthGrid's whole cell — this proves a drop anywhere in
// the column reschedules, not only a drop inside the hour-gridded box.
describe("week calendar — drag to reschedule", () => {
  test("dropping a timed task marker anywhere in another day's column reschedules it", async () => {
    const timedTask = makeTask({ id: task.id, scheduled: TODAY, dueTime: "09:00", title: "Ship the board" });
    const announcements: string[] = [];
    const { mock } = renderWorkspace(
      <WeekGrid
        days={weekGrid(TODAY)}
        todayISO={TODAY}
        tasksByDate={new Map([[TODAY, [timedTask]]])}
        onSelectDay={() => {}}
        onAnnounce={(m) => announcements.push(m)}
      />,
      emptyWorkspace({ tasks: [timedTask], projects: [project] }),
    );

    // The timed block is itself the draggable button (no wrapper element).
    const marker = (await screen.findByRole("button", { name: /Ship the board/ })) as HTMLElement;
    // TODAY (2026-03-10) is a Tuesday in this week; drop on the Thursday two
    // days later, still inside the same Mon–Sun week grid. Drop on the day
    // HEADER, not the hour box, since that's the part FIX A restored as a
    // drop target.
    const targetHeader = screen.getByRole("button", { name: "Thu 12 Mar, 0 tasks" });

    const dataTransfer = { effectAllowed: "", setData: () => {}, getData: () => timedTask.id };
    const fire = async (node: HTMLElement, type: string) => {
      node.dispatchEvent(
        Object.assign(new Event(type, { bubbles: true, cancelable: true }), { dataTransfer }),
      );
      await waitFor(() => {});
    };

    await fire(marker, "dragstart");
    await fire(targetHeader, "dragover");
    await fire(targetHeader, "drop");

    await waitFor(() =>
      expect(mock.calls).toContainEqual({
        url: `/api/tasks/${timedTask.id}`,
        method: "PATCH",
        body: { scheduled: "2026-03-12" },
      }),
    );
    expect(announcements).toContain("Ship the board moved to Thu 12 Mar.");
  });

  test("dropping an untimed task marker on another day's untimed chip strip reschedules it", async () => {
    const untimedTask = makeTask({ id: task.id, scheduled: TODAY, title: "Ship the board" });
    const announcements: string[] = [];
    const { mock } = renderWorkspace(
      <WeekGrid
        days={weekGrid(TODAY)}
        todayISO={TODAY}
        tasksByDate={new Map([[TODAY, [untimedTask]]])}
        onSelectDay={() => {}}
        onAnnounce={(m) => announcements.push(m)}
      />,
      emptyWorkspace({ tasks: [untimedTask], projects: [project] }),
    );

    // The untimed chip is itself the draggable button; its parent is the
    // all-day strip cell for Tuesday.
    const marker = (await screen.findByRole("button", { name: "Ship the board" })) as HTMLElement;
    // The visually matching drop target for an untimed chip is another
    // day's (empty) all-day strip cell, not the hour-gridded column below it.
    // Strip children: rail spacer, then Mon..Sun, so Thursday is index 4.
    const strip = (marker.parentElement as HTMLElement).parentElement as HTMLElement;
    const targetChipStrip = strip.children[4] as HTMLElement;
    expect(targetChipStrip).toBeTruthy();
    expect(targetChipStrip.querySelector("button")).toBeNull();

    const dataTransfer = { effectAllowed: "", setData: () => {}, getData: () => untimedTask.id };
    const fire = async (node: HTMLElement, type: string) => {
      node.dispatchEvent(
        Object.assign(new Event(type, { bubbles: true, cancelable: true }), { dataTransfer }),
      );
      await waitFor(() => {});
    };

    await fire(marker, "dragstart");
    await fire(targetChipStrip, "dragover");
    await fire(targetChipStrip, "drop");

    await waitFor(() =>
      expect(mock.calls).toContainEqual({
        url: `/api/tasks/${untimedTask.id}`,
        method: "PATCH",
        body: { scheduled: "2026-03-12" },
      }),
    );
    expect(announcements).toContain("Ship the board moved to Thu 12 Mar.");
  });
});

describe("day calendar", () => {
  // Day view only ever shows one day, so there is no second date to drop a
  // marker onto — it deliberately doesn't wire up `useDragReschedule`.
  // Rescheduling stays reachable through `onSelectDay` → DayPanel's "Move
  // date" control, the same accessible path touch/keyboard users already
  // rely on for the other views' drag.
  test("tasks render as plain buttons with no drag affordance", async () => {
    const { container } = renderWorkspace(
      <DayGrid
        day={dayRange(TODAY)[0]}
        todayISO={TODAY}
        tasksByDate={tasksByDate()}
        onSelectDay={() => {}}
      />,
      emptyWorkspace({ tasks: [task], projects: [project] }),
    );

    const marker = await screen.findByRole("button", { name: "Ship the board" });
    expect(marker.getAttribute("draggable")).toBeNull();
    expect(container.querySelector("[draggable]")).toBeNull();
  });

  test("the day panel is reachable via onSelectDay for moving a task's date", async () => {
    const onSelectDay = vi.fn();
    renderWorkspace(
      <DayGrid
        day={dayRange(TODAY)[0]}
        todayISO={TODAY}
        tasksByDate={tasksByDate()}
        onSelectDay={onSelectDay}
      />,
      emptyWorkspace({ tasks: [task], projects: [project] }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Add a task on this day" }));
    expect(onSelectDay).toHaveBeenCalledWith(TODAY);
  });
});
