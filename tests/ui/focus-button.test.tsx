import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { FocusButton } from "@/components/TimerButton";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

const task = makeTask({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", title: "Write the plan", minutes: 30 });
const props = { id: task.id, title: task.title, minutes: 30 };

describe("FocusButton", () => {
  test("renders a button named for the task with the word Focus", async () => {
    renderWorkspace(<FocusButton task={props} />, emptyWorkspace({ tasks: [task] }));
    const btn = await screen.findByRole("button", { name: "Focus on Write the plan" });
    expect(btn).toHaveTextContent("Focus");
  });

  test("clicking with nothing running starts a time entry", async () => {
    const { mock } = renderWorkspace(<FocusButton task={props} />, emptyWorkspace({ tasks: [task] }));
    await userEvent.click(await screen.findByRole("button", { name: "Focus on Write the plan" }));
    await waitFor(() =>
      expect(mock.calls.some((c) => c.url === "/api/time-entries" && c.method === "POST")).toBe(true),
    );
  });

  test("ghost variant carries no accent fill", async () => {
    renderWorkspace(<FocusButton task={props} variant="ghost" />, emptyWorkspace({ tasks: [task] }));
    const btn = await screen.findByRole("button", { name: "Focus on Write the plan" });
    expect(btn.className).not.toMatch(/bg-accent/);
  });

  test("renders nothing once a focus session runs on the task", async () => {
    const { mock } = renderWorkspace(<FocusButton task={props} />, emptyWorkspace({ tasks: [task] }));
    mock.respondNext(
      "/api/time-entries",
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        taskId: task.id,
        categoryId: "00000000-0000-0000-0000-000000000002",
        startedAt: new Date().toISOString(),
        createdAt: "2026-03-01T09:00:00.000Z",
        updatedAt: "2026-03-01T09:00:00.000Z",
      },
      "POST",
    );
    await userEvent.click(await screen.findByRole("button", { name: "Focus on Write the plan" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Focus on Write the plan" })).not.toBeInTheDocument(),
    );
  });
});
