import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import Card from "@/components/kanban/Card";
import { emptyWorkspace, makeProject, makeStages, makeTask, renderWorkspace } from "./harness";
import type { Task } from "@/lib/types";

const TODAY = "2026-11-13";
const project = makeProject();
const stages = makeStages(project.id);

const rect = (r: Partial<DOMRect>): DOMRect =>
  ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => {}, ...r }) as DOMRect;

const entry = (taskId: string, extra: object) => ({
  id: "e1",
  taskId,
  categoryId: "c",
  startedAt: "2026-11-13T09:00:00.000Z",
  createdAt: "2026-11-13T09:00:00.000Z",
  updatedAt: "2026-11-13T09:00:00.000Z",
  ...extra,
});

function renderCard(
  overrides: Partial<Task> = {},
  opts: { onMove?: (id: string) => void; entries?: object[]; running?: object | null } = {},
) {
  const task = makeTask({ scheduled: "2026-11-13", projectId: project.id, stageId: stages[1].id, ...overrides });
  return renderWorkspace(
    <ul>
      <Card
        task={task}
        stages={stages}
        todayISO={TODAY}
        dragging={false}
        dragProps={{ draggable: true }}
        onMoveToStage={opts.onMove ?? (() => {})}
        laneKind="active"
      />
    </ul>,
    emptyWorkspace({
      tasks: [task],
      projects: [project],
      stages,
      timeEntries: (opts.entries ?? []) as never,
      running: (opts.running ?? null) as never,
    }),
  );
}

