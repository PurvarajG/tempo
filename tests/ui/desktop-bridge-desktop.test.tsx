import { act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DesktopBridge from "@/components/DesktopBridge";
import { addDays, toISODate } from "@/lib/parse";
import type { DoemCommand } from "@/lib/desktop-bridge";
import type { TimeEntry } from "@/lib/types";
import { emptyWorkspace, makeCategory, makeTask, renderWorkspace } from "./harness";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

const TODAY = toISODate(new Date());
const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "33333333-3333-4333-8333-333333333333";
const REST_ID = "44444444-4444-4444-8444-444444444444";

let send: (command: DoemCommand) => void;
let doem: Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  doem = {
    onCommand: vi.fn((cb: (c: DoemCommand) => void) => {
      send = cb;
      return vi.fn();
    }),
    setBadge: vi.fn(),
    setTimerStatus: vi.fn(),
    setCanToggleTimer: vi.fn(),
    setDesktopSettings: vi.fn(),
  };
  vi.stubGlobal("doem", doem);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function entry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    taskId: ID_A,
    startedAt: new Date(Date.now() - 60 * 60_000).toISOString(),
    minutes: null,
    source: "timer",
    createdAt: new Date().toISOString(),
    ...overrides,
  } as TimeEntry;
}

async function setup(workspace = emptyWorkspace()) {
  const view = renderWorkspace(<DesktopBridge />, workspace);
  await waitFor(() => expect(doem.onCommand).toHaveBeenCalled());
  return view;
}

