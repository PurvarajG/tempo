import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import WrapDone from "@/components/wrap/WrapDone";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

const A = makeTask({ id: "aaaaaaaa-1111-4111-8111-111111111111", title: "Book van", minutes: 15, status: "done" });
const B = makeTask({ id: "bbbbbbbb-1111-4111-8111-111111111111", title: "Pay tax", minutes: 90, status: "done" });
const LINE = "A steady day, and the venue call is done.";

describe("WrapDone", () => {
  test("header label, count and focused total, no calm line", () => {
    renderWorkspace(<WrapDone tasks={[A, B]} focusedMinutes={220} />, emptyWorkspace({ tasks: [A, B] }));
    expect(screen.getByRole("heading", { name: "Done today" })).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3h 40m focused")).toBeInTheDocument();
    expect(screen.queryByText(LINE)).toBeNull();
  });

  test("rows are visible and struck through", () => {
    renderWorkspace(<WrapDone tasks={[A]} focusedMinutes={20} />, emptyWorkspace({ tasks: [A] }));
    expect(screen.getByText("Book van")).toHaveClass("line-through");
    expect(screen.getByText("15m")).toBeInTheDocument();
  });

  test("checkbox reopens the task", async () => {
    const { mock } = renderWorkspace(
      <WrapDone tasks={[A]} focusedMinutes={20} />,
      emptyWorkspace({ tasks: [A] }),
    );
    const box = screen.getByRole("checkbox", { name: "Reopen Book van" });
    expect(box).toHaveAttribute("aria-checked", "true");
    fireEvent.click(box);
    await waitFor(() => expect(mock.calls.some((c) => c.url === `/api/tasks/${A.id}/reopen`)).toBe(true));
  });

  test("empty still renders the card header, no line", () => {
    renderWorkspace(<WrapDone tasks={[]} focusedMinutes={0} />);
    expect(screen.getByRole("heading", { name: "Done today" })).toBeInTheDocument();
    expect(screen.queryByText(LINE)).toBeNull();
    expect(screen.getByText("0m focused")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
