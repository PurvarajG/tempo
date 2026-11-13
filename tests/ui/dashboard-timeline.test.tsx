import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import Today from "@/components/Today";
import DashboardTimeline from "@/components/today/DashboardTimeline";
import TaskPanel from "@/components/TaskPanel";
import { emptyWorkspace, makeProject, makeTask, renderWorkspace } from "./harness";

vi.mock("@/lib/useNow", () => ({
  useNow: () => new Date("2026-08-14T12:00:00"),
}));

describe("Today dashboard timeline", () => {
  test("has no range slider and shows a single-day hour grid by default", () => {
    renderWorkspace(<DashboardTimeline todayISO="2026-08-14" />);

    expect(screen.queryByLabelText("Timeline range")).not.toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.getByTestId("hour-scale-timeline")).toBeInTheDocument();
    expect(screen.getByText("Fri 14 Aug", { selector: "p" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Open calendar for/ })).toHaveLength(1);
  });

  test("Previous, Next and Today move the single-day window by one day", async () => {
    renderWorkspace(<DashboardTimeline todayISO="2026-08-14" />);

    expect(screen.queryByRole("button", { name: "Today" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Previous day" }));
    expect(screen.getByRole("link", { name: "Open calendar for Thu 13 Aug" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(screen.getByRole("link", { name: "Open calendar for Fri 14 Aug" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Today" })).not.toBeInTheDocument();
  });

  test("a multi-day span moves by that many days", async () => {
    renderWorkspace(<DashboardTimeline todayISO="2026-08-14" span={7} />);

    expect(screen.getByTestId("day-scale-timeline")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next 7 days" }));
    expect(screen.getByText("21 Aug to 27 Aug")).toBeInTheDocument();
  });

  test("moves by one day and links unused days to the calendar", async () => {
    renderWorkspace(<DashboardTimeline todayISO="2026-08-14" />);

    await userEvent.click(screen.getByRole("button", { name: "Next day" }));

    expect(screen.getByRole("link", { name: "Open calendar for Sat 15 Aug" })).toHaveAttribute(
      "href",
      "/calendar?date=2026-08-15",
    );
  });

  test("positions timed tasks by their due time and duration", async () => {
    const task = makeTask({
      scheduled: "2026-08-14",
      dueTime: "10:00",
      minutes: 60,
      title: "Time-boxed work",
    });
    const view = renderWorkspace(
      <DashboardTimeline todayISO="2026-08-14" />,
      emptyWorkspace({ tasks: [task] }),
    );

    await screen.findByRole("button", { name: "Time-boxed work" });

    expect(view.container.querySelector('[data-testid="timeline-bar"]')).toHaveStyle({
      // Default waking hours 07:00 to 23:00 (16 hours): 10:00 is 3 hours in, one hour wide.
      left: "18.75%",
      width: "6.25%",
    });
  });

  test("collects untimed work in an unscheduled strip", async () => {
    const task = makeTask({ scheduled: "2026-08-14", title: "Plan the week" });
    renderWorkspace(<DashboardTimeline todayISO="2026-08-14" />, emptyWorkspace({ tasks: [task] }));

    expect(await screen.findByRole("button", { name: "Plan the week" })).toBeInTheDocument();
    expect(screen.getByLabelText("Unscheduled tasks for Fri 14 Aug")).toBeInTheDocument();
  });

  test("stacks tasks that share a time slot instead of overlapping them", async () => {
    const a = makeTask({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", scheduled: "2026-08-14", dueTime: "11:00", minutes: 60, title: "Overlap A" });
    const b = makeTask({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", scheduled: "2026-08-14", dueTime: "11:00", minutes: 60, title: "Overlap B" });
    const view = renderWorkspace(<DashboardTimeline todayISO="2026-08-14" />, emptyWorkspace({ tasks: [a, b] }));

    await screen.findByRole("button", { name: "Overlap A" });

    const bars = view.container.querySelectorAll<HTMLElement>('[data-testid="timeline-bar"]');
    expect(bars).toHaveLength(2);
    // Same horizontal slot, different vertical slot.
    expect(bars[0].style.left).toBe(bars[1].style.left);
    expect(bars[0].style.top).not.toBe(bars[1].style.top);
  });

  test("packs untimed chips side by side rather than one per row", async () => {
    const a = makeTask({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", scheduled: "2026-08-14", title: "Chip A" });
    const b = makeTask({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", scheduled: "2026-08-14", title: "Chip B" });
    renderWorkspace(<DashboardTimeline todayISO="2026-08-14" />, emptyWorkspace({ tasks: [a, b] }));

    await screen.findByRole("button", { name: "Chip A" });

    const strip = screen.getByLabelText("Unscheduled tasks for Fri 14 Aug");
    for (const chip of strip.querySelectorAll('[data-testid="timeline-bar"]')) {
      expect(chip).not.toHaveClass("w-full");
    }
  });

  test("shows tasks whose project is not loaded yet instead of dropping them", async () => {
    const task = makeTask({ scheduled: "2026-08-14", projectId: "99999999-9999-4999-8999-999999999999", title: "Orphaned work" });
    renderWorkspace(<DashboardTimeline todayISO="2026-08-14" span={5} />, emptyWorkspace({ tasks: [task] }));

    await screen.findByRole("button", { name: "Orphaned work" });
    expect(screen.getByTestId("day-scale-timeline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Orphaned work" })).toBeInTheDocument();
  });

  test("uses day-scale project lanes at five days and opens task details", async () => {
    const project = makeProject({ color: "#db2777" });
    const task = makeTask({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", scheduled: "2026-08-14", projectId: project.id, title: "Ship timeline" });
    const view = renderWorkspace(
      <>
        <DashboardTimeline todayISO="2026-08-14" span={5} />
        <TaskPanel />
      </>,
      emptyWorkspace({ projects: [project], tasks: [task] }),
    );

    await screen.findByRole("button", { name: "Ship timeline" });
    expect(screen.getByTestId("day-scale-timeline")).toBeInTheDocument();
    expect(screen.getByText("Website")).toBeInTheDocument();

    await userEvent.click(await screen.findByRole("button", { name: "Ship timeline" }));
    expect(view.container.querySelector('[data-testid="timeline-bar"]')).toHaveStyle({ backgroundColor: "var(--color-project-3)" });
    expect(await screen.findByRole("dialog", { name: "Task" })).toBeInTheDocument();
  });

  test("renders a complex task as one spanning bar, clipped at the visible window's edges", async () => {
    const project = makeProject({ color: "#16a34a" });
    const task = makeTask({
      scheduled: "2026-08-12",
      isComplex: true,
      finishDate: "2026-08-20",
      projectId: project.id,
      title: "Write the report",
    });
    const view = renderWorkspace(
      <DashboardTimeline todayISO="2026-08-14" span={5} />,
      emptyWorkspace({ projects: [project], tasks: [task] }),
    );

    await screen.findByRole("button", { name: "Write the report" });

    // Visible window is 2026-08-14..2026-08-18 (5 days); the range starts
    // 2026-08-12 (before the window) and ends 2026-08-20 (after it), so the
    // bar should be clamped to the full width, starting at the left edge.
    const bar = view.container.querySelector<HTMLElement>('[data-testid="timeline-bar"]');
    expect(bar).toHaveStyle({ left: "0%", width: "100%" });
  });

  test("mounts Today in a bounded workspace with its timeline", async () => {
    const { container } = renderWorkspace(<Today />);

    await userEvent.click(screen.getByRole("radio", { name: "Day" }));

    const primaryPane = container.querySelector<HTMLElement>('[data-testid="today-primary-pane"]');
    const timeline = container.querySelector<HTMLElement>('[data-testid="today-timeline"]');

    expect(container.querySelector('[data-testid="today-workspace"]')).toBeInTheDocument();
    expect(primaryPane).toHaveAttribute("data-density", "compact");
    expect(primaryPane).toContainElement(timeline);
  });
});
