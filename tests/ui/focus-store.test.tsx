import { useEffect } from "react";
import { act, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TasksProvider, useTasks } from "@/lib/store-context";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";
import type { TimeEntry } from "@/lib/types";

const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function entry(taskId: string): TimeEntry {
  return {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    taskId,
    categoryId: "00000000-0000-0000-0000-000000000002",
    startedAt: new Date().toISOString(),
    createdAt: "2026-03-01T09:00:00.000Z",
    updatedAt: "2026-03-01T09:00:00.000Z",
  };
}

type Api = ReturnType<typeof useTasks>;

function Probe({ apiRef }: { apiRef: { current: Api | null } }) {
  const api = useTasks();
  // Assigned in an effect, never during render (react-hooks/globals).
  useEffect(() => {
    apiRef.current = api;
  });
  return (
    <>
      <div data-testid="ends">{api.focus?.endsAt ?? "none"}</div>
      <div data-testid="ack">{api.focus ? String(api.focus.acknowledged) : "none"}</div>
      <div data-testid="mins">{api.focus?.minutes ?? "none"}</div>
    </>
  );
}

function setup(minutes: number | undefined, withRunning = true) {
  const task = makeTask({ id: ID, title: "Write the plan", minutes });
  const running = withRunning ? entry(ID) : null;
  const apiRef: { current: Api | null } = { current: null };
  const r = renderWorkspace(
    <Probe apiRef={apiRef} />,
    emptyWorkspace({ tasks: [task], timeEntries: running ? [running] : [], running }),
  );
  return { ...r, task, apiRef };
}

const ready = (apiRef: { current: Api | null }) =>
  waitFor(() => expect(apiRef.current?.running?.taskId).toBe(ID));

const original = window.doem;

afterEach(() => {
  vi.useRealTimers();
  window.doem = original;
});

describe("focus session in the time store", () => {
  it("starts on the running task with no request and the remaining estimate", async () => {
    const { apiRef, mock, task } = setup(45);
    await ready(apiRef);
    const before = Date.now();
    await act(async () => {
      await apiRef.current!.startFocus(task);
    });
    expect(mock.calls).toHaveLength(0);
    const ends = new Date(screen.getByTestId("ends").textContent!).getTime();
    expect(Math.abs(ends - (before + 45 * 60_000))).toBeLessThan(5_000);
  });

  it("never counts down less than 5 minutes", async () => {
    const { apiRef, task } = setup(2);
    await ready(apiRef);
    await act(async () => {
      await apiRef.current!.startFocus(task);
    });
    expect(screen.getByTestId("mins")).toHaveTextContent("5");
  });

  it("stopping the timer clears focus", async () => {
    const { apiRef, mock, task } = setup(30);
    await ready(apiRef);
    await act(async () => {
      await apiRef.current!.startFocus(task);
    });
    mock.respondWith("/api/time-entries/stop", { ...entry(ID), endedAt: new Date().toISOString(), minutes: 1 });
    await act(async () => {
      await apiRef.current!.stopTimer();
    });
    expect(screen.getByTestId("ends")).toHaveTextContent("none");
  });

  it("extend adds 15 minutes and keep going acknowledges", async () => {
    const { apiRef, task } = setup(30);
    await ready(apiRef);
    await act(async () => {
      await apiRef.current!.startFocus(task);
    });
    const first = new Date(screen.getByTestId("ends").textContent!).getTime();
    act(() => apiRef.current!.extendFocus());
    const second = new Date(screen.getByTestId("ends").textContent!).getTime();
    expect(second - first).toBe(15 * 60_000);
    act(() => apiRef.current!.keepGoing());
    expect(screen.getByTestId("ack")).toHaveTextContent("true");
    act(() => apiRef.current!.endFocus());
    expect(screen.getByTestId("ends")).toHaveTextContent("none");
  });

  it("fires one attention when the time runs out, never twice", async () => {
    const attention = vi.fn();
    window.doem = { attention } as unknown as Window["doem"];
    const { apiRef, task, rerender } = setup(5);
    await ready(apiRef);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    await act(async () => {
      await apiRef.current!.startFocus(task);
    });
    expect(attention).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(5 * 60_000 + 1000);
    });
    expect(attention).toHaveBeenCalledTimes(1);
    expect(attention).toHaveBeenCalledWith({ title: "Time's up", body: "Write the plan" });
    rerender(
      <TasksProvider>
        <Probe apiRef={apiRef} />
      </TasksProvider>,
    );
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(attention).toHaveBeenCalledTimes(1);
  });

  it("a failed start leaves no session, and starting again does not revive it", async () => {
    const { apiRef, mock, task } = setup(30, false);
    await waitFor(() => expect(apiRef.current).not.toBeNull());
    mock.failNext("/api/time-entries");
    await act(async () => {
      await apiRef.current!.startFocus(task);
    });
    expect(screen.getByTestId("ends")).toHaveTextContent("none");
    // A plain start of the same task must not bring the old session back.
    mock.respondNext("/api/time-entries", entry(ID), "POST");
    await act(async () => {
      await apiRef.current!.startTimer(ID);
    });
    expect(apiRef.current!.running?.taskId).toBe(ID);
    expect(screen.getByTestId("ends")).toHaveTextContent("none");
  });

  it("a refresh that changes running clears the session", async () => {
    const { apiRef, task } = setup(30);
    await ready(apiRef);
    await act(async () => {
      await apiRef.current!.startFocus(task);
    });
    expect(screen.getByTestId("ends")).not.toHaveTextContent("none");
    act(() => apiRef.current!.setRunning(null));
    expect(screen.getByTestId("ends")).toHaveTextContent("none");
    act(() => apiRef.current!.setRunning(entry(ID)));
    expect(screen.getByTestId("ends")).toHaveTextContent("none");
  });
});
