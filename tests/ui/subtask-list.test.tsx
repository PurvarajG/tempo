import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import SubtaskList from "@/components/SubtaskList";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";
import type { Task } from "@/lib/types";

function sub(id: string, title: string, sortOrder: number, done = false) {
  return { id, title, done, sortOrder } as Task["subtasks"][number];
}

function setup(variant?: "panel" | "inline", subtasks: Task["subtasks"] = []) {
  const task = makeTask({ subtasks });
  const r = renderWorkspace(<SubtaskList task={task} variant={variant} />, emptyWorkspace({ tasks: [task] }));
  return { task, ...r };
}

describe("SubtaskList", () => {
  test("renders in sortOrder ascending, not array order", () => {
    setup("panel", [sub("a", "Third", 3), sub("b", "First", 1), sub("c", "Second", 2)]);
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items[0]).toContain("First");
    expect(items[1]).toContain("Second");
    expect(items[2]).toContain("Third");
  });

  test("panel shows done-of-total count; inline has no heading", () => {
    const subs = [sub("a", "One", 1, true), sub("b", "Two", 2)];
    const { unmount } = setup("panel", subs);
    expect(screen.getByRole("heading", { name: /Subtasks 1\/2/ })).toBeInTheDocument();
    unmount();
    setup("inline", subs);
    expect(screen.queryByRole("heading")).toBeNull();
  });

  test("panel heading has no count with no subtasks", () => {
    setup("panel");
    expect(screen.getByRole("heading", { name: "Subtasks" })).toBeInTheDocument();
  });

  test("Enter adds, clears the field, keeps focus; blanks are ignored", async () => {
    const { mock } = setup("inline");
    const field = screen.getByPlaceholderText("Add subtask") as HTMLInputElement;
    field.focus();
    fireEvent.change(field, { target: { value: "   " } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(mock.calls.filter((c) => c.url.includes("/subtasks"))).toHaveLength(0);

    fireEvent.change(field, { target: { value: "Buy milk" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(field.value).toBe("");
    expect(field).toHaveFocus();
    await waitFor(() =>
      expect(mock.calls.some((c) => c.method === "POST" && c.url.includes("/subtasks"))).toBe(true),
    );
  });

  test("delete button carries its aria label and sends DELETE", async () => {
    const { mock } = setup("panel", [sub("a", "Pack", 1)]);
    fireEvent.click(screen.getByRole("button", { name: "Delete Pack" }));
    await waitFor(() => expect(mock.calls.some((c) => c.method === "DELETE")).toBe(true));
  });

  test("toggle sends the request and labels follow state", async () => {
    const { mock } = setup("panel", [sub("a", "Pack", 1), sub("b", "Ship", 2, true)]);
    expect(screen.getByRole("checkbox", { name: "Reopen Ship" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Complete Pack" }));
    await waitFor(() =>
      expect(mock.calls.some((c) => c.method === "PATCH" && c.url.includes("/subtasks/a"))).toBe(true),
    );
    const call = mock.calls.find((c) => c.url.includes("/subtasks/a"));
    expect(call?.body).toMatchObject({ done: true });
    expect(within(screen.getAllByRole("listitem")[1]).getByText("Ship")).toHaveClass("line-through");
  });
});
