import { useEffect, useState, type ReactNode } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import TrashPage from "@/app/trash/page";
import Icon from "@/components/ui/Icon";
import UndoBar from "@/components/ui/UndoBar";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

vi.mock("next/navigation", () => ({
  usePathname: () => "/trash",
  useRouter: () => ({ push: vi.fn() }),
}));

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

// The harness mock only exists after render, so the page mounts once the trash response is canned.
let openGate: () => void = () => {};
function Gate({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    openGate = () => setOpen(true);
  }, []);
  return open ? <>{children}</> : null;
}

function setup(trash: unknown[]) {
  const confirm = vi.spyOn(window, "confirm");
  const view = renderWorkspace(
    <>
      <Gate>
        <TrashPage />
      </Gate>
      <UndoBar />
    </>,
    emptyWorkspace(),
  );
  view.mock.respondWith("/api/tasks/trash", trash);
  act(() => openGate());
  return { ...view, confirm };
}

afterEach(() => vi.restoreAllMocks());

describe("Trash page", () => {
  it("lists trashed tasks in one card without checkboxes", async () => {
    const { confirm } = setup([
      makeTask({ id: A, title: "Old draft", status: "trashed" as never }),
      makeTask({ id: B, title: "Stale note", status: "trashed" as never }),
    ]);
    expect(await screen.findByText("Old draft")).toBeTruthy();
    expect(screen.getByText("2 tasks in the trash.")).toBeTruthy();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.getAllByRole("button", { name: "Restore" })).toHaveLength(2);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("keeps Restore and Delete forever in the hover cluster, hidden at rest", async () => {
    setup([makeTask({ id: A, title: "Old draft", status: "trashed" as never })]);
    await screen.findByText("Old draft");
    const row = document.querySelector(`li[data-task-id="${A}"]`) as HTMLElement;
    expect(within(row).queryByRole("checkbox")).toBeNull();
    const cluster = within(row).getByTestId("row-hover-cluster");
    expect(within(cluster).getByRole("button", { name: "Restore" })).toBeTruthy();
    expect(within(cluster).getByRole("button", { name: "Delete forever" })).toBeTruthy();
    // At rest: out of flow (absolute, reserves no width), transparent, not clickable.
    expect(cluster.className).toContain("absolute");
    expect(cluster.className).toContain("[opacity:0]");
    expect(cluster.className).toContain("pointer-events-none");
    expect(cluster.className).toContain("group-hover:[opacity:1]");
  });

  it("draws the trash glyph in the card header tile", async () => {
    setup([makeTask({ id: A, title: "Old draft" })]);
    await screen.findByText("Old draft");
    const tile = document.querySelector("span.size-7");
    expect(tile).not.toBeNull();
    const { container: ref, unmount } = render(<Icon name="trash" size={16} />);
    const trashMarkup = ref.querySelector("svg")?.innerHTML;
    unmount();
    expect(trashMarkup).toBeTruthy();
    expect(tile?.querySelector("svg")?.innerHTML).toBe(trashMarkup);
  });

  it("restores a task and shows the undo bar", async () => {
    const user = userEvent.setup();
    const { mock } = setup([makeTask({ id: A, title: "Old draft" })]);
    await screen.findByText("Old draft");
    await user.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(screen.queryByText("Old draft")).toBeNull());
    expect(mock.calls.some((c) => c.url === `/api/tasks/${A}/restore` && c.method === "POST")).toBe(true);
    expect(await screen.findByText("Restored")).toBeTruthy();
    expect(screen.getAllByText("Nothing in the trash.")).toHaveLength(2);
  });

  it("deletes forever only after the dialog is confirmed", async () => {
    const user = userEvent.setup();
    const { mock, confirm } = setup([makeTask({ id: A, title: "Old draft" })]);
    await screen.findByText("Old draft");
    await user.click(screen.getByRole("button", { name: "Delete forever" }));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("“Old draft”", { exact: false })).toBeTruthy();
    expect(within(dialog).getByText("This cannot be undone.")).toBeTruthy();
    expect(mock.calls.some((c) => c.method === "DELETE")).toBe(false);

    await user.click(within(dialog).getByRole("button", { name: "Delete forever" }));
    await waitFor(() => expect(screen.queryByText("Old draft")).toBeNull());
    expect(mock.calls.some((c) => c.url === `/api/tasks/${A}/forever` && c.method === "DELETE")).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("keeps the row when the dialog is cancelled", async () => {
    const user = userEvent.setup();
    const { mock } = setup([makeTask({ id: A, title: "Old draft" })]);
    await screen.findByText("Old draft");
    await user.click(screen.getByRole("button", { name: "Delete forever" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByText("Old draft")).toBeTruthy();
    expect(mock.calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("shows the empty state", async () => {
    setup([]);
    expect(await screen.findAllByText("Nothing in the trash.")).toHaveLength(2);
  });
});
