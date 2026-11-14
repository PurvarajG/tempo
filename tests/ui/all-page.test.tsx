import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AllPage from "@/app/all/page";
import { addDays, toISODate } from "@/lib/parse";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

vi.mock("next/navigation", () => ({
  usePathname: () => "/all",
  useRouter: () => ({ push: vi.fn() }),
}));

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const D = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const today = toISODate(new Date());

describe("All tasks page", () => {
  it("lists open tasks in sortOrder and leaves out done ones", async () => {
    renderWorkspace(
      <AllPage />,
      emptyWorkspace({
        tasks: [
          makeTask({ id: A, title: "Second task", sortOrder: 2, scheduled: today }),
          makeTask({ id: B, title: "First task", sortOrder: 1, scheduled: today }),
          makeTask({ id: C, title: "Finished task", sortOrder: 0, status: "done" }),
        ],
      }),
    );
    expect(await screen.findByText("First task")).toBeTruthy();
    expect(screen.queryByText("Finished task")).toBeNull();
    const first = screen.getByText("First task");
    const second = screen.getByText("Second task");
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("heading", { name: "All tasks", level: 1 })).toBeTruthy();
    expect(screen.getByText("2 open tasks. Drag to set your own order.")).toBeTruthy();
  });

  it("keeps a hidden-until task in the list, dimmed", async () => {
    renderWorkspace(
      <AllPage />,
      emptyWorkspace({
        tasks: [
          makeTask({ id: A, title: "Visible one", sortOrder: 1, scheduled: today }),
          makeTask({ id: D, title: "Later one", sortOrder: 2, scheduled: null, startOn: addDays(today, 5) }),
        ],
      }),
    );
    const later = await screen.findByText("Later one");
    expect(later.closest(".opacity-60")).toBeTruthy();
    expect(screen.getByText("Visible one").closest(".opacity-60")).toBeNull();
  });

  it("shows an empty state once ready", async () => {
    renderWorkspace(<AllPage />, emptyWorkspace());
    expect(await screen.findByText("Add a task above, or check Next 7 days.")).toBeTruthy();
    expect(screen.getAllByText("Nothing open.").length).toBeGreaterThan(0);
  });

  it("gives the composer the quick add id", async () => {
    renderWorkspace(<AllPage />, emptyWorkspace());
    await screen.findByText("Add a task above, or check Next 7 days.");
    expect(document.getElementById("doem-quick-add")).toBeTruthy();
  });
});
