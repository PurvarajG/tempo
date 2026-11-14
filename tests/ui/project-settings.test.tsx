import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import ProjectSettings from "@/components/ProjectSettings";
import { emptyWorkspace, makeProject, makeTask, renderWorkspace } from "./harness";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const project = makeProject();

function setup(project_ = project, tasks = [makeTask({ projectId: project_.id })]) {
  const onClose = vi.fn();
  const r = renderWorkspace(
    <ProjectSettings project={project_} onClose={onClose} />,
    emptyWorkspace({ projects: [project_], tasks }),
  );
  return { ...r, onClose };
}

describe("ProjectSettings", () => {
  test("rename saves the trimmed name; blank is ignored", async () => {
    const { mock } = setup();
    const input = await screen.findByLabelText("Name");
    await userEvent.clear(input);
    await userEvent.type(input, "  Shop  ");
    await userEvent.tab();
    await waitFor(() => expect(mock.calls.some((c) => c.method === "PATCH" && (c.body as { name?: string }).name === "Shop")).toBe(true));

    const before = mock.calls.length;
    await userEvent.clear(input);
    await userEvent.type(input, "   ");
    await userEvent.tab();
    expect(mock.calls.length).toBe(before);
  });

  test("colour swatch reports aria-pressed and saves the choice", async () => {
    const { mock } = setup();
    const selected = await screen.findByRole("button", { name: /Use colour #0052ff/ });
    expect(selected).toHaveAttribute("aria-pressed", "true");
    const other = screen.getByRole("button", { name: /Use colour #7c3aed/ });
    expect(other).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(other);
    await waitFor(() =>
      expect(mock.calls.some((c) => (c.body as { color?: string })?.color === "#7c3aed")).toBe(true),
    );
  });

  test("archived switch flips", async () => {
    const { mock } = setup();
    const sw = await screen.findByRole("switch", { name: "Archived" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    await userEvent.click(sw);
    await waitFor(() =>
      expect(mock.calls.some((c) => (c.body as { archived?: boolean })?.archived === true)).toBe(true),
    );
  });

  test("delete asks in a dialog; Cancel keeps the project", async () => {
    const { mock, onClose } = setup();
    await userEvent.click(await screen.findByRole("button", { name: "Delete this project" }));
    const dialog = screen.getByRole("alertdialog", { name: "Delete Website?" });
    expect(dialog).toHaveAccessibleDescription(/1 task keeps existing/);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(mock.calls.some((c) => c.method === "DELETE")).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  test("confirming deletes, closes and routes to /all", async () => {
    push.mockClear();
    const { mock, onClose } = setup();
    await userEvent.click(await screen.findByRole("button", { name: "Delete this project" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, delete Website" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/all"));
    expect(mock.calls.some((c) => c.method === "DELETE" && c.url.includes(project.id))).toBe(true);
    expect(onClose).toHaveBeenCalled();
  });
});
