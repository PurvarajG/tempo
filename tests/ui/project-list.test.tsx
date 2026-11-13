import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import ProjectList from "@/components/kanban/ProjectList";
import { emptyWorkspace, makeProject, makeStages, makeTask, renderWorkspace } from "./harness";

const project = makeProject();
const stages = makeStages(project.id);
const id = (n: number) => `aaaaaaa${n}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`;

function mount(tasks: ReturnType<typeof makeTask>[]) {
  return renderWorkspace(
    <ProjectList project={project} todayISO="2026-03-01" />,
    emptyWorkspace({ tasks, projects: [project], stages }),
  );
}

describe("project list view", () => {
  test("one card per stage with its name and count", async () => {
    mount([
      makeTask({ id: id(1), title: "One", projectId: project.id, stageId: stages[0].id }),
      makeTask({ id: id(2), title: "Two", projectId: project.id, stageId: stages[0].id }),
    ]);
    const backlog = await screen.findByRole("region", { name: /Backlog/ });
    expect(within(backlog).getByText("2")).toBeInTheDocument();
    expect(screen.getAllByRole("region")).toHaveLength(4);
    expect(screen.getByRole("heading", { name: "In Progress" })).toBeInTheDocument();
  });

  test("rows follow boardOrder and trashed tasks are absent", async () => {
    mount([
      makeTask({ id: id(1), title: "Second", boardOrder: 2, projectId: project.id, stageId: stages[0].id }),
      makeTask({ id: id(2), title: "First", boardOrder: 1, projectId: project.id, stageId: stages[0].id }),
      makeTask({ id: id(3), title: "Gone", status: "trashed", projectId: project.id, stageId: stages[0].id }),
    ]);
    await screen.findByText("First");
    expect(screen.queryByText("Gone")).toBeNull();
    const titles = screen.getAllByRole("button", { name: /^(First|Second)$/ }).map((b) => b.textContent);
    expect(titles).toEqual(["First", "Second"]);
  });

  test("done stage shows 2 rows and Show N more reveals the rest", async () => {
    mount(
      [1, 2, 3, 4].map((n) =>
        makeTask({ id: id(n), title: `Done ${n}`, status: "done", boardOrder: n, projectId: project.id, stageId: stages[3].id }),
      ),
    );
    await screen.findByText("Done 1");
    expect(screen.queryByText("Done 3")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Show 2 more" }));
    expect(screen.getByText("Done 4")).toBeInTheDocument();
  });

  test("an empty stage says so", async () => {
    mount([]);
    expect((await screen.findAllByText("Nothing here yet.")).length).toBe(4);
  });
});
