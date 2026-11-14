import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import Column from "@/components/kanban/Column";
import type { ProjectStage } from "@/lib/types";
import { emptyWorkspace, makeProject, makeStages, makeTask, renderWorkspace } from "./harness";

const TODAY = "2026-03-01";
const project = makeProject();
const stages = makeStages(project.id);
const [backlog, active, , done] = stages;

const rect = (r: Partial<DOMRect>): DOMRect =>
  ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => {}, ...r }) as DOMRect;

function taskIn(stage: ProjectStage, n: number, extra = {}) {
  return makeTask({
    id: `5555555${n}-5555-4555-8555-555555555555`,
    title: `Task ${n}`,
    projectId: project.id,
    stageId: stage.id,
    boardOrder: n,
    ...extra,
  });
}

function lane(stage: ProjectStage, tasks: ReturnType<typeof taskIn>[], props: Record<string, unknown> = {}) {
  return renderWorkspace(
    <Column
      stage={stage}
      stages={stages}
      tasks={tasks}
      todayISO={TODAY}
      projectId={project.id}
      dragTaskId={null}
      dropIndex={null}
      cardProps={() => ({ draggable: false })}
      columnProps={() => ({})}
      onMove={() => {}}
      {...props}
    />,
    emptyWorkspace({ tasks, projects: [project], stages }),
  );
}

describe("kanban lane", () => {
  beforeEach(() => {
    Element.prototype.getBoundingClientRect = vi.fn(function (this: Element) {
      if (this.hasAttribute("data-picker-menu")) return rect({ height: 120, width: 180 });
      if (this.getAttribute("aria-haspopup") === "menu") return rect({ top: 100, bottom: 136, left: 20, right: 100, width: 80, height: 36 });
      return rect({});
    }) as unknown as typeof Element.prototype.getBoundingClientRect;
  });

  test("header shows the name and the count", async () => {
    lane(backlog, [taskIn(backlog, 1), taskIn(backlog, 2)]);
    const h = await screen.findByRole("heading", { level: 2 });
    expect(h).toHaveTextContent("Backlog");
    expect(h).toHaveTextContent("2");
    expect(screen.getByRole("region", { name: "Backlog, 2 tasks" })).toBeInTheDocument();
  });

  test("a limit shows n/limit and turns med when over", async () => {
    const limited = { ...active, wipLimit: 3 };
    lane(limited, [taskIn(limited, 1), taskIn(limited, 2), taskIn(limited, 3), taskIn(limited, 4)]);
    const count = await screen.findByText(/\d\/3/);
    expect(count.className).toContain("text-med");
  });

  test("done lane shows 2 cards and Show 3 more reveals the rest", async () => {
    const tasks = [1, 2, 3, 4, 5].map((n) => taskIn(done, n, { status: "done" }));
    lane(done, tasks);
    expect(await screen.findByText("Task 1")).toBeInTheDocument();
    expect(screen.getByText("Task 2")).toBeInTheDocument();
    expect(screen.queryByText("Task 3")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Show 3 more" }));
    expect(screen.getByText("Task 5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show less" })).toBeInTheDocument();
  });

  test("the add input creates a task in this stage", async () => {
    const { mock } = lane(active, []);
    await userEvent.click(await screen.findByRole("button", { name: "Add a task to In Progress" }));
    await userEvent.type(screen.getByPlaceholderText("What needs doing?"), "Ship it{Enter}");
    await waitFor(() => {
      const post = mock.calls.find((c) => c.method === "POST" && c.url.includes("/api/tasks"));
      expect(post).toBeTruthy();
      expect(JSON.stringify(post)).toContain(active.id);
    });
  });

  test("a lane has no options menu, only the add button", async () => {
    lane(active, []);
    await screen.findByRole("button", { name: "Add a task to In Progress" });
    expect(screen.queryByRole("button", { name: "In Progress lane options" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /lane options/ })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("⋯");
  });

  test("an empty lane says so", async () => {
    lane(active, []);
    expect(await screen.findByText("Nothing here yet.")).toBeInTheDocument();
  });
});
