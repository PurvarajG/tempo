import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import BrainDumpPreview from "@/components/BrainDumpPreview";
import { emptyWorkspace, renderWorkspace } from "./harness";

async function setup() {
  const onAdd = vi.fn();
  const onCancel = vi.fn();
  renderWorkspace(
    <BrainDumpPreview lines={["one", "two 20m", "three"]} onAdd={onAdd} onCancel={onCancel} />,
    emptyWorkspace(),
  );
  await screen.findByText("Add 3 tasks?");
  return { onAdd, onCancel };
}

describe("BrainDumpPreview", () => {
  test("lists each line with its parsed chips", async () => {
    await setup();
    expect(screen.getByText("Add 3 tasks?")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("20m")).toBeInTheDocument();
    expect(screen.getByText("two")).toBeInTheDocument();
  });

  test("Cancel and Add call their handlers", async () => {
    const { onAdd, onCancel } = await setup();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
