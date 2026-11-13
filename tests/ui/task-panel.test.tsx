import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import TaskPanel from "@/components/TaskPanel";
import TaskRow from "@/components/TaskRow";
import ErrorToast from "@/components/ErrorToast";
import { emptyWorkspace, makeProject, makeStages, makeTask, renderWorkspace } from "./harness";

function surface() {
  const project = makeProject();
  const stages = makeStages(project.id);
  const task = makeTask({ projectId: project.id, stageId: stages[0].id });

  return {
    project,
    stages,
    task,
    workspace: emptyWorkspace({ tasks: [task], projects: [project], stages }),
  };
}

/** A list row, the panel, and the toast — the pairing AppChrome mounts. */
function Surface({ task }: { task: ReturnType<typeof makeTask> }) {
  return (
    <ul>
      <TaskRow task={task} todayISO="2026-03-01" />
      <TaskPanel />
      <ErrorToast />
    </ul>
  );
}

describe("shared task detail panel", () => {
  test("opens from a task row and shows the task's current values", async () => {
    const { task, workspace } = surface();
    renderWorkspace(<Surface task={task} />, workspace);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "Write the plan" }));

    const dialog = await screen.findByRole("dialog", { name: "Task" });
    expect(within(dialog).getByLabelText("Title")).toHaveValue("Write the plan");
    expect(within(dialog).getByLabelText("Project")).toHaveValue(workspace.projects[0].id);
    expect(within(dialog).getByLabelText("Column")).toHaveValue(workspace.stages[0].id);
  });

  test("saves an edited title on blur", async () => {
    const { task, workspace } = surface();
    const { mock } = renderWorkspace(<Surface task={task} />, workspace);

    await userEvent.click(await screen.findByRole("button", { name: "Write the plan" }));
    const title = await screen.findByLabelText("Title");

    await userEvent.clear(title);
    await userEvent.type(title, "Write the better plan");
    expect(mock.calls).toHaveLength(0);

    await userEvent.tab();
    await waitFor(() => {
      expect(mock.calls).toContainEqual({
        url: `/api/tasks/${task.id}`,
        method: "PATCH",
        body: { title: "Write the better plan" },
      });
    });
  });

  test("a failed edit rolls back and surfaces the server's message", async () => {
    const { task, workspace } = surface();
    const { mock } = renderWorkspace(<Surface task={task} />, workspace);

    await userEvent.click(await screen.findByRole("button", { name: "Write the plan" }));
    mock.failNext(`/api/tasks/${task.id}`, 400, "A task needs a title");

    const notes = await screen.findByLabelText("Notes");
    await userEvent.type(notes, "Some notes");
    await userEvent.tab();

    expect(await screen.findByText("A task needs a title")).toBeInTheDocument();
    // The row still shows the pre-edit task, because the patch was reverted.
    await waitFor(() => expect(screen.getByLabelText("Notes")).toHaveValue(""));
  });

  test("changing project clears the column when the project is removed", async () => {
    const { task, workspace } = surface();
    const { mock } = renderWorkspace(<Surface task={task} />, workspace);

    await userEvent.click(await screen.findByRole("button", { name: "Write the plan" }));
    await userEvent.selectOptions(await screen.findByLabelText("Project"), "");

    await waitFor(() => {
      expect(mock.calls).toContainEqual({
        url: `/api/tasks/${task.id}`,
        method: "PATCH",
        body: { projectId: "" },
      });
    });
    await waitFor(() => expect(screen.queryByLabelText("Column")).not.toBeInTheDocument());
  });

  test("Escape closes the panel and focus returns to the row that opened it", async () => {
    const { task, workspace } = surface();
    renderWorkspace(<Surface task={task} />, workspace);

    const trigger = await screen.findByRole("button", { name: "Write the plan" });
    await userEvent.click(trigger);
    await screen.findByRole("dialog", { name: "Task" });

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  test("Tab is trapped inside the open panel", async () => {
    const { task, workspace } = surface();
    renderWorkspace(<Surface task={task} />, workspace);

    await userEvent.click(await screen.findByRole("button", { name: "Write the plan" }));
    const dialog = await screen.findByRole("dialog", { name: "Task" });

    for (let i = 0; i < 30; i++) await userEvent.tab();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  async function openPanel(overrides: Partial<ReturnType<typeof makeTask>> = {}, withProject = true) {
    const base = surface();
    const task = withProject ? { ...base.task, ...overrides } : makeTask(overrides);
    const other = makeTask({ id: "44444444-4444-4444-8444-444444444444", title: "Order the paint" });
    const workspace = emptyWorkspace({
      tasks: [task, other],
      projects: [base.project],
      stages: base.stages,
    });
    const { mock } = renderWorkspace(<Surface task={task} />, workspace);
    await userEvent.click(await screen.findByRole("button", { name: task.title }));
    const dialog = await screen.findByRole("dialog", { name: "Task" });
    return { dialog, mock, task };
  }

  test("fields follow the agreed order", async () => {
    const { dialog } = await openPanel();
    const els = [
      within(dialog).getByLabelText("Title"),
      within(dialog).getByRole("region", { name: "Start and tracked time" }),
      within(dialog).getByLabelText("Date"),
      within(dialog).getByLabelText("Estimate"),
      within(dialog).getByRole("radiogroup", { name: "Priority" }),
      within(dialog).getByLabelText("Project"),
      within(dialog).getByLabelText("Notes"),
      within(dialog).getByText("Subtasks"),
      within(dialog).getByRole("button", { name: "More" }),
    ];
    for (let i = 1; i < els.length; i++) {
      expect(els[i - 1].compareDocumentPosition(els[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  test("Column is hidden when there is no project", async () => {
    const { dialog } = await openPanel({}, false);
    expect(within(dialog).queryByLabelText("Column")).not.toBeInTheDocument();
  });

  test("footer has Mark done and Move to trash", async () => {
    const { dialog } = await openPanel();
    expect(within(dialog).getByRole("button", { name: "Mark done" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Move to trash" })).toBeInTheDocument();
  });

  test("Repeat from 'when I finish it' patches recurrence.from", async () => {
    const { dialog, mock, task } = await openPanel({ recurrence: { freq: "weekly", interval: 1 } });
    await userEvent.click(within(dialog).getByRole("radio", { name: "when I finish it" }));
    await waitFor(() =>
      expect(mock.calls).toContainEqual({
        url: `/api/tasks/${task.id}`,
        method: "PATCH",
        body: { recurrence: { freq: "weekly", interval: 1, from: "done" } },
      }),
    );
  });

  test("Hide until and Expires patch startOn and expiresOn", async () => {
    const { dialog, mock, task } = await openPanel();
    await userEvent.click(within(dialog).getByRole("button", { name: "More" }));
    fireEvent.change(within(dialog).getByLabelText("Hide until"), { target: { value: "2026-03-05" } });
    fireEvent.change(within(dialog).getByLabelText("Expires"), { target: { value: "2026-03-09" } });
    await waitFor(() => {
      expect(mock.calls).toContainEqual({
        url: `/api/tasks/${task.id}`,
        method: "PATCH",
        body: { startOn: "2026-03-05" },
      });
      expect(mock.calls).toContainEqual({
        url: `/api/tasks/${task.id}`,
        method: "PATCH",
        body: { expiresOn: "2026-03-09" },
      });
    });
  });

  test("Blocked by searches open tasks and links the pick", async () => {
    const { dialog, mock, task } = await openPanel();
    await userEvent.click(within(dialog).getByRole("button", { name: "More" }));
    await userEvent.type(within(dialog).getByLabelText("Blocked by"), "paint");
    await userEvent.click(await within(dialog).findByRole("button", { name: "Order the paint" }));
    await waitFor(() =>
      expect(mock.calls).toContainEqual({
        url: `/api/tasks/${task.id}/links`,
        method: "POST",
        body: { blockerId: "44444444-4444-4444-8444-444444444444" },
      }),
    );
  });
});
