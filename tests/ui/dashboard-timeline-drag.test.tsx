import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import DashboardTimeline from "@/components/today/DashboardTimeline";
import TaskPanel from "@/components/TaskPanel";
import { emptyWorkspace, makeProject, makeTask, renderWorkspace } from "./harness";

vi.mock("@/lib/useNow", () => ({
  useNow: () => new Date("2026-08-14T12:00:00"),
}));

/** 5 columns at 100px each, starting at x=0 — days[0]=08-14 … days[4]=08-18. */
const GRID_RECT = { left: 0, width: 500, top: 0, height: 40, right: 500, bottom: 40, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
const DAY_CENTER = [50, 150, 250, 350, 450];

function stubGrid(container: HTMLElement) {
  const grid = container.querySelector('[data-testid="timeline-day-grid"]');
  if (!grid) throw new Error("timeline-day-grid not found");
  vi.spyOn(grid, "getBoundingClientRect").mockReturnValue(GRID_RECT);
}

/** Mirrors a real browser: pointerdown → pointermove → pointerup → click, in that order. */
function drag(el: Element, fromX: number, toX: number, { release = true } = {}) {
  fireEvent.pointerDown(el, { pointerId: 1, clientX: fromX, clientY: 0 });
  fireEvent.pointerMove(el, { pointerId: 1, clientX: toX, clientY: 0 });
  if (release) {
    fireEvent.pointerUp(el, { pointerId: 1, clientX: toX, clientY: 0 });
    fireEvent.click(el);
  }
}

function handlesOf(bar: Element): [Element, Element] {
  const start = bar.nextElementSibling;
  const end = start?.nextElementSibling;
  if (!start || !end) throw new Error("drag handles not found next to bar");
  return [start, end];
}

function patchCalls(mock: ReturnType<typeof renderWorkspace>["mock"], taskId: string) {
  return mock.calls.filter((c) => c.method === "PATCH" && c.url === `/api/tasks/${taskId}`);
}

describe("Today dashboard timeline — day-scale drag", () => {
  test("a plain click (no movement) still opens the task panel and sends no patch", async () => {
    const project = makeProject();
    const task = makeTask({ scheduled: "2026-08-15", projectId: project.id, title: "Ship timeline" });
    const view = renderWorkspace(
      <>
        <DashboardTimeline todayISO="2026-08-14" span={5} />
        <TaskPanel />
      </>,
      emptyWorkspace({ projects: [project], tasks: [task] }),
    );

    await screen.findByRole("button", { name: "Ship timeline" });
    stubGrid(view.container);

    const bar = view.container.querySelector('[data-testid="timeline-bar"]')!;
    drag(bar, 150, 150);

    expect(await screen.findByRole("dialog", { name: "Task" })).toBeInTheDocument();
    expect(patchCalls(view.mock, task.id)).toHaveLength(0);
  });

  test("dragging the bar body moves a single-day task and does not open the panel", async () => {
    const project = makeProject();
    const task = makeTask({ scheduled: "2026-08-15", projectId: project.id, title: "Movable" });
    const view = renderWorkspace(
      <>
        <DashboardTimeline todayISO="2026-08-14" span={5} />
        <TaskPanel />
      </>,
      emptyWorkspace({ projects: [project], tasks: [task] }),
    );

    await screen.findByRole("button", { name: "Movable" });
    stubGrid(view.container);

    const bar = view.container.querySelector('[data-testid="timeline-bar"]')!;
    drag(bar, DAY_CENTER[1], DAY_CENTER[3]);

    const calls = patchCalls(view.mock, task.id);
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ scheduled: "2026-08-17" });
    expect(screen.queryByRole("dialog", { name: "Task" })).not.toBeInTheDocument();
  });

  test("dragging the right handle turns a single-day task into a complex span", async () => {
    const project = makeProject();
    const task = makeTask({ scheduled: "2026-08-15", projectId: project.id, title: "Grows" });
    const view = renderWorkspace(<DashboardTimeline todayISO="2026-08-14" span={5} />, emptyWorkspace({ projects: [project], tasks: [task] }));

    await screen.findByRole("button", { name: "Grows" });
    stubGrid(view.container);

    const bar = view.container.querySelector('[data-testid="timeline-bar"]')!;
    const [, endHandle] = handlesOf(bar);
    drag(endHandle, DAY_CENTER[1], DAY_CENTER[3]);

    const calls = patchCalls(view.mock, task.id);
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ isComplex: true, finishDate: "2026-08-17" });
  });

  test("dragging the right handle back onto the start day reverts a span to a single-day task", async () => {
    const project = makeProject();
    const task = makeTask({
      scheduled: "2026-08-14",
      isComplex: true,
      finishDate: "2026-08-16",
      projectId: project.id,
      title: "Shrinks back",
    });
    const view = renderWorkspace(<DashboardTimeline todayISO="2026-08-14" span={5} />, emptyWorkspace({ projects: [project], tasks: [task] }));

    await screen.findByRole("button", { name: "Shrinks back" });
    stubGrid(view.container);

    const bar = view.container.querySelector('[data-testid="timeline-bar"]')!;
    const [, endHandle] = handlesOf(bar);
    drag(endHandle, DAY_CENTER[2], DAY_CENTER[0]);

    const calls = patchCalls(view.mock, task.id);
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ isComplex: false });
  });

  test("dragging the left handle moves the start day and leaves the finish date untouched", async () => {
    const project = makeProject();
    const task = makeTask({
      scheduled: "2026-08-15",
      isComplex: true,
      finishDate: "2026-08-17",
      projectId: project.id,
      title: "Left edge",
    });
    const view = renderWorkspace(<DashboardTimeline todayISO="2026-08-14" span={5} />, emptyWorkspace({ projects: [project], tasks: [task] }));

    await screen.findByRole("button", { name: "Left edge" });
    stubGrid(view.container);

    const bar = view.container.querySelector('[data-testid="timeline-bar"]')!;
    const [startHandle] = handlesOf(bar);
    drag(startHandle, DAY_CENTER[1], DAY_CENTER[0]);

    const calls = patchCalls(view.mock, task.id);
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ scheduled: "2026-08-14" });
  });

  test("dragging the left handle past the right edge clamps with no patch and no error", async () => {
    const project = makeProject();
    const task = makeTask({
      scheduled: "2026-08-15",
      isComplex: true,
      finishDate: "2026-08-17",
      projectId: project.id,
      title: "Clamped",
    });
    const view = renderWorkspace(<DashboardTimeline todayISO="2026-08-14" span={5} />, emptyWorkspace({ projects: [project], tasks: [task] }));

    await screen.findByRole("button", { name: "Clamped" });
    stubGrid(view.container);

    const bar = view.container.querySelector('[data-testid="timeline-bar"]')!;
    const [startHandle] = handlesOf(bar);
    drag(startHandle, DAY_CENTER[1], DAY_CENTER[4]);

    expect(patchCalls(view.mock, task.id)).toHaveLength(0);
    // The bar is still there afterwards, at its original (unchanged) position — no snap-back flicker.
    expect(await screen.findByRole("button", { name: "Clamped" })).toBeInTheDocument();
  });

  test("moving a span that starts before the visible window preserves its real length", async () => {
    const project = makeProject();
    const task = makeTask({
      scheduled: "2026-08-10",
      isComplex: true,
      finishDate: "2026-08-20",
      projectId: project.id,
      title: "Off-screen span",
    });
    const view = renderWorkspace(<DashboardTimeline todayISO="2026-08-14" span={5} />, emptyWorkspace({ projects: [project], tasks: [task] }));

    await screen.findByRole("button", { name: "Off-screen span" });
    stubGrid(view.container);

    const bar = view.container.querySelector('[data-testid="timeline-bar"]')!;
    expect(bar).toHaveStyle({ left: "0%", width: "100%" });

    drag(bar, DAY_CENTER[0], DAY_CENTER[2]);

    const calls = patchCalls(view.mock, task.id);
    expect(calls).toHaveLength(1);
    // A 6-day move (08-10 → 08-16, the day under the drop point) must shift both ends by 6 days,
    // not truncate the span to whatever was visible on screen.
    expect(calls[0].body).toEqual({ scheduled: "2026-08-16", finishDate: "2026-08-26" });
  });

  test("bars and handles opt out of native touch scrolling", async () => {
    const project = makeProject();
    const task = makeTask({ scheduled: "2026-08-15", projectId: project.id, title: "Touch target" });
    const view = renderWorkspace(<DashboardTimeline todayISO="2026-08-14" span={5} />, emptyWorkspace({ projects: [project], tasks: [task] }));

    await screen.findByRole("button", { name: "Touch target" });

    const bar = view.container.querySelector('[data-testid="timeline-bar"]')!;
    const [startHandle, endHandle] = handlesOf(bar);
    expect(bar).toHaveStyle({ touchAction: "none" });
    expect(startHandle).toHaveStyle({ touchAction: "none" });
    expect(endHandle).toHaveStyle({ touchAction: "none" });
  });

  test("a touch-emulated drag commits the same as a mouse drag", async () => {
    const project = makeProject();
    const task = makeTask({ scheduled: "2026-08-15", projectId: project.id, title: "Touch move" });
    const view = renderWorkspace(<DashboardTimeline todayISO="2026-08-14" span={5} />, emptyWorkspace({ projects: [project], tasks: [task] }));

    await screen.findByRole("button", { name: "Touch move" });
    stubGrid(view.container);

    const bar = view.container.querySelector('[data-testid="timeline-bar"]')!;
    fireEvent.pointerDown(bar, { pointerId: 2, pointerType: "touch", clientX: DAY_CENTER[1], clientY: 0 });
    fireEvent.pointerMove(bar, { pointerId: 2, pointerType: "touch", clientX: DAY_CENTER[3], clientY: 0 });
    fireEvent.pointerUp(bar, { pointerId: 2, pointerType: "touch", clientX: DAY_CENTER[3], clientY: 0 });

    const calls = patchCalls(view.mock, task.id);
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ scheduled: "2026-08-17" });
  });
});
