import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import InboxRow from "@/components/inbox/InboxRow";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

vi.mock("@/components/inbox/inbox-data", () => ({ ageLabel: () => "Added 12 days ago" }));

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TODAY = "2026-03-10";
const task = makeTask({ id: A, title: "Sort the inbox", scheduled: null });

const setup = () =>
  renderWorkspace(
    <ul className="task-list">
      <InboxRow task={task} todayISO={TODAY} />
    </ul>,
    emptyWorkspace({ tasks: [task] }),
  );

describe("InboxRow", () => {
  it("renders the title", () => {
    setup();
    expect(screen.getByText("Sort the inbox")).toBeTruthy();
  });

  it("Today reschedules to today", async () => {
    const { mock } = setup();
    mock.respondWith("/api/tasks/reschedule", [{ ...task, scheduled: TODAY }]);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Today" })));
    await waitFor(() => expect(mock.calls).toHaveLength(1));
    expect(mock.calls[0].body).toEqual({ ids: [A], day: TODAY });
  });

  it("shows the age as its own clock-plus-text meta item", () => {
    setup();
    const item = screen.getByText("Added 12 days ago");
    expect(item.tagName).toBe("SPAN");
    expect(item.className).toContain("inline-flex");
    expect(item.querySelector("svg")).not.toBeNull();
  });

  it("Today is a ghost text button", () => {
    setup();
    expect(screen.getByRole("button", { name: "Today" })).toHaveAttribute("data-variant", "ghost");
  });

  it("Pick a day is the chip and opens the menu", async () => {
    const orig = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      x: 0, y: 0, top: 0, left: 0, right: 100, bottom: 36, width: 100, height: 36, toJSON: () => ({}),
    })) as unknown as typeof Element.prototype.getBoundingClientRect;
    try {
      setup();
      const pick = screen.getByRole("button", { name: "Pick a day" });
      expect(pick).toHaveAttribute("data-variant", "chip");
      await act(async () => fireEvent.click(pick));
      expect(screen.getByRole("menu", { name: "Move to another day" })).toBeTruthy();
    } finally {
      Element.prototype.getBoundingClientRect = orig;
    }
  });

  it("trash is a 32px circle labelled Move to trash", () => {
    setup();
    const btn = screen.getByRole("button", { name: "Move to trash" });
    expect(btn.className).toContain("size-8");
    expect(btn.className).toContain("rounded-full");
    expect(btn.className).toContain("ring-line");
  });

  it("Move to trash trashes the task", async () => {
    const { mock } = setup();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Move to trash" })));
    await waitFor(() => expect(mock.calls.some((c) => c.url.includes(`/api/tasks/${A}`))).toBe(true));
  });

  it("row height is the same hovered and at rest: the custom cluster is absolute and pinned to the row", () => {
    setup();
    const cluster = screen.getByTestId("row-hover-cluster");
    expect(cluster.className).toMatch(/(^|\s)absolute(\s|$)/);
    expect(cluster.className).toContain("inset-y-0");
    expect(cluster.className).toContain("group-hover:");
    expect(cluster.className).not.toMatch(/(^|\s)(py-|h-|min-h-)/);
  });
});
