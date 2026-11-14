import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import DoneToday from "@/components/today/DoneToday";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

const A = makeTask({ id: "aaaaaaaa-1111-4111-8111-111111111111", title: "Book van", minutes: 15, status: "done" });
const B = makeTask({ id: "bbbbbbbb-1111-4111-8111-111111111111", title: "Pay tax", minutes: 90, status: "done" });

describe("DoneToday", () => {
  test("is open with a header line, not a toggle", () => {
    renderWorkspace(<DoneToday tasks={[A]} />, emptyWorkspace({ tasks: [A] }));
    expect(screen.queryByRole("button", { name: /Done today/ })).not.toBeInTheDocument();
    expect(screen.getByText("Done today, 1")).toBeInTheDocument();
    expect(screen.getByText("Book van")).toBeInTheDocument();
  });

  test("shows count and total", () => {
    renderWorkspace(<DoneToday tasks={[A, B]} />, emptyWorkspace({ tasks: [A, B] }));
    expect(screen.getByText("Done today, 2")).toBeInTheDocument();
    expect(screen.getByText("1h 45m")).toBeInTheDocument();
    expect(screen.getByText("Book van")).toBeInTheDocument();
  });

  test("title is struck through", () => {
    renderWorkspace(<DoneToday tasks={[A]} />, emptyWorkspace({ tasks: [A] }));
    expect(screen.getByText("Book van")).toHaveClass("line-through");
  });

  test("checkbox reopens the task", async () => {
    const { mock } = renderWorkspace(<DoneToday tasks={[A]} />, emptyWorkspace({ tasks: [A] }));
    const box = screen.getByRole("checkbox", { name: "Reopen Book van" });
    expect(box).toHaveAttribute("aria-checked", "true");
    fireEvent.click(box);
    await waitFor(() => expect(mock.calls.some((c) => c.url === `/api/tasks/${A.id}/reopen`)).toBe(true));
  });

  test("renders nothing when empty", () => {
    const { container } = renderWorkspace(<DoneToday tasks={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
