import { useEffect } from "react";
import { act, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useTasks } from "@/lib/store-context";
import type { TimeEntry } from "@/lib/types";
import { emptyWorkspace, makeProject, makeStages, makeTask, renderWorkspace } from "./harness";

const T = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const P = makeProject();
const [BACKLOG, ACTIVE, BLOCKED, DONE] = makeStages(P.id);

let api: ReturnType<typeof useTasks>;
function Probe() {
  const value = useTasks();
  useEffect(() => {
    api = value;
  });
  return (
    <div>
      <span data-testid="offer">{value.undoOffer?.label ?? "none"}</span>
      <span data-testid="action">{value.undoOffer?.action?.label ?? "none"}</span>
      <span data-testid="stage">{value.tasks[0]?.stageId ?? "none"}</span>
      <span data-testid="running">{value.running?.taskId ?? "none"}</span>
    </div>
  );
}
const text = (id: string) => screen.getByTestId(id).textContent;

const entry = (): TimeEntry =>
  ({
    id: "99999999-9999-4999-8999-999999999999",
    taskId: T,
    startedAt: "2026-03-01T09:00:00.000Z",
    endedAt: null,
  }) as unknown as TimeEntry;

async function setup(opts: { running?: boolean; stageId?: string } = {}) {
  const task = makeTask({ id: T, projectId: P.id, stageId: opts.stageId ?? BACKLOG.id });
  const r = renderWorkspace(
    <Probe />,
    emptyWorkspace({
      tasks: [task],
      projects: [P],
      stages: [BACKLOG, ACTIVE, BLOCKED, DONE],
      running: opts.running ? entry() : null,
    }),
  );
  await waitFor(() => expect(text("stage")).not.toBe("none"));
  if (opts.running) await waitFor(() => expect(text("running")).toBe(T));
  return r;
}

async function move(mock: { respondWith: (f: string, v: unknown) => void }, stageId: string) {
  mock.respondWith(`/api/tasks/${T}/move`, makeTask({ id: T, stageId }));
  mock.respondWith("/api/tasks", [makeTask({ id: T, projectId: P.id, stageId })]);
  await act(async () => void (await api.moveTask(T, stageId, 0)));
}

describe("board move and the timer", () => {
  it("offers Start timer? on a move into an active lane, and the action starts it", async () => {
    const { mock } = await setup();
    await move(mock, ACTIVE.id);
    expect(text("offer")).toBe(`Moved to ${ACTIVE.name}`);
    expect(text("action")).toBe("Start timer?");

    mock.respondWith("/api/time-entries", entry());
    await act(async () => void (await api.undoOffer?.action?.run()));
    expect(mock.calls.some((c) => c.url === "/api/time-entries" && (c.body as { taskId: string }).taskId === T)).toBe(true);
    await waitFor(() => expect(text("running")).toBe(T));
  });

  it("offers no action on a move into backlog", async () => {
    const { mock } = await setup({ stageId: ACTIVE.id });
    await move(mock, BACKLOG.id);
    expect(text("offer")).toBe(`Moved to ${BACKLOG.name}`);
    expect(text("action")).toBe("none");
  });

  it("offers no Start timer? when the task is already running", async () => {
    const { mock } = await setup({ running: true });
    await move(mock, ACTIVE.id);
    expect(text("action")).toBe("none");
    expect(mock.calls.some((c) => c.url.includes("/stop"))).toBe(false);
  });

  it.each([
    ["done", DONE],
    ["blocked", BLOCKED],
  ])("stops the running timer when its task moves to a %s lane", async (_n, lane) => {
    const { mock } = await setup({ running: true, stageId: ACTIVE.id });
    mock.respondWith("/api/time-entries/stop", { ...entry(), endedAt: "2026-03-01T09:30:00.000Z" });
    await move(mock, lane.id);
    expect(mock.calls.some((c) => c.url === "/api/time-entries/stop")).toBe(true);
    await waitFor(() => expect(text("running")).toBe("none"));
    expect(text("action")).toBe("none");
  });

  it("undo still moves the task back", async () => {
    const { mock } = await setup();
    await move(mock, ACTIVE.id);
    mock.calls.length = 0;
    mock.respondWith(`/api/tasks/${T}/move`, makeTask({ id: T, stageId: BACKLOG.id }));
    mock.respondWith("/api/tasks", [makeTask({ id: T, projectId: P.id, stageId: BACKLOG.id })]);
    await act(async () => api.undo());
    expect(mock.calls[0].body).toEqual({ stageId: BACKLOG.id, index: 0 });
    await waitFor(() => expect(text("stage")).toBe(BACKLOG.id));
  });
});
