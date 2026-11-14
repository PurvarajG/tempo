import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import MonthGrid from "@/components/calendar/MonthGrid";
import { monthGrid } from "@/lib/calendar";
import type { ExternalEvent } from "@/lib/icloud";
import { emptyWorkspace, makeProject, makeTask, renderWorkspace } from "./harness";

const TODAY = "2026-03-10";
const project = makeProject();

function render(
  year: number,
  month: number,
  tasks = [makeTask({ scheduled: TODAY, title: "Ship the board" })],
  opts: { todayISO?: string; onAnnounce?: (m: string) => void; external?: Map<string, ExternalEvent[]> } = {},
) {
  const byDate = new Map<string, typeof tasks>();
  for (const t of tasks) byDate.set(t.scheduled as string, [...(byDate.get(t.scheduled as string) ?? []), t]);
  return renderWorkspace(
    <MonthGrid
      days={monthGrid(year, month)}
      todayISO={opts.todayISO ?? TODAY}
      tasksByDate={byDate}
      externalByDate={opts.external}
      onSelectDay={() => {}}
      onAnnounce={opts.onAnnounce ?? (() => {})}
    />,
    emptyWorkspace({ tasks, projects: [project] }),
  );
}

describe("month grid", () => {
  test("renders only the rows the month needs", async () => {
    const { unmount } = render(2026, 2);
    const n = (await screen.findAllByRole("button", { name: /, \d+ tasks?$/ })).length;
    expect(n).toBe(monthGrid(2026, 2).length);
    expect(n % 7).toBe(0);
    unmount();
    render(2026, 9); // October 2026
    expect((await screen.findAllByRole("button", { name: /, \d+ tasks?$/ })).length).toBe(
      monthGrid(2026, 9).length,
    );
  });

  test("shows 35 cells for a five-week month and 28 for February 2027", async () => {
    expect(monthGrid(2026, 8)).toHaveLength(35);
    const { unmount } = render(2026, 8, [], { todayISO: "2026-09-10" });
    expect(await screen.findAllByRole("button", { name: /, 0 tasks$/ })).toHaveLength(35);
    unmount();
    expect(monthGrid(2027, 1)).toHaveLength(28);
    render(2027, 1, [], { todayISO: "2027-02-10" });
    expect(await screen.findAllByRole("button", { name: /, 0 tasks$/ })).toHaveLength(28);
  });

  test("the head reads Mon first, in sentence case", async () => {
    render(2026, 2);
    const heads = (await screen.findAllByText(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/)).map((n) => n.textContent);
    expect(heads).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  });

  test("today's day button is marked and has a readable label", async () => {
    render(2026, 2);
    const btn = await screen.findByRole("button", { name: "Tue 10 Mar, 1 task" });
    expect(btn).toHaveAttribute("aria-current", "date");
    expect(screen.queryByText(/^today$/i)).toBeNull();
    expect(screen.getAllByRole("button", { name: /, 0 tasks$/ })[0]).not.toHaveAttribute("aria-current");
  });

  test("a cell with four tasks shows two chips and +2 more in a five-week month", async () => {
    const day = "2026-09-10";
    const tasks = [1, 2, 3, 4].map((i) =>
      makeTask({ id: `11111111-1111-4111-8111-11111111111${i}`, scheduled: day, title: `Task ${i}` }),
    );
    render(2026, 8, tasks, { todayISO: day });
    await screen.findByRole("button", { name: "Thu 10 Sep, 4 tasks" });
    expect(screen.getByRole("button", { name: "Task 2" })).toHaveClass("cal-ev", "is-flow", "is-short");
    expect(screen.queryByRole("button", { name: "Task 3" })).toBeNull();
    expect(screen.getByRole("button", { name: "+2 more" })).toHaveClass("text-meta", "text-ink-3");
  });

  test("a six-week month renders six equal rows and an overflowing cell shows +N more", async () => {
    const tasks = [1, 2, 3].map((i) =>
      makeTask({ id: `11111111-1111-4111-8111-11111111111${i}`, scheduled: TODAY, title: `Task ${i}` }),
    );
    const { container } = render(2026, 2, tasks);
    await screen.findByRole("button", { name: "Tue 10 Mar, 3 tasks" });
    expect(monthGrid(2026, 2)).toHaveLength(42);
    const grid = container.querySelector("[data-month-body] > div") as HTMLElement;
    expect(grid.style.gridTemplateRows).toBe("repeat(6, minmax(0, 1fr))");
    expect(screen.getByRole("button", { name: "Task 1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Task 2" })).toBeNull();
    expect(screen.getByRole("button", { name: "+2 more" })).toBeInTheDocument();
  });

  test("out-of-month days are present but marked", async () => {
    render(2026, 2);
    const apr = (await screen.findByRole("button", { name: /Wed 1 Apr/ })).parentElement as HTMLElement;
    expect(apr).toHaveAttribute("data-in-month", "false");
    expect(screen.getByRole("button", { name: "Tue 10 Mar, 1 task" }).parentElement).toHaveAttribute(
      "data-in-month",
      "true",
    );
  });

  test("Apple events are read-only", async () => {
    const ext: ExternalEvent[] = [1, 2, 3].map((i) => ({
      id: `e${i}`,
      title: `Event ${i}`,
      start: TODAY,
      end: "2026-03-11",
      allDay: true,
    }));
    const day = "2026-09-10";
    const { container } = render(2026, 8, [], { todayISO: day, external: new Map([[day, ext]]) });
    await screen.findByRole("button", { name: /Thu 10 Sep/ });
    expect(container.querySelectorAll("[data-external-event]")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "+1 more" })).toBeInTheDocument();
  });

  test("dropping a chip on another day reschedules it and announces a readable date", async () => {
    const task = makeTask({ scheduled: TODAY, title: "Ship the board" });
    const announcements: string[] = [];
    const { mock } = render(2026, 2, [task], { onAnnounce: (m) => announcements.push(m) });
    const marker = (await screen.findByRole("button", { name: "Ship the board" })).parentElement as HTMLElement;
    const target = screen.getByRole("button", { name: /Thu 12 Mar/ }).parentElement as HTMLElement;
    const dataTransfer = { effectAllowed: "", setData: () => {}, getData: () => task.id };
    const fire = async (node: HTMLElement, type: string) => {
      node.dispatchEvent(Object.assign(new Event(type, { bubbles: true, cancelable: true }), { dataTransfer }));
      await waitFor(() => {});
    };
    await fire(marker, "dragstart");
    await fire(target, "dragover");
    expect(target.className).toContain("bg-accent-soft");
    await fire(target, "drop");
    await waitFor(() =>
      expect(mock.calls).toContainEqual({
        url: `/api/tasks/${task.id}`,
        method: "PATCH",
        body: { scheduled: "2026-03-12" },
      }),
    );
    expect(announcements).toContain("Ship the board moved to Thu 12 Mar.");
    expect(within(target).queryByText(/\d{4}-\d{2}-\d{2}/)).toBeNull();
  });

  test("the head stays fixed and the day grid shares the body height, never scrolling", async () => {
    render(2026, 2);
    const cell = (await screen.findByRole("button", { name: "Tue 10 Mar, 1 task" })).parentElement as HTMLElement;
    const grid = cell.parentElement as HTMLElement;
    const body = grid.parentElement as HTMLElement;
    expect(body).toHaveClass("overflow-hidden", "min-h-0", "flex-1");
    expect(body).not.toHaveClass("overflow-y-auto");
    expect(grid).toHaveClass("h-full");
    const head = screen.getByText("Mon").parentElement as HTMLElement;
    expect(body.contains(head)).toBe(false);
    expect(head).toHaveClass("shrink-0");
    expect(head.parentElement).toBe(body.parentElement);
  });
});
