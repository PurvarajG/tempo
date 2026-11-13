import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import RecordsModule from "@/components/tracking/modules/RecordsModule";
import { useTasks } from "@/lib/store-context";
import type { Segment } from "@/lib/types";
import { emptyWorkspace, makeCategory, makeProject, makeTask, renderWorkspace, type MockFetch } from "./harness";

const TODAY = "2026-03-01";
const NOW = new Date(2026, 2, 1, 14, 0);
const at = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo - 1, d, h, mi).toISOString();

const rect = (r: Partial<DOMRect>): DOMRect =>
  ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => {}, ...r }) as DOMRect;

const categories = [
  makeCategory({ id: "cat-1", name: "Focus Work" }),
  makeCategory({ id: "cat-2", name: "Admin" }),
];
const project = makeProject({ id: "proj-1", name: "Website", color: "#0052ff" });
const task = makeTask({ id: "task-1", title: "Write the plan", projectId: "proj-1" });

function seg(id: string, over: Partial<Segment> = {}): Segment {
  return {
    id,
    categoryId: "cat-1",
    startedAt: at(2026, 3, 1, 9, 0),
    endedAt: at(2026, 3, 1, 10, 30),
    source: "timer",
    createdAt: at(2026, 3, 1, 9, 0),
    updatedAt: at(2026, 3, 1, 9, 0),
    ...over,
  };
}

const SEGMENTS: Segment[] = [
  seg("s-run", { startedAt: at(2026, 3, 1, 13, 18), endedAt: undefined, taskId: "task-1" }),
  seg("s-timer", { startedAt: at(2026, 3, 1, 9, 40), endedAt: at(2026, 3, 1, 10, 10), categoryId: "cat-2" }),
  seg("s-manual", { startedAt: at(2026, 2, 28, 16, 10), endedAt: at(2026, 2, 28, 17, 20), source: "manual" }),
  seg("s-gap", { startedAt: at(2026, 2, 20, 8, 0), endedAt: at(2026, 2, 20, 8, 45), source: "backfill" }),
];

function Loader() {
  const { loadSegments, openTaskId } = useTasks();
  useEffect(() => {
    // Deferred so the canned response (set right after render) is in place.
    const t = setTimeout(() => void loadSegments("a", "b"), 0);
    return () => clearTimeout(t);
  }, [loadSegments]);
  return <output data-testid="open-task">{openTaskId ?? ""}</output>;
}

const bodyRows = () => screen.getAllByRole("row").slice(1);

beforeEach(() => {
  Element.prototype.getBoundingClientRect = vi.fn(function (this: Element) {
    if (this.hasAttribute("data-picker-menu")) return rect({ height: 120, width: 180 });
    if (this.getAttribute("aria-haspopup") === "menu" || this.getAttribute("role") === "combobox")
      return rect({ top: 100, bottom: 136, left: 20, right: 100, width: 80, height: 36 });
    return rect({});
  }) as unknown as typeof Element.prototype.getBoundingClientRect;
});

// Renders the module with the segment list canned before the first fetch.
async function mountWith(segments: Segment[], dayISO = TODAY): Promise<{ mock: MockFetch }> {
  const { mock } = await (async () => {
    const holder: { mock?: MockFetch } = {};
    // renderWorkspace stubs fetch synchronously, so canning right after render beats the async GET.
    const view = renderWorkspace(
      <>
        <Loader />
        <RecordsModule now={NOW} dayISO={dayISO} todayISO={TODAY} />
      </>,
      emptyWorkspace({ categories, tasks: [task], projects: [project] }),
    );
    view.mock.respondWith("/api/segments?", { segments, running: null });
    holder.mock = view.mock;
    return holder as { mock: MockFetch };
  })();
  return { mock };
}

