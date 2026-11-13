import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { useTasks } from "@/lib/store-context";
import TimerStrip from "@/components/TimerStrip";
import TimerConflict from "@/components/TimerConflict";
import TaskTime from "@/components/TaskTime";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";
import type { TimeEntry } from "@/lib/types";

const taskA = makeTask({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", title: "Write the plan" });
const taskB = makeTask({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", title: "Fix the nav" });

function entry(taskId: string, overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    taskId,
    categoryId: "00000000-0000-0000-0000-000000000002",
    startedAt: new Date(Date.now() - 90_000).toISOString(),
    createdAt: "2026-03-01T09:00:00.000Z",
    updatedAt: "2026-03-01T09:00:00.000Z",
    ...overrides,
  };
}

describe("running timer strip", () => {
  test("stays hidden when nothing is running", async () => {
    renderWorkspace(<TimerStrip />, emptyWorkspace({ tasks: [taskA] }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument());
  });

  test("names the running task, shows elapsed time, and stops from anywhere", async () => {
    const running = entry(taskA.id);
    const { mock } = renderWorkspace(
      <TimerStrip />,
      emptyWorkspace({ tasks: [taskA, taskB], timeEntries: [running], running }),
    );

    expect(await screen.findByRole("button", { name: "Write the plan" })).toBeInTheDocument();
    expect(screen.getByText(/^\d{2}:\d{2}$/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Stop" }));
    await waitFor(() =>
      expect(mock.calls).toContainEqual({
        url: "/api/time-entries/stop",
        method: "POST",
        body: undefined,
      }),
    );
  });

  test("card variant says Tracking now and is not fixed", async () => {
    const running = entry(taskA.id);
    const { container } = renderWorkspace(
      <TimerStrip />,
      emptyWorkspace({ tasks: [taskA], timeEntries: [running], running }),
    );
    expect(await screen.findByText("Tracking now")).toBeInTheDocument();
    expect(container.firstElementChild?.className).not.toMatch(/\bfixed\b/);
  });

  test("card variant is the mockup timer: parts, token classes, stop calls stopTimer", async () => {
    const running = entry(taskA.id);
    const { container, mock } = renderWorkspace(
      <TimerStrip />,
      emptyWorkspace({ tasks: [taskA], timeEntries: [running], running }),
    );
    await screen.findByText("Tracking now");
    const card = container.querySelector('[data-part="timer"]');
    expect(card).not.toBeNull();
    expect(card?.className).toMatch(/\brounded-timer\b/);
    const clock = container.querySelector('[data-part="clock"]');
    expect(clock?.className).toMatch(/\btext-clock\b/);
    expect(clock?.className).not.toMatch(/text-kpi/);
    const stop = screen.getByRole("button", { name: "Stop" });
    expect(stop.className).toMatch(/\bsize-8\b/);
    expect(stop.className).toMatch(/\brounded-tab\b/);
    expect(stop.firstElementChild?.className).toMatch(/\brounded-stop\b/);

    await userEvent.click(stop);
    await waitFor(() =>
      expect(mock.calls).toContainEqual({ url: "/api/time-entries/stop", method: "POST", body: undefined }),
    );
  });

  test("compact variant shows the title and stops the timer, not fixed", async () => {
    const running = entry(taskA.id);
    const { mock, container } = renderWorkspace(
      <TimerStrip variant="compact" />,
      emptyWorkspace({ tasks: [taskA], timeEntries: [running], running }),
    );
    expect(await screen.findByRole("button", { name: "Write the plan" })).toBeInTheDocument();
    expect(screen.queryByText("Tracking now")).not.toBeInTheDocument();
    expect(container.firstElementChild?.className).not.toMatch(/\bfixed\b/);

    await userEvent.click(screen.getByRole("button", { name: "Stop" }));
    await waitFor(() =>
      expect(mock.calls).toContainEqual({
        url: "/api/time-entries/stop",
        method: "POST",
        body: undefined,
      }),
    );
  });
});

function StartFocus({ task }: { task: typeof taskA }) {
  const { startFocus } = useTasks();
  return <button onClick={() => void startFocus(task)}>probe focus</button>;
}

async function focusRender(variant: "card" | "compact" = "card") {
  const running = entry(taskA.id, { startedAt: new Date().toISOString() });
  const view = renderWorkspace(
    <>
      <StartFocus task={taskA} />
      <TimerStrip variant={variant} />
    </>,
    emptyWorkspace({ tasks: [taskA], timeEntries: [running], running }),
  );
  await userEvent.click(await screen.findByRole("button", { name: "probe focus" }));
  return view;
}

describe("focus session on the timer card", () => {
  afterEach(() => vi.useRealTimers());

  test("shows a countdown while counting", async () => {
    const { container } = await focusRender();
    expect(await screen.findByText("Focus")).toBeInTheDocument();
    expect(screen.getByLabelText(/^\d{1,2}:\d{2} left$/)).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/text-hi|bg-hi/);
  });

  test("Time's up offers Done, +15m and Keep going; +15m returns to counting", async () => {
    await focusRender();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    act(() => vi.setSystemTime(Date.now() + 3 * 60 * 60_000));
    expect(await screen.findByText("Time's up")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep going" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "+15m" }));
    expect(await screen.findByLabelText(/left$/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Done" })).not.toBeInTheDocument();
  });

  test("Keep going shows one neutral line and no buttons", async () => {
    const { container } = await focusRender();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    act(() => vi.setSystemTime(Date.now() + 3 * 60 * 60_000));
    await userEvent.click(await screen.findByRole("button", { name: "Keep going" }));
    expect(await screen.findByText("Tracking now")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Done" })).not.toBeInTheDocument();
    expect(container.querySelectorAll("p")).toHaveLength(1);
    expect(container.innerHTML).not.toMatch(/text-hi|bg-hi/);
  });

  test("Done stops the timer then completes the task", async () => {
    const { mock } = await focusRender();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    act(() => vi.setSystemTime(Date.now() + 3 * 60 * 60_000));
    mock.respondWith(`/api/tasks/${taskA.id}/complete`, { task: { ...taskA, status: "done" }, next: null });
    await userEvent.click(await screen.findByRole("button", { name: "Done" }));
    await waitFor(() => {
      const urls = mock.calls.map((c) => c.url);
      expect(urls).toContain("/api/time-entries/stop");
      expect(urls.indexOf("/api/time-entries/stop")).toBeLessThan(
        urls.findIndex((u) => u.endsWith("/complete")),
      );
    });
  });

  test("compact variant shows the countdown, then Time's up with a menu of the same actions", async () => {
    Element.prototype.getBoundingClientRect = vi.fn(function (this: Element) {
      const r = (o: Partial<DOMRect>) => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {}, ...o });
      if (this.hasAttribute("data-picker-menu")) return r({ height: 120, width: 160 });
      if (this.getAttribute("aria-haspopup") === "menu") return r({ top: 10, bottom: 38, left: 20, right: 48, width: 28, height: 28 });
      return r({});
    }) as unknown as typeof Element.prototype.getBoundingClientRect;
    const { mock } = await focusRender("compact");
    expect(await screen.findByText(/^\d{1,2}:\d{2}$/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Time's up actions" })).not.toBeInTheDocument();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    act(() => vi.setSystemTime(Date.now() + 3 * 60 * 60_000));
    expect(await screen.findByText("Time's up")).toBeInTheDocument();

    const trigger = await screen.findByRole("button", { name: "Time's up actions" });
    await userEvent.click(trigger);
    expect(await screen.findByRole("menuitem", { name: "Done" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "+15m" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Keep going" })).toBeInTheDocument();

    // +15m returns to counting, as on the card.
    await userEvent.click(screen.getByRole("menuitem", { name: "+15m" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Time's up actions" })).not.toBeInTheDocument());

    // Time's up again, then Done stops then completes.
    act(() => vi.setSystemTime(Date.now() + 3 * 60 * 60_000));
    mock.respondWith(`/api/tasks/${taskA.id}/complete`, { task: { ...taskA, status: "done" }, next: null });
    await userEvent.click(await screen.findByRole("button", { name: "Time's up actions" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Done" }));
    await waitFor(() => {
      const urls = mock.calls.map((c) => c.url);
      expect(urls).toContain("/api/time-entries/stop");
      expect(urls.indexOf("/api/time-entries/stop")).toBeLessThan(urls.findIndex((u) => u.endsWith("/complete")));
    });
  });
});

describe("timer conflicts", () => {
  test("a second start identifies the running task and offers one hand-off", async () => {
    const running = entry(taskA.id);
    const { mock } = renderWorkspace(
      <>
        <TaskTime task={taskB} />
        <TimerConflict />
      </>,
      emptyWorkspace({ tasks: [taskA, taskB], timeEntries: [running], running }),
    );

    mock.failNext("/api/time-entries", 409, "Another task is already being timed", {
      runningTaskId: taskA.id,
    });
    await userEvent.click(await screen.findByRole("button", { name: "Start timer" }));

    const dialog = await screen.findByRole("alertdialog", { name: "A timer is already running" });
    expect(dialog).toHaveTextContent("Write the plan");

    mock.respondNext(
      "/api/time-entries",
      {
        stopped: { ...running, endedAt: new Date().toISOString(), minutes: 2 },
        started: entry(taskB.id, { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" }),
      },
      "POST",
    );
    await userEvent.click(screen.getByRole("button", { name: "Switch" }));
    await waitFor(() =>
      expect(mock.calls).toContainEqual({
        url: "/api/time-entries",
        method: "POST",
        // One atomic request, not a stop followed by a start.
        body: { taskId: taskB.id, replaceRunning: true },
      }),
    );
  });

  test("keeping the current timer dismisses the prompt without starting anything", async () => {
    const running = entry(taskA.id);
    const { mock } = renderWorkspace(
      <>
        <TaskTime task={taskB} />
        <TimerConflict />
      </>,
      emptyWorkspace({ tasks: [taskA, taskB], timeEntries: [running], running }),
    );
    mock.failNext("/api/time-entries", 409, "Another task is already being timed", {
      runningTaskId: taskA.id,
    });

    await userEvent.click(await screen.findByRole("button", { name: "Start timer" }));
    await userEvent.click(await screen.findByRole("button", { name: "Keep current" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(mock.calls.filter((c) => c.body && "replaceRunning" in (c.body as object))).toHaveLength(0);
  });

  test("Switch has focus when the dialog opens", async () => {
    const running = entry(taskA.id);
    const { mock } = renderWorkspace(
      <>
        <TaskTime task={taskB} />
        <TimerConflict />
      </>,
      emptyWorkspace({ tasks: [taskA, taskB], timeEntries: [running], running }),
    );
    mock.failNext("/api/time-entries", 409, "Another task is already being timed", {
      runningTaskId: taskA.id,
    });
    await userEvent.click(await screen.findByRole("button", { name: "Start timer" }));
    const switchButton = await screen.findByRole("button", { name: "Switch" });
    await waitFor(() => expect(switchButton).toHaveFocus());
  });

  test("Escape closes the dialog and calls no timer endpoint", async () => {
    const running = entry(taskA.id);
    const { mock } = renderWorkspace(
      <>
        <TaskTime task={taskB} />
        <TimerConflict />
      </>,
      emptyWorkspace({ tasks: [taskA, taskB], timeEntries: [running], running }),
    );
    mock.failNext("/api/time-entries", 409, "Another task is already being timed", {
      runningTaskId: taskA.id,
    });
    await userEvent.click(await screen.findByRole("button", { name: "Start timer" }));
    await screen.findByRole("alertdialog");
    const before = mock.calls.length;

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(mock.calls.slice(before).filter((c) => c.url.startsWith("/api/time-entries"))).toHaveLength(0);
  });
});

describe("task time totals", () => {
  test("estimate versus recorded counts only stopped entries", async () => {
    const running = entry(taskA.id, { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" });
    const stopped = entry(taskA.id, {
      startedAt: "2026-03-01T09:00:00.000Z",
      endedAt: "2026-03-01T09:25:00.000Z",
      minutes: 25,
    });

    renderWorkspace(
      <TaskTime task={taskA} />,
      emptyWorkspace({ tasks: [taskA], timeEntries: [stopped, running], running }),
    );

    // 25m recorded of a 30m estimate — the live timer is displayed, not summed.
    expect(await screen.findByText(/25m of 30m/)).toBeInTheDocument();
  });

  test("a manual entry records time that was never timed", async () => {
    const { mock } = renderWorkspace(<TaskTime task={taskA} />, emptyWorkspace({ tasks: [taskA] }));

    await userEvent.click(await screen.findByRole("button", { name: "Record time" }));
    const minutes = screen.getByLabelText("Minutes");
    await userEvent.clear(minutes);
    await userEvent.type(minutes, "45");
    await userEvent.click(screen.getByRole("button", { name: "Record" }));

    await waitFor(() => {
      const call = mock.calls.find((c) => c.url === "/api/time-entries");
      expect((call?.body as { minutes: number })?.minutes).toBe(45);
    });
  });
});
