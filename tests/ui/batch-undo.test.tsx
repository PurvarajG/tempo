import { useEffect } from "react";
import { act, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useTasks } from "@/lib/store-context";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const N1 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const N2 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

let api: ReturnType<typeof useTasks>;
function Probe() {
  const value = useTasks();
  useEffect(() => {
    api = value;
  });
  return (
    <div>
      <span data-testid="offer">{value.undoOffer?.label ?? "none"}</span>
      <span data-testid="days">
        {value.tasks.map((t) => `${t.id.slice(0, 1)}=${t.scheduled ?? "null"}`).join(",")}
      </span>
      <span data-testid="count">{value.tasks.length}</span>
    </div>
  );
}
const offer = () => screen.getByTestId("offer").textContent;

function setup() {
  const tasks = [
    makeTask({ id: A, scheduled: "2026-03-01" }),
    makeTask({ id: B, scheduled: "2026-03-01" }),
    makeTask({ id: C, scheduled: null }),
  ];
  const r = renderWorkspace(<Probe />, emptyWorkspace({ tasks }));
  return r;
}
const ready = () => waitFor(() => expect(screen.getByTestId("count").textContent).not.toBe("0"));

describe("batch undo", () => {
  it("rescheduleTasks offers one undo that reverts per prior-date group", async () => {
    const { mock } = setup();
    await ready();
    const day = "2099-01-02";
    mock.respondWith("/api/tasks/reschedule", [A, B, C].map((id) => makeTask({ id, scheduled: day })));
    await act(async () => void (await api.rescheduleTasks([A, B, C], day)));
    expect(offer()).toBe("Moved 3 tasks to Fri 2 Jan 2099");
    expect(screen.getByTestId("days").textContent).toBe(`a=${day},b=${day},c=${day}`);

    mock.calls.length = 0;
    mock.respondWith("/api/tasks/reschedule", []);
    mock.respondNext("/api/tasks/reschedule", [A, B].map((id) => makeTask({ id, scheduled: "2026-03-01" })));
    mock.respondNext("/api/tasks/reschedule", [makeTask({ id: C, scheduled: null })]);
    await act(async () => api.undo());
    expect(mock.calls).toHaveLength(2);
    expect(mock.calls.every((c) => c.url === "/api/tasks/reschedule")).toBe(true);
    expect(mock.calls[0].body).toEqual({ ids: [A, B], day: "2026-03-01" });
    expect(mock.calls[1].body).toEqual({ ids: [C], day: null });
    expect(screen.getByTestId("days").textContent).toBe("a=2026-03-01,b=2026-03-01,c=null");
    expect(offer()).toBe("none");
  });

  it("rescheduleTasks to null says Inbox", async () => {
    const { mock } = setup();
    await ready();
    mock.respondWith("/api/tasks/reschedule", [A, B].map((id) => makeTask({ id, scheduled: null })));
    await act(async () => void (await api.rescheduleTasks([A, B], null)));
    expect(offer()).toBe("Moved 2 tasks to Inbox");
  });

  it("a failed reschedule offers nothing", async () => {
    const { mock } = setup();
    await ready();
    mock.failNext("/api/tasks/reschedule");
    await act(async () => void (await api.rescheduleTasks([A], "2099-01-02")));
    expect(offer()).toBe("none");
  });

  it("addTasks offers one undo that trashes both without a new offer", async () => {
    const { mock } = setup();
    await ready();
    mock.respondWith("/api/tasks/batch", [makeTask({ id: N1 }), makeTask({ id: N2 })]);
    await act(async () => void (await api.addTasks(["one", "two"])));
    expect(offer()).toBe("Added 2 tasks");
    expect(screen.getByTestId("count").textContent).toBe("5");

    mock.calls.length = 0;
    await act(async () => api.undo());
    expect(mock.calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      `DELETE /api/tasks/${N1}`,
      `DELETE /api/tasks/${N2}`,
    ]);
    expect(screen.getByTestId("count").textContent).toBe("3");
    expect(offer()).toBe("none");
  });
});
