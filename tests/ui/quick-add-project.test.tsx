import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import QuickAdd from "@/components/QuickAdd";
import DashboardTimeline from "@/components/today/DashboardTimeline";
import { emptyWorkspace, makeProject, makeStages, makeTask, renderWorkspace } from "./harness";

describe("quick-add creates a new project", () => {
  test("a task quick-added with a new #project gets its lane without a reload", async () => {
    const view = renderWorkspace(
      <>
        <QuickAdd />
        <DashboardTimeline todayISO="2026-08-14" span={5} />
      </>,
      emptyWorkspace(),
    );

    // Wait for the workspace boot fetches to finish before canning anything.
    await screen.findByPlaceholderText("Add a task. Try: Call printer 20m tomorrow #MSM26");

    const project = makeProject({ id: "44444444-4444-4444-8444-444444444444", name: "ops", color: "#db2777" });
    const task = makeTask({ id: "55555555-5555-4555-8555-555555555555", scheduled: "2026-08-14", projectId: project.id, title: "Client call" });

    view.mock.respondNext("/api/tasks", task, "POST");
    view.mock.respondNext("/api/projects", [project], "GET");
    view.mock.respondNext("/api/stages", makeStages(project.id), "GET");

    await userEvent.type(screen.getByPlaceholderText("Add a task. Try: Call printer 20m tomorrow #MSM26"), "Client call #ops{Enter}");

    expect(await screen.findByText("ops")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Client call" })).toBeInTheDocument();
  });
});
