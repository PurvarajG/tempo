import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import Reminders from "@/components/Reminders";
import { toISODate } from "@/lib/parse";
import { useTasks } from "@/lib/store-context";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

function Driver({ id }: { id: string }) {
  const { patchTask, completeTask } = useTasks();
  return (
    <>
      <button onClick={() => void patchTask(id, { notes: "typing", minutes: 45 })}>unrelated</button>
      <button onClick={() => void patchTask(id, { dueTime: "10:17" })}>retime</button>
      <button onClick={() => void completeTask(id)}>finish</button>
    </>
  );
}

const PROMPT = "Turn on reminders for tasks with a due time?";

function stubNotification(permission: NotificationPermission) {
  const ctor = vi.fn();
  const requestPermission = vi.fn().mockResolvedValue("granted");
  vi.stubGlobal("Notification", Object.assign(ctor, { permission, requestPermission }));
  return { ctor, requestPermission };
}

function stubStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage = {
    getItem: vi.fn((k: string) => data.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => void data.set(k, v)),
    removeItem: vi.fn((k: string) => void data.delete(k)),
  };
  vi.stubGlobal("localStorage", storage);
  return storage;
}

describe("Reminders prompt", () => {
  beforeEach(() => {
    delete (window as unknown as { doem?: unknown }).doem;
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete (window as unknown as { doem?: unknown }).doem;
  });

  test("shows when permission is default and not dismissed", () => {
    stubNotification("default");
    stubStorage();
    renderWorkspace(<Reminders />);

    expect(screen.getByText(PROMPT)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Turn on" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Not now" })).toBeInTheDocument();
  });

  test("Turn on requests permission", async () => {
    const { requestPermission } = stubNotification("default");
    stubStorage();
    renderWorkspace(<Reminders />);

    await userEvent.click(screen.getByRole("button", { name: "Turn on" }));
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  test("Not now stores the dismissal and hides the prompt", async () => {
    stubNotification("default");
    const storage = stubStorage();
    renderWorkspace(<Reminders />);

    await userEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(storage.setItem).toHaveBeenCalledWith("reminders-dismissed", "1");
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
  });

  test("stays hidden once dismissed", () => {
    stubNotification("default");
    stubStorage({ "reminders-dismissed": "1" });
    renderWorkspace(<Reminders />);

    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
  });

  test("no prompt under Electron", () => {
    stubNotification("default");
    stubStorage();
    (window as unknown as { doem: unknown }).doem = { notify: vi.fn() };
    renderWorkspace(<Reminders />);

    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
  });

  test("a task due now fires one notification", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(new Date(2026, 2, 5, 10, 15, 10));
    const { ctor } = stubNotification("granted");
    stubStorage();
    const now = new Date();
    const task = makeTask({
      title: "Call the venue",
      scheduled: toISODate(now),
      dueTime: "10:15",
    });
    renderWorkspace(<Reminders />, emptyWorkspace({ tasks: [task] }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(ctor).toHaveBeenCalledTimes(1);
    expect(ctor).toHaveBeenCalledWith("Call the venue", { body: "Due now", tag: task.id });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(ctor).toHaveBeenCalledTimes(1);
  });

  test("a task moved to a new time today fires again (web)", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(new Date(2026, 2, 5, 10, 15, 10));
    const { ctor } = stubNotification("granted");
    stubStorage();
    const task = makeTask({ id: "a", title: "Call", scheduled: toISODate(new Date()), dueTime: "10:15" });
    renderWorkspace(
      <>
        <Reminders />
        <Driver id="a" />
      </>,
      emptyWorkspace({ tasks: [task] }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(ctor).toHaveBeenCalledTimes(1);
    await act(async () => {
      screen.getByRole("button", { name: "retime" }).click();
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    expect(ctor).toHaveBeenCalledTimes(2);
  });
});

describe("Reminders under Electron", () => {
  let setReminders: ReturnType<typeof vi.fn>;
  let notify: ReturnType<typeof vi.fn>;
  const today = () => toISODate(new Date());

  beforeEach(() => {
    setReminders = vi.fn();
    notify = vi.fn();
    (window as unknown as { doem: unknown }).doem = { setReminders, notify };
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete (window as unknown as { doem?: unknown }).doem;
  });

  test("sends only today's timed open tasks with a 10 minute lead", async () => {
    stubNotification("default");
    stubStorage();
    const t = makeTask({ id: "a", title: "Timed", scheduled: today(), dueTime: "14:30" });
    const others = [
      makeTask({ id: "b", scheduled: today(), dueTime: "09:00", status: "done" }),
      makeTask({ id: "c", scheduled: today() }),
      makeTask({ id: "d", scheduled: null, dueTime: "09:00" }),
      makeTask({ id: "e", scheduled: "2999-01-01", dueTime: "09:00" }),
    ];
    renderWorkspace(<Reminders />, emptyWorkspace({ tasks: [t, ...others] }));

    await waitFor(() => expect(setReminders).toHaveBeenCalled());
    expect(setReminders).toHaveBeenCalledTimes(1);
    expect(setReminders).toHaveBeenCalledWith([
      { taskId: "a", title: "Timed", scheduled: today(), dueTime: "14:30", leadMinutes: 10 },
    ]);
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
  });

  test("does not resend when an unrelated field changes", async () => {
    stubNotification("default");
    stubStorage();
    const t = makeTask({ id: "a", scheduled: today(), dueTime: "14:30" });
    renderWorkspace(
      <>
        <Reminders />
        <Driver id="a" />
      </>,
      emptyWorkspace({ tasks: [t] }),
    );
    await waitFor(() => expect(setReminders).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole("button", { name: "unrelated" }));
    await new Promise((r) => setTimeout(r, 50));
    expect(setReminders).toHaveBeenCalledTimes(1);
  });

  test("sends an empty list when the last timed task is done", async () => {
    stubNotification("default");
    stubStorage();
    const t = makeTask({ id: "a", scheduled: today(), dueTime: "14:30" });
    const { mock } = renderWorkspace(
      <>
        <Reminders />
        <Driver id="a" />
      </>,
      emptyWorkspace({ tasks: [t] }),
    );
    mock.respondWith("/complete", { task: { ...t, status: "done" }, next: null });
    await waitFor(() => expect(setReminders).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole("button", { name: "finish" }));
    await waitFor(() => expect(setReminders).toHaveBeenLastCalledWith([]));
  });

  test("the renderer never fires notify", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(new Date(2026, 2, 5, 10, 15, 10));
    stubNotification("granted");
    stubStorage();
    const t = makeTask({ scheduled: toISODate(new Date()), dueTime: "10:15" });
    renderWorkspace(<Reminders />, emptyWorkspace({ tasks: [t] }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(notify).not.toHaveBeenCalled();
  });
});