describe("DesktopBridge desktop commands", () => {
  it("badge counts today's open tasks plus timed overdue ones", async () => {
    const tasks = [
      makeTask({ id: ID_A, scheduled: TODAY }),
      makeTask({ id: ID_B, scheduled: addDays(TODAY, -1), dueTime: "09:00" }),
      makeTask({ id: "66666666-6666-4666-8666-666666666666", scheduled: addDays(TODAY, -1) }),
      makeTask({ id: "77777777-7777-4777-8777-777777777777", scheduled: addDays(TODAY, 3) }),
    ];
    await setup(emptyWorkspace({ tasks }));
    await waitFor(() => expect(doem.setBadge).toHaveBeenLastCalledWith(2));
  });

  it("badge is 0 when dockBadge is none", async () => {
    const base = emptyWorkspace();
    await setup(
      emptyWorkspace({
        tasks: [makeTask({ scheduled: TODAY })],
        trackingSettings: { ...base.trackingSettings, dockBadge: "none" },
      }),
    );
    await waitFor(() => expect(doem.setBadge).toHaveBeenLastCalledWith(0));
  });

  it("pushes desktop settings, defaults first and again when they change", async () => {
    const base = emptyWorkspace();
    await setup(emptyWorkspace({ trackingSettings: { ...base.trackingSettings, nudgeMinutes: 20 } }));
    expect(doem.setDesktopSettings).toHaveBeenCalledWith({
      captureShortcut: "Control+Alt+Space",
      nudgeMinutes: null,
      claudeAwareness: true,
    });
    await waitFor(() =>
      expect(doem.setDesktopSettings).toHaveBeenLastCalledWith({
        captureShortcut: "Control+Alt+Space",
        nudgeMinutes: 20,
        claudeAwareness: true,
      }),
    );
  });

  it("pushes claudeAwareness false when settings say so", async () => {
    const base = emptyWorkspace();
    await setup(emptyWorkspace({ trackingSettings: { ...base.trackingSettings, claudeAwareness: false } }));
    await waitFor(() =>
      expect(doem.setDesktopSettings).toHaveBeenLastCalledWith({
        captureShortcut: "Control+Alt+Space",
        nudgeMinutes: null,
        claudeAwareness: false,
      }),
    );
  });

  it("refresh-tasks refetches /api/tasks", async () => {
    const { mock } = await setup();
    const fetchMock = vi.mocked(fetch);
    const before = fetchMock.mock.calls.filter(([u]) => u === "/api/tasks").length;
    mock.respondWith("/api/tasks", [makeTask({ title: "Captured thing", scheduled: TODAY })]);
    act(() => send({ type: "refresh-tasks" }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([u]) => u === "/api/tasks").length).toBe(before + 1),
    );
    await waitFor(() => expect(doem.setBadge).toHaveBeenLastCalledWith(1));
  });

  it("reminder-start starts the timer on that task", async () => {
    const { mock } = await setup();
    mock.respondNext("/api/time-entries", entry(), "POST");
    act(() => send({ type: "reminder-start", taskId: ID_A }));
    await waitFor(() =>
      expect(mock.calls).toContainEqual({ url: "/api/time-entries", method: "POST", body: { taskId: ID_A } }),
    );
  });

  it("reminder-tomorrow reschedules to tomorrow", async () => {
    const { mock } = await setup(emptyWorkspace({ tasks: [makeTask({ id: ID_A, scheduled: TODAY })] }));
    mock.respondWith("/api/tasks/reschedule", [makeTask({ id: ID_A, scheduled: addDays(TODAY, 1) })]);
    act(() => send({ type: "reminder-tomorrow", taskId: ID_A }));
    await waitFor(() => expect(mock.calls.length).toBeGreaterThan(0));
    const call = mock.calls[0];
    expect(JSON.stringify(call.body)).toContain(addDays(TODAY, 1));
    expect(JSON.stringify(call.body)).toContain(ID_A);
  });

  describe("away", () => {
    const running = entry();
    const awayFrom = new Date(Date.now() - 30 * 60_000).toISOString();
    const awayTo = new Date().toISOString();

    it("does nothing when nothing is running", async () => {
      const { mock } = await setup();
      act(() => send({ type: "away", choice: "discard", awayFrom, awayTo }));
      await new Promise((r) => setTimeout(r, 50));
      expect(mock.calls).toEqual([]);
    });

    it("keep does nothing", async () => {
      const { mock } = await setup(emptyWorkspace({ running, timeEntries: [running] }));
      await waitFor(() => expect(doem.setTimerStatus).toHaveBeenLastCalledWith(expect.objectContaining({})));
      act(() => send({ type: "away", choice: "keep", awayFrom, awayTo }));
      await new Promise((r) => setTimeout(r, 50));
      expect(mock.calls).toEqual([]);
    });

    it("discard stops the timer and trims the entry to the idle start", async () => {
      const { mock } = await setup(emptyWorkspace({ running, timeEntries: [running] }));
      await waitFor(() => expect(doem.setTimerStatus).toHaveBeenLastCalledWith(expect.objectContaining({})));
      mock.respondNext("/api/time-entries/stop", { ...running, endedAt: awayTo, minutes: 60 }, "POST");
      act(() => send({ type: "away", choice: "discard", awayFrom, awayTo }));
      await waitFor(() => expect(mock.calls.some((c) => c.method === "PATCH")).toBe(true));
      expect(mock.calls[0].url).toBe("/api/time-entries/stop");
      const patch = mock.calls.find((c) => c.method === "PATCH")!;
      expect(patch.url).toBe(`/api/time-entries/${running.id}`);
      expect((patch.body as { minutes: number }).minutes).toBe(30);
    });

    it("break trims the entry, records a rest segment and restarts the task", async () => {
      const rest = makeCategory({ id: REST_ID, name: "Rest", kind: "rest", sortOrder: 1 });
      const base = emptyWorkspace();
      const { mock } = await setup(
        emptyWorkspace({ running, timeEntries: [running], categories: [...base.categories, rest] }),
      );
      await waitFor(() => expect(doem.setTimerStatus).toHaveBeenLastCalledWith(expect.objectContaining({})));
      mock.respondNext("/api/time-entries/stop", { ...running, endedAt: awayTo, minutes: 60 }, "POST");
      mock.respondNext("/api/segments", { id: "seg", categoryId: REST_ID, startedAt: awayFrom, endedAt: awayTo }, "POST");
      mock.respondNext("/api/time-entries", entry({ id: "88888888-8888-4888-8888-888888888888" }), "POST");
      act(() => send({ type: "away", choice: "break", awayFrom, awayTo }));
      await waitFor(() =>
        expect(mock.calls).toContainEqual({ url: "/api/time-entries", method: "POST", body: { taskId: ID_A } }),
      );
      const seg = mock.calls.find((c) => c.url === "/api/segments")!;
      expect(seg.body).toMatchObject({ categoryId: REST_ID, startedAt: awayFrom, endedAt: awayTo });
      expect(mock.calls.some((c) => c.method === "PATCH")).toBe(true);
    });
  });
});
