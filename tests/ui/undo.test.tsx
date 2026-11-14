import { useEffect } from "react";
import { act, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTasks } from "@/lib/store-context";
import type { Task } from "@/lib/types";
import { emptyWorkspace, makeProject, makeStages, makeTask, renderWorkspace } from "./harness";

const project = makeProject();
const stages = makeStages(project.id);
const ID = "11111111-1111-4111-8111-111111111111";
const COPY = "99999999-9999-4999-8999-999999999999";

let api: ReturnType<typeof useTasks>;
function Probe() {
  const value = useTasks();
  useEffect(() => {
    api = value;
  });
  const t = value.tasks.find((x) => x.id === ID);
  return (
    <div>
      <span data-testid="offer">{value.undoOffer?.label ?? "none"}</span>
      <span data-testid="state">{t ? JSON.stringify({ s: t.status, d: t.scheduled, f: t.finishDate, st: t.stageId, b: t.boardOrder }) : "gone"}</span>
      <span data-testid="count">{value.tasks.length}</span>
    </div>
  );
}

function setup(overrides: Partial<Task> = {}) {
  const task = makeTask({ id: ID, projectId: project.id, stageId: stages[0].id, boardOrder: 2, ...overrides });
  const r = renderWorkspace(<Probe />, emptyWorkspace({ tasks: [task], projects: [project], stages }));
  return { ...r, task };
}
const ready = () => waitFor(() => expect(screen.getByTestId("state").textContent).not.toBe("gone"));
const offer = () => screen.getByTestId("offer").textContent;
const mutating = (m: { calls: { url: string; method: string }[] }) =>
  m.calls.map((c) => `${c.method} ${c.url}`);

describe("undo", () => {
  afterEach(() => vi.useRealTimers());

  it("offers nothing and does nothing when there is no offer", async () => {
    const { mock } = setup();
    await ready();
    await act(async () => api.undo());
    expect(offer()).toBe("none");
    expect(mock.calls).toHaveLength(0);
  });

  it("done: offers, then reopen reverts and removes the repeat copy", async () => {
    const { mock, task } = setup();
    await ready();
    mock.respondWith(`/api/tasks/${ID}/complete`, {
      task: { ...task, status: "done", completedAt: "2026-03-02T00:00:00.000Z" },
      next: makeTask({ id: COPY, title: "copy" }),
    });
    mock.respondWith(`/api/tasks/${ID}/reopen`, task);
    await act(async () => api.completeTask(ID));
    expect(offer()).toBe("Marked done");
    expect(screen.getByTestId("count").textContent).toBe("2");
    await act(async () => api.undo());
    expect(mutating(mock)).toEqual([
      `POST /api/tasks/${ID}/complete`,
      `POST /api/tasks/${ID}/reopen`,
      `DELETE /api/tasks/${COPY}/forever`,
    ]);
    expect(screen.getByTestId("count").textContent).toBe("1");
    expect(JSON.parse(screen.getByTestId("state").textContent!).s).toBe("open");
    expect(offer()).toBe("none");
  });

  it("trash: offers, then restore puts the task back", async () => {
    const { mock, task } = setup();
    await ready();
    mock.respondWith(`/api/tasks/${ID}/restore`, task);
    await act(async () => api.trashTask(ID));
    expect(offer()).toBe("Moved to trash");
    expect(screen.getByTestId("state").textContent).toBe("gone");
    await act(async () => api.undo());
    expect(mutating(mock)).toEqual([`DELETE /api/tasks/${ID}`, `POST /api/tasks/${ID}/restore`]);
    expect(screen.getByTestId("state").textContent).not.toBe("gone");
  });

  it("restore: offers, then undo trashes again", async () => {
    const { mock, task } = setup();
    await ready();
    mock.respondWith(`/api/tasks/${ID}/restore`, task);
    await act(async () => api.restoreTask(ID));
    expect(offer()).toBe("Restored");
    await act(async () => api.undo());
    expect(mutating(mock)).toEqual([`POST /api/tasks/${ID}/restore`, `DELETE /api/tasks/${ID}`]);
    expect(screen.getByTestId("state").textContent).toBe("gone");
  });

  it("date change: labels and reverts to the prior date", async () => {
    const { mock } = setup({ scheduled: "2026-03-01" });
    await ready();
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const t = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    await act(async () => api.patchTask(ID, { scheduled: t }));
    expect(offer()).toBe("Moved to tomorrow");
    await act(async () => api.patchTask(ID, { scheduled: today }));
    expect(offer()).toBe("Moved to today");
    await act(async () => api.patchTask(ID, { scheduled: "2099-01-02" }));
    expect(offer()).toMatch(/^Moved to Fri 2 Jan 2099$/);

    mock.calls.length = 0;
    await act(async () => api.undo());
    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0]).toMatchObject({ method: "PATCH", url: `/api/tasks/${ID}`, body: { scheduled: today } });
  });

  it("patch without a date change offers nothing", async () => {
    setup();
    await ready();
    await act(async () => api.patchTask(ID, { title: "Renamed" }));
    expect(offer()).toBe("none");
  });

  it("stage move: labels with the stage name and moves back", async () => {
    const { mock, task } = setup();
    await ready();
    mock.respondWith(`/api/tasks/${ID}/move`, task);
    await act(async () => api.moveTask(ID, stages[1].id, 0));
    expect(offer()).toBe("Moved to In Progress");
    mock.calls.length = 0;
    await act(async () => api.undo());
    expect(mock.calls[0]).toMatchObject({
      method: "POST",
      url: `/api/tasks/${ID}/move`,
      body: { stageId: stages[0].id, index: 2 },
    });
  });

  it("a second offer replaces the first, and the offer expires after 6s", async () => {
    setup();
    await ready();
    vi.useFakeTimers();
    await act(async () => api.trashTask(ID));
    const first = api.undoOffer!.id;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    api.offerUndo("Second", () => {});
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(offer()).toBe("Second");
    expect(api.undoOffer!.id).toBeGreaterThan(first);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(offer()).toBe("Second");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    expect(offer()).toBe("none");
  });

  it("a failed action offers nothing", async () => {
    const { mock } = setup();
    await ready();
    mock.failNext(`/api/tasks/${ID}/complete`);
    await act(async () => api.completeTask(ID));
    expect(offer()).toBe("none");
    mock.failNext(`/api/tasks/${ID}/move`);
    await act(async () => api.moveTask(ID, stages[1].id, 0));
    expect(offer()).toBe("none");
  });

  it("undo reverts only once on a double call", async () => {
    const { mock, task } = setup();
    await ready();
    mock.respondWith(`/api/tasks/${ID}/restore`, task);
    await act(async () => api.trashTask(ID));
    mock.calls.length = 0;
    await act(async () => {
      await Promise.all([api.undo(), api.undo()]);
    });
    expect(mock.calls).toHaveLength(1);
  });
});
