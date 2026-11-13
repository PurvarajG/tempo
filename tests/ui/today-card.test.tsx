import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import TodayCard from "@/components/today/TodayCard";
import type { Suggestion } from "@/lib/next";
import type { TodayLayout } from "@/lib/today";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

const TODAY = "2026-03-01";
const id = (n: number) => `${n}${n}${n}${n}${n}${n}${n}${n}-1111-4111-8111-111111111111`;

const UP = makeTask({ id: id(1), title: "Finalise venue", scheduled: TODAY });
const STARRED = makeTask({ id: id(2), title: "Approve proofs", committedOn: TODAY });
const COULD = makeTask({ id: id(3), title: "Draft one-pager" });
const OLD = makeTask({ id: id(4), title: "Pay invoice", scheduled: "2026-02-27" });
const DONE = makeTask({ id: id(5), title: "Book van", status: "done", minutes: 15 });

const suggestion: Suggestion = { task: UP, score: 1, reasons: ["Due 3pm"] } as unknown as Suggestion;

function layout(over: Partial<TodayLayout> = {}): TodayLayout {
  return { upNext: null, alternatives: [], committed: [], couldAlso: [], carried: [], done: [], ...over };
}

function renderCard(l: TodayLayout, inboxCount = 0, tasks = [UP, STARRED, COULD, OLD, DONE]) {
  return renderWorkspace(
    <TodayCard layout={l} todayISO={TODAY} inboxCount={inboxCount} onSomethingElse={vi.fn()} />,
    emptyWorkspace({ tasks }),
  );
}

const full = () =>
  layout({ upNext: suggestion, committed: [STARRED], couldAlso: [COULD], carried: [OLD], done: [DONE] });

describe("TodayCard", () => {
  test("card root has no padding-bottom of its own; the list carries it", () => {
    renderCard(full(), 3);
    const root = document.querySelector('[data-part="card"]') as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.classList.contains("pb-2")).toBe(false);
    const list = Array.from(root.querySelectorAll("div")).find(
      (d) => d.classList.contains("px-2") && d.classList.contains("pb-2"),
    );
    expect(list).toBeTruthy();
  });

  test("sections render in order", () => {
    renderCard(full(), 3);
    const text = document.body.textContent ?? "";
    const order = ["Up next", "Today's 3", "Also today, 1", "Carried over, 1", "Inbox, 3", "Done today, 1"].map(
      (s) => text.indexOf(s),
    );
    expect(order.every((n) => n >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  test("header counts open tasks", () => {
    renderCard(full());
    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  test("header shows the sort note when open tasks render", () => {
    renderCard(full());
    expect(screen.getByText("Sorted by priority")).toBeInTheDocument();
  });

  test("a task appears once", () => {
    renderCard(full());
    expect(screen.getAllByText("Finalise venue")).toHaveLength(1);
    expect(screen.getAllByText("Approve proofs")).toHaveLength(1);
  });

  test("Also today rows are visible", () => {
    renderCard(full());
    expect(screen.getByText("Today's 3")).toBeInTheDocument();
    expect(screen.getByText("Also today, 1")).toBeInTheDocument();
    expect(screen.getByText("Draft one-pager")).toBeInTheDocument();
    expect(screen.queryByText(/Could also/)).not.toBeInTheDocument();
  });

  test("task rows carry 12px vertical padding like the mockup .task", () => {
    renderCard(full(), 0);
    const rows = document.querySelectorAll("li[data-task-id]");
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((li) => {
      expect(li.className).toContain("py-3");
      expect(li.className).not.toContain("py-2");
    });
  });

  test("star buttons on committed and could-also rows", () => {
    renderCard(full());
    expect(screen.getByRole("button", { name: "Remove from Today's 3" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Add to Today's 3" })).toBeInTheDocument();
  });

  test("inbox line hidden at 0 and links at 3", () => {
    const { unmount } = renderCard(full(), 0);
    expect(screen.queryByText(/^Inbox/)).not.toBeInTheDocument();
    unmount();
    renderCard(full(), 3);
    expect(screen.getByRole("link", { name: "Inbox, 3" })).toHaveAttribute("href", "/inbox");
  });

  test("no headers or hint when nothing is starred", () => {
    renderCard(layout({ upNext: suggestion, couldAlso: [COULD] }));
    expect(screen.getByText("Draft one-pager")).toBeInTheDocument();
    expect(screen.queryByText("Today's 3")).not.toBeInTheDocument();
    expect(screen.queryByText(/Also today/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Star a task/)).not.toBeInTheDocument();
  });

  test("nothing planned, with a carried over link", () => {
    renderCard(layout({ carried: [OLD] }));
    expect(screen.getByText("Nothing planned for today.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See carried over" })).toHaveAttribute("href", "#carried-over");
  });

  test("nothing planned without carried over has no link", () => {
    renderCard(layout());
    expect(screen.getByText("Nothing planned for today.")).toBeInTheDocument();
    expect(screen.queryByText("See carried over")).not.toBeInTheDocument();
  });

  test("all done shows count and tracked time", () => {
    renderCard(layout({ done: [DONE] }));
    expect(screen.getByText("All done for today.")).toBeInTheDocument();
    expect(screen.getByText("1 done, 0m tracked.")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Done today" })).getByText("Book van")).toBeInTheDocument();
  });
});
