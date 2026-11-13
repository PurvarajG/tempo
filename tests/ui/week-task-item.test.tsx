import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import WeekTaskItem from "@/components/week/WeekTaskItem";
import { useTasks } from "@/lib/store-context";
import { emptyWorkspace, makeProject, makeTask, renderWorkspace } from "./harness";

const PID = "22222222-2222-4222-8222-222222222222";

function OpenProbe() {
  const { openTaskId } = useTasks();
  return <output data-testid="open">{openTaskId ?? ""}</output>;
}

function setup(task = makeTask({ title: "Book van", minutes: 90 }), withProject = false) {
  return renderWorkspace(
    <>
      <ul>
        <WeekTaskItem task={task} />
      </ul>
      <OpenProbe />
    </>,
    emptyWorkspace({ tasks: [task], projects: withProject ? [makeProject({ id: PID, color: "#0052ff" })] : [] }),
  );
}

describe("WeekTaskItem", () => {
  it("renders title and estimate", async () => {
    setup();
    expect(await screen.findByText("Book van")).toBeTruthy();
    expect(screen.getByText("1h 30m")).toBeTruthy();
  });

  it("omits the estimate for 0 minutes", async () => {
    setup(makeTask({ title: "Quick", minutes: 0 }));
    await screen.findByText("Quick");
    expect(document.querySelector("li .font-mono")).toBeNull();
  });

  it("checkbox is named and completes the task", async () => {
    const task = makeTask({ title: "Book van" });
    const { mock } = setup(task);
    mock.respondWith("/complete", { task: { ...task, status: "done" }, next: null });
    await userEvent.click(await screen.findByRole("checkbox", { name: "Mark done: Book van" }));
    await waitFor(() => expect(mock.calls.some((c) => c.url.includes("/complete"))).toBe(true));
  });

  it("clicking the title opens the task", async () => {
    const task = makeTask({ title: "Book van" });
    setup(task);
    await userEvent.click(await screen.findByRole("button", { name: "Book van" }));
    expect(screen.getByTestId("open").textContent).toBe(task.id);
  });

  it("dot is an 8px square with the pdot radius", async () => {
    setup();
    await screen.findByText("Book van");
    const dot = screen.getByTestId("week-task-dot");
    expect(dot.className).toContain("rounded-pdot");
    expect(dot.className).toContain("size-2");
  });

  it("dot carries the project colour var", async () => {
    setup(makeTask({ title: "Book van", projectId: PID }), true);
    await screen.findByText("Book van");
    await waitFor(() =>
      expect((screen.getByTestId("week-task-dot") as HTMLElement).style.background).toContain("var(--color-project-1)"),
    );
  });

  it("title button never collapses", async () => {
    setup();
    const btn = await screen.findByRole("button", { name: "Book van" });
    expect(btn.className).toContain("min-w-0");
    expect(btn.className).toContain("flex-1");
  });
});
