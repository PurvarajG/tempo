import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import Board from "@/components/kanban/Board";
import ErrorToast from "@/components/ErrorToast";
import { emptyWorkspace, makeProject, makeStages, makeTask, renderWorkspace } from "./harness";

const project = makeProject();
const stages = makeStages(project.id);

function board(tasks = [makeTask({ projectId: project.id, stageId: stages[0].id })]) {
  return {
    tasks,
    workspace: emptyWorkspace({ tasks, projects: [project], stages }),
  };
}

function Surface() {
  return (
    <>
      <Board project={project} todayISO="2026-03-01" />
      <ErrorToast />
    </>
  );
}

const rect = (r: Partial<DOMRect>): DOMRect =>
  ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => {}, ...r }) as DOMRect;

describe("project kanban board", () => {
  // jsdom has no layout; menus stay hidden until they can measure themselves.
  beforeEach(() => {
    Element.prototype.getBoundingClientRect = vi.fn(function (this: Element) {
      if (this.hasAttribute("data-picker-menu")) return rect({ height: 120, width: 180 });
      if (this.getAttribute("aria-haspopup") === "menu") return rect({ top: 100, bottom: 136, left: 20, right: 100, width: 80, height: 36 });
      return rect({});
    }) as unknown as typeof Element.prototype.getBoundingClientRect;
  });

  test("renders every column with its task count", async () => {
    const { workspace } = board();
    renderWorkspace(<Surface />, workspace);

    expect(await screen.findByRole("region", { name: "Backlog, 1 task" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "In Progress, 0 tasks" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Done, 0 tasks" })).toBeInTheDocument();
  });

  test("a card moves between columns from the keyboard, and the move is announced", async () => {
    const { tasks, workspace } = board();
    const { mock } = renderWorkspace(<Surface />, workspace);

    await userEvent.click(
      await screen.findByRole("button", { name: "Move Write the plan to another column" }),
    );
    await userEvent.click(await screen.findByRole("menuitem", { name: "Move to In Progress" }));

    await waitFor(() => {
      expect(mock.calls).toContainEqual({
        url: `/api/tasks/${tasks[0].id}/move`,
        method: "POST",
        body: { stageId: stages[1].id, index: 0 },
      });
    });
    expect(screen.getByText("Write the plan moved to In Progress.")).toBeInTheDocument();
  });

  test("a failed move puts the card back and shows why", async () => {
    const { workspace } = board();
    const { mock } = renderWorkspace(<Surface />, workspace);
    mock.failNext("/move", 400, "That column belongs to a different project");

    await userEvent.click(
      await screen.findByRole("button", { name: "Move Write the plan to another column" }),
    );
    await userEvent.click(await screen.findByRole("menuitem", { name: "Move to Blocked" }));

    expect(
      await screen.findByText("That column belongs to a different project"),
    ).toBeInTheDocument();
    // Rolled back: the card is in Backlog again, and Blocked is empty.
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Backlog, 1 task" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("region", { name: "Blocked, 0 tasks" })).toBeInTheDocument();
  });

  test("lanes have no options menu: no rename, limit, reorder or remove", async () => {
    const { workspace } = board();
    renderWorkspace(<Surface />, workspace);

    await screen.findByRole("region", { name: "Blocked, 0 tasks" });
    expect(screen.queryByRole("button", { name: /lane options/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
  });

  test("a new column can't be created as a second done column", async () => {
    const { workspace } = board();
    renderWorkspace(<Surface />, workspace);

    await userEvent.click(await screen.findByRole("button", { name: "Add lane" }));

    const kinds = within(screen.getByLabelText("Behaves as"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(kinds).toEqual(["backlog", "active", "blocked"]);
  });

  test("carried-over cards say \"Carried over\" in words, not only in colour", async () => {
    const { workspace } = board([
      makeTask({ projectId: project.id, stageId: stages[0].id, scheduled: "2026-02-20" }),
    ]);
    renderWorkspace(<Surface />, workspace);

    expect(await screen.findByText("Carried over")).toBeInTheDocument();
  });

  test("a complex task shows its full range instead of a single date", async () => {
    const { workspace } = board([
      makeTask({
        projectId: project.id,
        stageId: stages[0].id,
        isComplex: true,
        scheduled: "2026-03-01",
        finishDate: "2026-03-05",
      }),
    ]);
    renderWorkspace(<Surface />, workspace);

    expect(await screen.findByText("1 to 5 Mar")).toBeInTheDocument();
  });

  test("a complex task is overdue only once its finish date passes", async () => {
    const { workspace } = board([
      makeTask({
        projectId: project.id,
        stageId: stages[0].id,
        isComplex: true,
        scheduled: "2026-02-25",
        finishDate: "2026-03-05",
      }),
    ]);
    renderWorkspace(<Surface />, workspace);

    // todayISO is 2026-03-01: the range's start has passed but its finish
    // hasn't, so this open-started task isn't overdue.
    expect(await screen.findByText("25 Feb to 5 Mar")).toBeInTheDocument();
    expect(screen.queryByText("Carried over")).not.toBeInTheDocument();
  });

  test("a lane with a limit shows open/limit and a drop over the limit still lands", async () => {
    const tasks = [
      makeTask({ projectId: project.id, stageId: stages[0].id }),
      makeTask({
        id: "77777777-7777-4777-8777-777777777777",
        title: "Second",
        projectId: project.id,
        stageId: stages[1].id,
        boardOrder: 1,
      }),
    ];
    const limited = stages.map((s) => (s.id === stages[1].id ? { ...s, wipLimit: 1 } : s));
    const { mock } = renderWorkspace(
      <Surface />,
      emptyWorkspace({ tasks, projects: [project], stages: limited }),
    );

    expect(await screen.findByText("1/1")).toBeInTheDocument();
    await userEvent.click(
      await screen.findByRole("button", { name: "Move Write the plan to another column" }),
    );
    await userEvent.click(await screen.findByRole("menuitem", { name: "Move to In Progress" }));

    await waitFor(() => {
      expect(mock.calls).toContainEqual({
        url: `/api/tasks/${tasks[0].id}/move`,
        method: "POST",
        body: { stageId: stages[1].id, index: 0 },
      });
    });
  });

  test("the board has no sideways fade when nothing overflows", async () => {
    const { workspace } = board();
    const { container } = renderWorkspace(<Surface />, workspace);
    await screen.findByRole("region", { name: "Backlog, 1 task" });
    const scroller = container.querySelector(".board-scroll");
    expect(scroller).not.toBeNull();
    expect(scroller).not.toHaveAttribute("data-fade");
  });

  test("an Add lane tile adds a lane and announces it", async () => {
    const { workspace } = board();
    const { mock } = renderWorkspace(<Surface />, workspace);

    await userEvent.click(await screen.findByRole("button", { name: "Add lane" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a lane" });
    await userEvent.type(within(dialog).getByLabelText("Lane name"), "Review");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add" }));

    await waitFor(() => expect(screen.getByText("Review column added.")).toBeInTheDocument());
    expect(mock.calls.some((c) => c.method === "POST" && c.url.includes("stages"))).toBe(true);
  });

  test("the lane track sizes to its lanes and Add lane sits right after it", async () => {
    const { workspace } = board();
    renderWorkspace(<Surface />, workspace);

    const add = await screen.findByRole("button", { name: "Add lane" });
    const track = add.previousElementSibling as HTMLElement;
    expect(track).toContainElement(screen.getByRole("region", { name: "Backlog, 1 task" }));
    expect(track.className).not.toContain("min-w-0");
    const row = add.parentElement as HTMLElement;
    expect(row.className).not.toContain("w-max");
    expect(row.className).toContain("min-w-full");
  });
});
