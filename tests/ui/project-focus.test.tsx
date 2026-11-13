import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import ProjectPage from "@/app/projects/[id]/page";
import { useTasks } from "@/lib/store-context";
import { toISODate } from "@/lib/parse";
import { shiftDays } from "@/lib/summary";
import { emptyWorkspace, makeProject, makeStages, makeTask, renderWorkspace } from "./harness";

const project = makeProject();
const stages = makeStages(project.id);

// The page derives todayISO from `new Date()`, so fixtures follow the real clock.
const TODAY = toISODate(new Date());
const OVERDUE = shiftDays(TODAY, -9);
const FUTURE = shiftDays(TODAY, 30);

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "22222222-2222-4222-8222-222222222222" }),
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

function Probe() {
  const { openTaskId } = useTasks();
  return <output data-testid="open">{openTaskId ?? "none"}</output>;
}

function mount(ws: Parameters<typeof emptyWorkspace>[0]) {
  return renderWorkspace(
    <>
      <ProjectPage />
      <Probe />
    </>,
    emptyWorkspace({ projects: [project], stages, ...ws }),
  );
}

// Mark done and Start used to live on the focus card. They are now reached
// from the board card's timer button and from the task panel (click a card).
describe("project page, what replaced the focus band", () => {
  test("a carried-over task says so on its card and counts in the summary's Open tasks note", async () => {
    mount({
      tasks: [
        makeTask({ id: "task-late", title: "Confirm moving inventory", projectId: project.id, stageId: stages[1].id, scheduled: OVERDUE }),
        makeTask({ id: "task-later", title: "Not due yet", projectId: project.id, stageId: stages[1].id, scheduled: FUTURE }),
      ],
    });

    await screen.findByText("Confirm moving inventory");
    expect(screen.getAllByText("Carried over")).toHaveLength(1);
    expect(screen.getByText("1 carried over")).toBeInTheDocument();
    expect(screen.queryByText("Needs attention")).toBeNull();
  });

  test("a task 15 days in an active lane is in the Gone quiet line and opens on click", async () => {
    const entered = new Date();
    entered.setDate(entered.getDate() - 15);
    mount({
      tasks: [
        makeTask({
          id: "task-quiet",
          title: "Ganesh interludes",
          projectId: project.id,
          stageId: stages[1].id,
          scheduled: FUTURE,
          stageEnteredAt: entered.toISOString(),
        }),
      ],
    });

    const line = (await screen.findByText(/Gone quiet:/)).closest("p") as HTMLElement;
    fireEvent.click(within(line).getByRole("button", { name: "Ganesh interludes" }));
    expect(screen.getByTestId("open")).toHaveTextContent("task-quiet");
  });

  test("no Gone quiet line when nothing has sat for two weeks", async () => {
    mount({
      tasks: [
        makeTask({ id: "task-fine", title: "Fresh", projectId: project.id, stageId: stages[1].id, scheduled: FUTURE, stageEnteredAt: new Date().toISOString() }),
      ],
    });
    await screen.findByText("Fresh");
    expect(screen.queryByText(/Gone quiet:/)).toBeNull();
    expect(screen.queryByText("Current focus")).toBeNull();
  });

  test("the running task's card says Running", async () => {
    const stamp = `${TODAY}T09:00:00.000Z`;
    mount({
      tasks: [
        makeTask({ id: "task-running", title: "Timed right now", projectId: project.id, stageId: stages[1].id, scheduled: FUTURE }),
      ],
      running: { id: "entry-1", taskId: "task-running", categoryId: "cat", startedAt: stamp, createdAt: stamp, updatedAt: stamp },
    });

    await screen.findByText("Timed right now");
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.queryByText("Timing now")).toBeNull();
  });

  test("the board, its columns, and their counts still render", async () => {
    mount({
      tasks: [makeTask({ id: "task-board", projectId: project.id, stageId: stages[0].id, scheduled: TODAY })],
    });

    expect(await screen.findByRole("region", { name: "Backlog, 1 task" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "In Progress, 0 tasks" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Blocked, 0 tasks" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Done, 0 tasks" })).toBeInTheDocument();
  });
});