describe("kanban Card", () => {
  beforeEach(() => {
    Element.prototype.getBoundingClientRect = vi.fn(function (this: Element) {
      if (this.hasAttribute("data-picker-menu")) return rect({ height: 120, width: 180 });
      if (this.getAttribute("aria-haspopup") === "menu") return rect({ top: 100, bottom: 136, left: 20, right: 100, width: 80, height: 36 });
      return rect({});
    }) as unknown as typeof Element.prototype.getBoundingClientRect;
  });

  test("the card title h3 uses the card-title type token, not body text", async () => {
    const { container } = renderCard();
    await screen.findByText("Write the plan");
    const heading = container.querySelector("h3");
    expect(heading).not.toBeNull();
    expect(heading?.className).toContain("text-card-title");
    expect(heading?.className).not.toContain("text-body");
  });

  test("priority shows as a word pill, not P-text", async () => {
    renderCard({ priority: 1 });
    expect(await screen.findByText("High")).toBeInTheDocument();
    expect(screen.queryByText("P1")).toBeNull();
  });

  test("no priority pill when priority is none", async () => {
    renderCard();
    await screen.findByText("Write the plan");
    expect(screen.queryByText("High")).toBeNull();
    expect(screen.queryByText("Medium")).toBeNull();
  });

  test("an overdue open card is quietly carried over, never Overdue", async () => {
    renderCard({ scheduled: "2026-11-10" });
    expect(await screen.findByText("Carried over")).toBeInTheDocument();
    expect(screen.queryByText(/overdue/i)).toBeNull();
  });

  test("No date, Carried over and the done text each sit beside an icon", async () => {
    const a = renderCard({ scheduled: null });
    expect((await screen.findByText("No date")).querySelector("svg")).not.toBeNull();
    a.unmount();
    const b = renderCard({ scheduled: "2026-11-10" });
    expect((await screen.findByText("Carried over")).querySelector("svg")).not.toBeNull();
    b.unmount();
    renderCard({ status: "done", completedAt: `${TODAY}T10:00:00.000Z` });
    expect((await screen.findByText("Done today")).querySelector("svg")).not.toBeNull();
  });

  test("a complex task shows its range", async () => {
    renderCard({ isComplex: true, scheduled: "2026-11-13", finishDate: "2026-11-19" });
    expect(await screen.findByText("13 to 19 Nov")).toBeInTheDocument();
  });

  test("an undated task says No date", async () => {
    renderCard({ scheduled: null });
    expect(await screen.findByText("No date")).toBeInTheDocument();
  });

  test("due time is appended to the date", async () => {
    renderCard({ dueTime: "14:00" });
    expect(await screen.findByText(/, 14:00$/)).toBeInTheDocument();
  });

  test("subtask progress is shown", async () => {
    renderCard({
      subtasks: [
        { id: "s1", title: "a", done: true },
        { id: "s2", title: "b", done: false },
      ] as never,
    });
    expect(await screen.findByText("1/2 subtasks")).toBeInTheDocument();
  });

  test("tags render as pills", async () => {
    renderCard({ tags: ["Venue", "Tech"] });
    const pill = await screen.findByText("Venue");
    expect(pill.className).toContain("rounded-full");
    expect(screen.getByText("Tech")).toBeInTheDocument();
  });

  test("untracked card shows the estimate and Not started", async () => {
    renderCard({ minutes: 120 });
    expect(await screen.findByText("2h")).toBeInTheDocument();
    expect(screen.getByText("Estimate")).toBeInTheDocument();
    expect(screen.getByText("Not started")).toBeInTheDocument();
  });

  test("a tracked card that is not running shows the total and no progress bar", async () => {
    renderCard({ minutes: 60 }, { entries: [entry("11111111-1111-4111-8111-111111111111", { endedAt: "2026-11-13T09:30:00.000Z", minutes: 30 })] });
    expect(await screen.findByText("30m tracked")).toBeInTheDocument();
    expect(screen.queryByTestId("card-progress")).toBeNull();
  });

  test("the running card draws the progress bar", async () => {
    renderCard(
      { minutes: 60 },
      {
        entries: [entry("11111111-1111-4111-8111-111111111111", { endedAt: "2026-11-13T09:30:00.000Z", minutes: 30 })],
        running: entry("11111111-1111-4111-8111-111111111111", { id: "e2" }),
      },
    );
    expect(await screen.findByTestId("card-progress")).toBeInTheDocument();
  });

  test("the running task shows Running", async () => {
    renderCard({}, { running: entry("11111111-1111-4111-8111-111111111111", {}) });
    expect(await screen.findByText("Running")).toBeInTheDocument();
    expect(screen.queryByText("Not started")).toBeNull();
  });

  test("time in the stage shows as Nd here", async () => {
    const entered = new Date(2026, 10, 9, 12).toISOString();
    renderCard({ stageEnteredAt: entered });
    expect(await screen.findByText("4d here")).toBeInTheDocument();
  });

  test("a hidden-until card is dimmed and shows its start date", async () => {
    const { container } = renderCard({ startOn: "2026-11-20", scheduled: "2026-11-20" });
    expect(await screen.findByText("From Fri 20 Nov")).toBeInTheDocument();
    expect(container.querySelector("li")?.className).toContain("opacity-60");
  });

  test("a done card keeps the strike-through and says when", async () => {
    renderCard({ status: "done", completedAt: `${TODAY}T10:00:00.000Z` });
    const title = await screen.findByRole("button", { name: "Write the plan" });
    expect(title.className).toContain("line-through");
    expect(screen.getByText("Done today")).toBeInTheDocument();
  });

  test("the move menu lists stages, disables the current one, and moves", async () => {
    const onMove = vi.fn();
    renderCard({}, { onMove });
    await userEvent.click(await screen.findByRole("button", { name: "Move Write the plan to another column" }));
    expect(await screen.findByRole("menuitem", { name: "In Progress (here)" })).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(await screen.findByRole("menuitem", { name: "Move to Backlog" }));
    expect(onMove).toHaveBeenCalledWith(stages[0].id);
  });

  test("clicking the title opens the task", async () => {
    renderCard();
    await userEvent.click(await screen.findByRole("button", { name: "Write the plan" }));
    expect(screen.getByRole("button", { name: "Write the plan" })).toBeInTheDocument();
  });
});