describe("RecordsModule (Recent entries)", () => {
  test("renders the card, columns, started labels and mono durations", async () => {
    await mountWith(SEGMENTS);
    expect(await screen.findByText("Recent entries")).toBeTruthy();
    await screen.findByText("Today 13:18");
    for (const col of ["Task", "Project", "Started", "Source", "Duration"]) {
      expect(screen.getByRole("columnheader", { name: col })).toBeTruthy();
    }
    await screen.findByText("Today 13:18");
    expect(screen.getByText("Today 09:40")).toBeTruthy();
    expect(screen.getByText("Yesterday 16:10")).toBeTruthy();
    expect(screen.getByText("Fri 20 Feb 08:00")).toBeTruthy();
    expect(screen.getByText("Website")).toBeTruthy();
    // 13:18 to now 14:00 = 42m; 09:40 to 10:10 = 30m.
    expect(screen.getByText("42m").className).toContain("font-mono");
    expect(screen.getByText("30m").className).toContain("text-right");
  });

  test("source pills: running, timer, manual, gap fill", async () => {
    await mountWith(SEGMENTS);
    await screen.findByText("Running");
    expect(screen.getByText("Timer")).toBeTruthy();
    expect(screen.getByText("Manual")).toBeTruthy();
    expect(screen.getByText("Gap fill")).toBeTruthy();
  });

  test("the Edit entry trigger is the more icon, not a chevron", async () => {
    await mountWith(SEGMENTS);
    await screen.findByText("Running");
    const trigger = screen.getAllByRole("button", { name: "Edit entry" })[0];
    expect(trigger.querySelector('path[d="m9 6 6 6-6 6"]')).toBeNull();
  });

  test("newest first by default, toggles to oldest first", async () => {
    await mountWith(SEGMENTS);
    await screen.findByText("Running");
    expect(within(bodyRows()[0]).getByText("Running")).toBeTruthy();
    expect(within(bodyRows()[3]).getByText("Gap fill")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Newest first" }));
    expect(within(bodyRows()[0]).getByText("Gap fill")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Oldest first" })).toBeTruthy();
  });

  test("filters by category and shows an empty message when nothing matches", async () => {
    await mountWith(SEGMENTS.filter((s) => s.id !== "s-timer"));
    await screen.findByText("Running");
    const select = screen.getByLabelText("Filter by category");
    fireEvent.change(select, { target: { value: "cat-2" } });
    expect(screen.getByText("No entries in this category.")).toBeTruthy();
    fireEvent.change(select, { target: { value: "cat-1" } });
    expect(screen.getAllByRole("row").length).toBe(4);
  });

  test("the linked task name opens the task", async () => {
    await mountWith(SEGMENTS);
    const link = await screen.findByRole("button", { name: "Write the plan" });
    await userEvent.click(link);
    expect(screen.getByTestId("open-task").textContent).toBe("task-1");
  });

  test("Edit opens an editor row; category change patches the segment", async () => {
    const { mock } = await mountWith([SEGMENTS[1]]);
    await screen.findByText("Timer");
    await userEvent.click(screen.getByRole("button", { name: "Edit entry" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
    mock.respondNext("/api/segments/s-timer", { ...SEGMENTS[1], categoryId: "cat-1" }, "PATCH");
    await userEvent.click(screen.getByRole("combobox", { name: "Category" }));
    await userEvent.click(within(await screen.findByRole("listbox")).getByText("Focus Work"));
    await waitFor(() =>
      expect(mock.calls.some((c) => c.method === "PATCH" && (c.body as { categoryId?: string }).categoryId === "cat-1")).toBe(
        true,
      ),
    );
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
  });

  test("clearing the task link patches taskId empty", async () => {
    const { mock } = await mountWith([SEGMENTS[0]]);
    await screen.findByText("Running");
    await userEvent.click(screen.getByRole("button", { name: "Edit entry" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
    await userEvent.click(screen.getByRole("combobox", { name: "Task" }));
    mock.respondNext("/api/segments/s-run", { ...SEGMENTS[0], taskId: undefined }, "PATCH");
    await userEvent.click(await screen.findByText("No task"));
    await waitFor(() =>
      expect(mock.calls.some((c) => c.method === "PATCH" && (c.body as { taskId?: string }).taskId === "")).toBe(true),
    );
  });

  test("note saves on blur only when changed", async () => {
    const { mock } = await mountWith([{ ...SEGMENTS[1], note: "first" }]);
    await screen.findByText("Timer");
    await userEvent.click(screen.getByRole("button", { name: "Edit entry" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
    const note = screen.getByPlaceholderText("Note");
    note.focus();
    fireEvent.blur(note);
    expect(mock.calls.filter((c) => c.method === "PATCH")).toHaveLength(0);
    mock.respondNext("/api/segments/s-timer", { ...SEGMENTS[1], note: "second" }, "PATCH");
    fireEvent.change(note, { target: { value: "second" } });
    fireEvent.blur(note);
    await waitFor(() =>
      expect(mock.calls.filter((c) => c.method === "PATCH").map((c) => (c.body as { note?: string }).note)).toEqual(["second"]),
    );
  });

  test("Delete removes the entry with no confirmation", async () => {
    const { mock } = await mountWith([SEGMENTS[1]]);
    await screen.findByText("Timer");
    await userEvent.click(screen.getByRole("button", { name: "Edit entry" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    await waitFor(() => expect(mock.calls.some((c) => c.method === "DELETE" && c.url.includes("/api/segments/s-timer"))).toBe(true));
    expect(await screen.findByText("Nothing tracked on this day.")).toBeTruthy();
  });

  test("empty state and day label", async () => {
    await mountWith([]);
    expect(await screen.findByText("Nothing tracked on this day.")).toBeTruthy();
    expect(screen.getByText("Today")).toBeTruthy();
  });

  test("another day shows its date in the header", async () => {
    await mountWith([], "2026-02-27");
    expect(await screen.findByText("Fri 27 Feb")).toBeTruthy();
  });
});
