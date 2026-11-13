import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import ProjectPage from "@/app/projects/[id]/page";
import { emptyWorkspace, makeProject, makeStages, makeTask, renderWorkspace } from "./harness";

const replace = vi.fn();
let query = "";
let routeId = "22222222-2222-4222-8222-222222222222";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: routeId }),
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(query),
}));

const project = makeProject({ name: "  website" });
const stages = makeStages(project.id);

function mount() {
  renderWorkspace(
    <ProjectPage />,
    emptyWorkspace({
      projects: [project],
      stages,
      tasks: [
        makeTask({ id: "a", title: "First", projectId: project.id, stageId: stages[0].id }),
        makeTask({ id: "b", title: "Second", projectId: project.id, stageId: stages[1].id }),
      ],
    }),
  );
}

describe("project page", () => {
  beforeEach(() => {
    replace.mockClear();
    query = "";
    routeId = project.id;
  });

  test("head: letter logo, name, and one sentence", async () => {
    mount();
    const h1 = await screen.findByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("website");
    const logo = screen.getByText("W");
    expect(logo.className).toContain("size-10");
    expect(logo.className).toContain("text-logo");
    expect(screen.getByText("2 open tasks across 4 lanes.")).toBeInTheDocument();
  });

  test("opens on Board, and List sets ?view=list", async () => {
    mount();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByRole("radio", { name: "Board" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("region", { name: "Backlog, 1 task" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "List" }));
    expect(replace).toHaveBeenCalledWith(`/projects/${project.id}?view=list`, { scroll: false });
  });

  test("?view=list shows the list, and Board clears the param", async () => {
    query = "view=list";
    mount();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByRole("radio", { name: "List" })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("region", { name: "Backlog, 1 task" })).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Board" }));
    expect(replace).toHaveBeenCalledWith(`/projects/${project.id}`, { scroll: false });
  });

  test("Settings opens the panel", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
    expect(await screen.findByText("Project settings")).toBeInTheDocument();
  });

  test("summary card sits between the head and the board", async () => {
    mount();
    expect(await screen.findByText("Project momentum")).toBeInTheDocument();
  });

  test("unknown project shows Project not found.", async () => {
    routeId = "missing";
    mount();
    expect(await screen.findByText("Project not found.")).toBeInTheDocument();
  });
});
