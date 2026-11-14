import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import RemoveStageDialog from "@/components/kanban/RemoveStageDialog";
import {
  AddStageDialog,
  RenameStageDialog,
  StageLimitDialog,
} from "@/components/kanban/StageDialogs";
import { emptyWorkspace, makeProject, makeStages, renderWorkspace } from "./harness";

const project = makeProject();
const stages = makeStages(project.id);

describe("AddStageDialog", () => {
  test("Add stays disabled until a name is typed", async () => {
    renderWorkspace(<AddStageDialog open onClose={() => {}} onAdd={() => {}} />);
    const dialog = screen.getByRole("dialog", { name: "Add a lane" });
    expect(within(dialog).getByRole("button", { name: "Add" })).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText("Lane name"), "  ");
    expect(within(dialog).getByRole("button", { name: "Add" })).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText("Lane name"), "QA");
    expect(within(dialog).getByRole("button", { name: "Add" })).toBeEnabled();
  });

  test("autofocuses the name and never offers done", () => {
    renderWorkspace(<AddStageDialog open onClose={() => {}} onAdd={() => {}} />);
    expect(screen.getByLabelText("Lane name")).toHaveFocus();
    const kinds = within(screen.getByLabelText("Behaves as"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(kinds).toEqual(["backlog", "active", "blocked"]);
  });

  test("Enter adds the trimmed name with the chosen kind, then closes", async () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();
    renderWorkspace(<AddStageDialog open onClose={onClose} onAdd={onAdd} />);
    await userEvent.selectOptions(screen.getByLabelText("Behaves as"), "blocked");
    await userEvent.type(screen.getByLabelText("Lane name"), "  Review {Enter}");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onAdd).toHaveBeenCalledWith("Review", "blocked");
  });

  test("Cancel closes without adding", async () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();
    renderWorkspace(<AddStageDialog open onClose={onClose} onAdd={onAdd} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(onAdd).not.toHaveBeenCalled();
  });
});

describe("RenameStageDialog", () => {
  test("prefills, saves the trimmed name and closes", async () => {
    const onRename = vi.fn();
    const onClose = vi.fn();
    renderWorkspace(<RenameStageDialog stage={stages[0]} onClose={onClose} onRename={onRename} />);
    const dialog = screen.getByRole("dialog", { name: 'Rename "Backlog"' });
    const input = within(dialog).getByLabelText("Lane name");
    expect(input).toHaveValue("Backlog");
    await userEvent.clear(input);
    await userEvent.type(input, "  Icebox ");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onRename).toHaveBeenCalledWith("Icebox");
  });

  test("blank or unchanged names are not saved", async () => {
    const onRename = vi.fn();
    const onClose = vi.fn();
    renderWorkspace(<RenameStageDialog stage={stages[0]} onClose={onClose} onRename={onRename} />);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await userEvent.clear(screen.getByLabelText("Lane name"));
    await userEvent.type(screen.getByLabelText("Lane name"), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onRename).not.toHaveBeenCalled();
  });

  test("Escape closes without saving; null stage renders nothing", async () => {
    const onRename = vi.fn();
    const onClose = vi.fn();
    renderWorkspace(
      <RenameStageDialog stage={stages[0]} onClose={onClose} onRename={onRename} />,
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
    expect(onRename).not.toHaveBeenCalled();
  });

  test("closed when stage is null", () => {
    renderWorkspace(<RenameStageDialog stage={null} onClose={() => {}} onRename={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("StageLimitDialog", () => {
  test("describes the open count and prefills the limit", () => {
    renderWorkspace(
      <StageLimitDialog
        stage={{ ...stages[1], wipLimit: 5 }}
        open={3}
        onClose={() => {}}
        onSave={() => {}}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Limit for In Progress" });
    expect(dialog).toHaveAccessibleDescription("3 open cards here. A lower limit starts at 3.");
    expect(within(dialog).getByRole("spinbutton")).toHaveValue(5);
  });

  test("drops the second sentence when the lane is empty", () => {
    renderWorkspace(
      <StageLimitDialog stage={stages[1]} open={0} onClose={() => {}} onSave={() => {}} />,
    );
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription("0 open cards here.");
  });

  test("a limit below the open count saves the open count", async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    renderWorkspace(<StageLimitDialog stage={stages[1]} open={4} onClose={onClose} onSave={onSave} />);
    await userEvent.type(screen.getByRole("spinbutton"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith(4);
  });

  test("a limit above the open count is kept", async () => {
    const onSave = vi.fn();
    renderWorkspace(<StageLimitDialog stage={stages[1]} open={2} onClose={() => {}} onSave={onSave} />);
    await userEvent.type(screen.getByRole("spinbutton"), "6");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(6));
  });

  test("No limit saves null", async () => {
    const onSave = vi.fn();
    renderWorkspace(
      <StageLimitDialog
        stage={{ ...stages[1], wipLimit: 3 }}
        open={1}
        onClose={() => {}}
        onSave={onSave}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "No limit" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(null));
  });
});

describe("RemoveStageDialog", () => {
  const workspace = emptyWorkspace({ projects: [project], stages });
  const siblings = stages.filter((s) => s.id !== stages[0].id);

  test("with tasks it requires a destination before removing", async () => {
    const onRemoved = vi.fn();
    const onClose = vi.fn();
    const { mock } = renderWorkspace(
      <RemoveStageDialog
        stage={stages[0]}
        siblings={siblings}
        taskCount={2}
        onClose={onClose}
        onRemoved={onRemoved}
      />,
      workspace,
    );
    const dialog = await screen.findByRole("dialog", { name: "Remove “Backlog”" });
    expect(within(dialog).getByText("2 tasks need a new column first.")).toBeInTheDocument();
    const remove = within(dialog).getByRole("button", { name: "Remove column" });
    expect(remove).toBeDisabled();
    await userEvent.selectOptions(within(dialog).getByLabelText("Move tasks to"), siblings[0].id);
    expect(remove).toBeEnabled();
    await userEvent.click(remove);
    await waitFor(() => expect(onRemoved).toHaveBeenCalledWith("Backlog column removed."));
    expect(onClose).toHaveBeenCalled();
    expect(mock.calls.some((c) => c.method === "DELETE" && c.url.includes(`moveTo=${siblings[0].id}`))).toBe(
      true,
    );
  });

  test("an empty lane removes without a destination", async () => {
    const onRemoved = vi.fn();
    renderWorkspace(
      <RemoveStageDialog
        stage={stages[2]}
        siblings={stages.filter((s) => s.id !== stages[2].id)}
        taskCount={0}
        onClose={() => {}}
        onRemoved={onRemoved}
      />,
      workspace,
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("This column is empty.")).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Move tasks to")).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove column" }));
    await waitFor(() => expect(onRemoved).toHaveBeenCalledWith("Blocked column removed."));
  });

  test("with no siblings Remove is disabled and says why", async () => {
    renderWorkspace(
      <RemoveStageDialog
        stage={stages[0]}
        siblings={[]}
        taskCount={0}
        onClose={() => {}}
        onRemoved={() => {}}
      />,
      workspace,
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("A board needs at least one lane.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Remove column" })).toBeDisabled();
  });

  test("Cancel and Escape close", async () => {
    const onClose = vi.fn();
    renderWorkspace(
      <RemoveStageDialog
        stage={stages[0]}
        siblings={siblings}
        taskCount={0}
        onClose={onClose}
        onRemoved={() => {}}
      />,
      workspace,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
