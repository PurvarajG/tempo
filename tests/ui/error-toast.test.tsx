import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import ErrorToast from "@/components/ErrorToast";
import { useTasks } from "@/lib/store-context";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

const task = makeTask();

/** Triggers a real failing save through the store, so the toast is fed by the actual error path. */
function Probe() {
  const { patchTask } = useTasks();
  return (
    <button onClick={() => void patchTask(task.id, { title: "Renamed" })}>Trigger save</button>
  );
}

function Surface() {
  return (
    <>
      <Probe />
      <ErrorToast />
    </>
  );
}

describe("ErrorToast", () => {
  test("renders nothing while there is no error", () => {
    renderWorkspace(<Surface />, emptyWorkspace({ tasks: [task] }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  test("shows the server's message in a polite status region", async () => {
    const { mock } = renderWorkspace(<Surface />, emptyWorkspace({ tasks: [task] }));
    mock.failNext(`/api/tasks/${task.id}`, 400, "A task needs a title");

    await userEvent.click(screen.getByRole("button", { name: "Trigger save" }));

    const status = await screen.findByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("A task needs a title");
  });

  test("Dismiss clears the message", async () => {
    const { mock } = renderWorkspace(<Surface />, emptyWorkspace({ tasks: [task] }));
    mock.failNext(`/api/tasks/${task.id}`, 400, "A task needs a title");

    await userEvent.click(screen.getByRole("button", { name: "Trigger save" }));
    await screen.findByRole("status");
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  test("is not fixed-positioned, so the feedback stack can place it", async () => {
    const { mock } = renderWorkspace(<Surface />, emptyWorkspace({ tasks: [task] }));
    mock.failNext(`/api/tasks/${task.id}`, 400, "A task needs a title");

    await userEvent.click(screen.getByRole("button", { name: "Trigger save" }));
    const status = await screen.findByRole("status");
    expect(status.className).not.toContain("fixed");
    expect(status.className).toContain("pointer-events-auto");
  });
});
