import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import BoardCard from "@/components/board/BoardCard";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";
import type { Task } from "@/lib/types";

const TODAY = "2026-11-13";
const TASK_ID = "11111111-1111-4111-8111-111111111111";

const entry = (extra: object) => ({
  id: "e1",
  taskId: TASK_ID,
  categoryId: "c",
  startedAt: "2026-11-13T09:00:00.000Z",
  createdAt: "2026-11-13T09:00:00.000Z",
  updatedAt: "2026-11-13T09:00:00.000Z",
  ...extra,
});

function renderCard(
  overrides: Partial<Task> = {},
  opts: { entries?: object[]; running?: object | null; actions?: React.ReactNode; dimmed?: boolean } = {},
) {
  const task = makeTask({ scheduled: "2026-11-13", ...overrides });
  return renderWorkspace(
    <ul>
      <BoardCard task={task} todayISO={TODAY} actions={opts.actions} dimmed={opts.dimmed} />
    </ul>,
    emptyWorkspace({
      tasks: [task],
      timeEntries: (opts.entries ?? []) as never,
      running: (opts.running ?? null) as never,
    }),
  );
}

describe("BoardCard", () => {
  test("title h3 uses the card-title token", async () => {
    const { container } = renderCard();
    await screen.findByText("Write the plan");
    expect(container.querySelector("h3")?.className).toContain("text-card-title");
  });

  test("priority pill only when priority > 0 and open", async () => {
    const a = renderCard({ priority: 1 });
    expect(await screen.findByText("High")).toBeInTheDocument();
    a.unmount();
    const b = renderCard();
    await screen.findByText("Write the plan");
    expect(screen.queryByText("High")).toBeNull();
    expect(screen.queryByText("Medium")).toBeNull();
    b.unmount();
    renderCard({ priority: 1, status: "done", completedAt: `${TODAY}T10:00:00.000Z` });
    await screen.findByText("Done today");
    expect(screen.queryByText("High")).toBeNull();
  });

  test("title button opens the task", async () => {
    renderCard();
    await userEvent.click(await screen.findByRole("button", { name: "Write the plan" }));
    expect(screen.getByRole("button", { name: "Write the plan" })).toBeInTheDocument();
  });

  test("untracked card shows the estimate and Not started", async () => {
    renderCard({ minutes: 120 });
    expect(await screen.findByText("2h")).toBeInTheDocument();
    expect(screen.getByText("Estimate")).toBeInTheDocument();
    expect(screen.getByText("Not started")).toBeInTheDocument();
  });

  test("tracked card shows Nm tracked", async () => {
    renderCard({ minutes: 60 }, { entries: [entry({ endedAt: "2026-11-13T09:30:00.000Z", minutes: 30 })] });
    expect(await screen.findByText("30m tracked")).toBeInTheDocument();
    expect(screen.queryByTestId("card-progress")).toBeNull();
  });

  test("only the running card draws the progress bar", async () => {
    renderCard({ minutes: 90 }, { running: entry({}) });
    await screen.findByText("Running");
    expect(screen.getByTestId("card-progress").className).toContain("h-1");
  });

  test("the running task shows Running and the Tracked of form", async () => {
    renderCard({ minutes: 90 }, { running: entry({}) });
    expect(await screen.findByText("Running")).toBeInTheDocument();
    expect(screen.getByText(/^Tracked/)).toBeInTheDocument();
    expect(screen.queryByText("Not started")).toBeNull();
  });

  test("a done card is struck and says when", async () => {
    renderCard({ status: "done", completedAt: `${TODAY}T10:00:00.000Z` });
    const title = await screen.findByRole("button", { name: "Write the plan" });
    expect(title.className).toContain("line-through");
    expect(title.className).toContain("text-ink-3");
    expect(screen.getByText("Done today")).toBeInTheDocument();
  });

  test("an overdue open card is carried over, with an icon", async () => {
    renderCard({ scheduled: "2026-11-10" });
    const item = await screen.findByText("Carried over");
    expect(item.querySelector("svg")).not.toBeNull();
    expect(screen.queryByText(/overdue/i)).toBeNull();
  });

  test("undated task says No date; subtasks and tags show", async () => {
    renderCard({
      scheduled: null,
      tags: ["Venue"],
      subtasks: [
        { id: "s1", title: "a", done: true },
        { id: "s2", title: "b", done: false },
      ] as never,
    });
    expect(await screen.findByText("No date")).toBeInTheDocument();
    expect(screen.getByText("1/2 subtasks")).toBeInTheDocument();
    expect(screen.getByText("Venue").className).toContain("rounded-full");
  });

  test("actions slot renders, hidden until hover", async () => {
    renderCard({}, { actions: <button>Do it</button> });
    const btn = await screen.findByRole("button", { name: "Do it" });
    expect(btn.parentElement?.className).toContain("opacity-0");
    expect(btn.parentElement?.className).toContain("group-hover:opacity-100");
  });

  test("no actions wrapper without actions; dimmed adds opacity-60", async () => {
    const { container } = renderCard({}, { dimmed: true });
    await screen.findByText("Write the plan");
    expect(container.querySelector(".opacity-0")).toBeNull();
    expect(container.querySelector("li")?.className).toContain("opacity-60");
  });
});
