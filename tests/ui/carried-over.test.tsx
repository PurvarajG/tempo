import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CarriedOver from "@/components/today/CarriedOver";
import { useTasks } from "@/lib/store-context";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TODAY = "2026-03-10";

const tA = makeTask({ id: A, title: "Recent one", scheduled: "2026-03-08" });
const tB = makeTask({ id: B, title: "Old one", scheduled: "2026-03-01" });

function Host({ tasks }: { tasks: ReturnType<typeof makeTask>[] }) {
  const { openTaskId } = useTasks();
  return (
    <>
      <span data-testid="open">{openTaskId ?? "none"}</span>
      <CarriedOver tasks={tasks} todayISO={TODAY} />
    </>
  );
}

const setup = (tasks = [tA, tB]) => renderWorkspace(<Host tasks={tasks} />, emptyWorkspace({ tasks }));
const expand = () => fireEvent.click(screen.getByRole("button", { name: /Carried over, \d+/ }));

describe("CarriedOver", () => {
  it("renders nothing for no tasks", () => {
    const { container } = setup([]);
    expect(container.querySelector("#carried-over")).toBeNull();
  });

  it("is collapsed by default and expands", () => {
    setup();
    const toggle = screen.getByRole("button", { name: "Carried over, 2" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Recent one")).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Recent one")).toBeTruthy();
  });

  it("Move all buttons are absent while collapsed", () => {
    setup();
    expect(screen.queryByRole("button", { name: "Move all to today" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Move all to tomorrow" })).toBeNull();
    expand();
    expect(screen.getByRole("button", { name: "Move all to today" })).toBeTruthy();
  });

  it("bulk buttons send one request with all ids", async () => {
    const { mock } = setup();
    expand();
    mock.respondWith("/api/tasks/reschedule", [tA, tB]);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Move all to today" })));
    await waitFor(() => expect(mock.calls).toHaveLength(1));
    expect(mock.calls[0].body).toEqual({ ids: [A, B], day: TODAY });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Move all to tomorrow" })));
    await waitFor(() => expect(mock.calls).toHaveLength(2));
    expect(mock.calls[1].body).toEqual({ ids: [A, B], day: "2026-03-11" });
  });

  it("per-row Today, Tomorrow and Trash", async () => {
    const { mock } = setup([tA]);
    mock.respondWith("/api/tasks/reschedule", [tA]);
    expand();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Today" })));
    await waitFor(() => expect(mock.calls).toHaveLength(1));
    expect(mock.calls[0].body).toEqual({ ids: [A], day: TODAY });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Tomorrow" })));
    await waitFor(() => expect(mock.calls).toHaveLength(2));
    expect(mock.calls[1].body).toEqual({ ids: [A], day: "2026-03-11" });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Move to trash" })));
    await waitFor(() => expect(mock.calls.some((c) => c.url.includes(`/api/tasks/${A}`))).toBe(true));
  });

  it("title opens the task", async () => {
    setup([tA]);
    expand();
    fireEvent.click(screen.getByRole("button", { name: "Recent one" }));
    await waitFor(() => expect(screen.getByTestId("open").textContent).toBe(A));
  });

  it("shows the stale prompt only with a 7+ day task and moves only those to the inbox", async () => {
    const recent = setup([tA]);
    expand();
    expect(screen.queryByText(/a week or more/)).toBeNull();
    recent.unmount();

    const { mock } = setup();
    mock.respondWith("/api/tasks/reschedule", [tB]);
    expand();
    expect(screen.getByText("Some of these have been carried over for a week or more.")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Move them to the inbox" })));
    await waitFor(() => expect(mock.calls).toHaveLength(1));
    expect(mock.calls[0].body).toEqual({ ids: [B], day: null });
  });

  it("never says Overdue or days", () => {
    const { container } = setup();
    expand();
    expect(container.textContent).not.toMatch(/overdue|\bdays?\b|\bd waiting\b/i);
  });
});
