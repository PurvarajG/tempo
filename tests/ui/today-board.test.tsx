import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import Today from "@/components/Today";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

let query = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(query),
}));

vi.mock("@/lib/useNow", async () => {
  const React = await import("react");
  return { useNow: () => React.useMemo(() => new Date(), []) };
});

beforeEach(() => {
  query = "";
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-08-14T12:00:00"));
});
afterEach(() => vi.useRealTimers());

const id = (n: number) => `aaaaaaaa-${n}${n}${n}${n}-4${n}${n}${n}-8${n}${n}${n}-${String(n).repeat(12)}`;

function tasks() {
  const done = (n: number) =>
    makeTask({ id: id(n), title: `Done ${n}`, status: "done", completedAt: "2026-08-14T09:00:00", scheduled: "2026-08-14" });
  return [
    makeTask({ id: id(1), title: "Old chore", scheduled: "2026-08-10" }),
    makeTask({ id: id(2), title: "Today thing", scheduled: "2026-08-14", committedOn: "2026-08-14" }),
    makeTask({ id: id(3), title: "Running thing", scheduled: "2026-08-14", committedOn: "2026-08-14" }),
    done(4),
    done(5),
    done(6),
  ];
}

const lane = (name: RegExp) => screen.getByRole("region", { name });

describe("Today Board tab", () => {
  test("renders four lanes with the right tasks and counts", async () => {
    renderWorkspace(<Today />, emptyWorkspace({ tasks: tasks() }));
    await userEvent.click(await screen.findByRole("radio", { name: "Board" }));

    expect(within(lane(/^Carried over, 1 task/)).getByText("Old chore")).toBeInTheDocument();
    expect(within(lane(/^To do, 2 tasks/)).getByText("Today thing")).toBeInTheDocument();
    expect(lane(/^In progress, 0 tasks/)).toBeInTheDocument();
    expect(lane(/^Done, 3 tasks/)).toBeInTheDocument();
  });

  test("the running task sits in In progress, not To do", async () => {
    const ws = emptyWorkspace({ tasks: tasks() });
    ws.running = {
      id: "e1",
      taskId: id(3),
      categoryId: "c1",
      startedAt: "2026-08-14T11:00:00.000Z",
      createdAt: "2026-08-14T11:00:00.000Z",
      updatedAt: "2026-08-14T11:00:00.000Z",
    };
    renderWorkspace(<Today />, ws);
    await userEvent.click(await screen.findByRole("radio", { name: "Board" }));

    const inProgress = await screen.findByRole("region", { name: /^In progress, 1 task/ });
    expect(within(inProgress).getByText("Running thing")).toBeInTheDocument();
    expect(within(lane(/^To do/)).queryByText("Running thing")).not.toBeInTheDocument();
  });

  test("Done shows two cards and a Show N more button", async () => {
    renderWorkspace(<Today />, emptyWorkspace({ tasks: tasks() }));
    await userEvent.click(await screen.findByRole("radio", { name: "Board" }));

    const done = lane(/^Done/);
    expect(within(done).getAllByRole("listitem")).toHaveLength(3); // 2 cards + ghost button item
    await userEvent.click(within(done).getByRole("button", { name: "Show 1 more" }));
    expect(within(done).getByRole("button", { name: "Show less" })).toBeInTheDocument();
  });

  test("?view=board opens Board; bare / opens List", async () => {
    query = "view=board";
    const first = renderWorkspace(<Today />, emptyWorkspace({ tasks: tasks() }));
    expect(await screen.findByTestId("today-board")).toBeInTheDocument();
    first.unmount();

    query = "";
    renderWorkspace(<Today />, emptyWorkspace({ tasks: tasks() }));
    await screen.findByTestId("today-primary-pane");
    expect(screen.queryByTestId("today-board")).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "List" })).toBeChecked();
  });

  test("only To do has a header plus", async () => {
    renderWorkspace(<Today />, emptyWorkspace({ tasks: tasks() }));
    await userEvent.click(await screen.findByRole("radio", { name: "Board" }));

    expect(screen.getByRole("button", { name: "Add task to To do" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add task to Carried over" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add task to In progress" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add task to Done" })).toBeNull();
  });

  test("the plus opens an input; Enter adds a task scheduled today", async () => {
    const { mock } = renderWorkspace(<Today />, emptyWorkspace({ tasks: tasks() }));
    await userEvent.click(await screen.findByRole("radio", { name: "Board" }));
    await userEvent.click(screen.getByRole("button", { name: "Add task to To do" }));

    const input = within(lane(/^To do/)).getByPlaceholderText("What needs doing?");
    await userEvent.type(input, "Ship it{Enter}");
    await waitFor(() => {
      const post = mock.calls.find((c) => c.method === "POST" && c.url.includes("/api/tasks"));
      expect(post).toBeTruthy();
      expect(JSON.stringify(post)).toContain("2026-08-14");
    });
  });
});
