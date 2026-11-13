import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { LaneAddButton, LaneAddInput } from "@/components/board/LaneAdd";
import { emptyWorkspace, renderWorkspace } from "./harness";

describe("lane add", () => {
  test("the button is named for the lane and calls onClick", async () => {
    const onClick = vi.fn();
    renderWorkspace(<LaneAddButton lane="To do" onClick={onClick} />, emptyWorkspace());
    await userEvent.click(await screen.findByRole("button", { name: "Add task to To do" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("Enter adds a task with the lane's scheduled date and the input stays open", async () => {
    const { mock } = renderWorkspace(
      <ul>
        <LaneAddInput lane="To do" scheduled="2026-11-20" onClose={() => {}} />
      </ul>,
      emptyWorkspace(),
    );
    const input = await screen.findByRole("textbox", { name: "New task for To do" });
    await userEvent.type(input, "Ship it{Enter}");
    await waitFor(() => {
      const post = mock.calls.find((c) => c.method === "POST" && c.url.includes("/api/tasks"));
      expect(post).toBeTruthy();
      expect(JSON.stringify(post)).toContain("2026-11-20");
    });
    expect(input).toHaveValue("");
    expect(input).toBeInTheDocument();
  });

  test("blur calls onClose", async () => {
    const onClose = vi.fn();
    renderWorkspace(
      <ul>
        <LaneAddInput lane="To do" scheduled="2026-11-20" onClose={onClose} />
      </ul>,
      emptyWorkspace(),
    );
    await screen.findByRole("textbox", { name: "New task for To do" });
    await userEvent.tab();
    expect(onClose).toHaveBeenCalled();
  });
});
