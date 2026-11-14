import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UpNextRow from "@/components/today/UpNextRow";
import { useTasks } from "@/lib/store-context";
import { emptyWorkspace, makeProject, makeTask, renderWorkspace } from "./harness";

const TODAY = "2026-11-12";
const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function Probe() {
  const { openTaskId } = useTasks();
  return <div data-testid="open-id">{openTaskId ?? "none"}</div>;
}

function setup(
  opts: { canSkip?: boolean; reasons?: string[]; projectId?: string; priority?: 0 | 1 | 2 | 3 } = {},
) {
  const project = makeProject();
  const task = makeTask({
    id: ID,
    title: "Finalise venue",
    minutes: 45,
    scheduled: TODAY,
    projectId: opts.projectId,
    priority: opts.priority ?? 0,
  });
  const onSomethingElse = vi.fn();
  const r = renderWorkspace(
    <>
      <UpNextRow
        suggestion={{ task, reasons: opts.reasons ?? ["Due 3pm", "Unblocks 2"] }}
        todayISO={TODAY}
        onSomethingElse={onSomethingElse}
        canSkip={opts.canSkip ?? true}
      />
      <Probe />
    </>,
    emptyWorkspace({ tasks: [task], projects: [project] }),
  );
  return { ...r, onSomethingElse, project, task };
}

const rect = (r: Partial<DOMRect>): DOMRect =>
  ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => {}, ...r }) as DOMRect;

const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

describe("UpNextRow", () => {
  // jsdom has no layout; the menu closes at once unless it can measure itself.
  beforeEach(() => {
    Element.prototype.getBoundingClientRect = vi.fn(function (this: Element) {
      if (this.hasAttribute("data-picker-menu")) return rect({ height: 120, width: 180 });
      if (this.getAttribute("aria-haspopup") === "menu") return rect({ top: 100, bottom: 136, left: 20, right: 100, width: 80, height: 36 });
      return rect({});
    }) as unknown as typeof Element.prototype.getBoundingClientRect;
  });

  afterEach(() => {
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    vi.restoreAllMocks();
  });

  it("shows at most two reasons, the estimate and no score", () => {
    setup({ reasons: ["Due 3pm", "Unblocks 2", "Committed today", "Carried over"] });
    const row = screen.getByTestId("up-next");
    expect(row).not.toHaveTextContent("Due 3pm");
    expect(row).toHaveTextContent("Unblocks 2");
    expect(row).toHaveTextContent("Committed today");
    expect(row).not.toHaveTextContent("Carried over");
    expect(row).toHaveTextContent("45m");
    expect(row.textContent).not.toMatch(/score/i);
    expect(row).toHaveTextContent("Up next");
  });

  it("shows the priority word once when no reason mentions priority", () => {
    setup({ priority: 2 });
    const row = screen.getByTestId("up-next");
    expect(row.textContent?.match(/Medium/g)).toHaveLength(1);
    expect(row.textContent).not.toMatch(/P2/);
  });

  it("shows the badge even when a reason says the priority, and drops that reason", () => {
    setup({ priority: 1, reasons: ["High priority", "Due 3pm"] });
    const row = screen.getByTestId("up-next");
    expect(row.textContent?.match(/High/g)).toHaveLength(1);
    expect(screen.queryByText("High priority")).toBeNull();
    expect(row.textContent).not.toMatch(/P1/);
  });

  it("draws the due text once, as the calendar item, and keeps icon reasons", () => {
    const task = makeTask({ id: ID, title: "Finalise venue", minutes: 45, scheduled: TODAY, priority: 1, dueTime: "14:30" });
    renderWorkspace(
      <UpNextRow
        suggestion={{ task, reasons: ["Due 2:30pm", "High priority", "Unblocks 2"] }}
        todayISO={TODAY}
        onSomethingElse={vi.fn()}
        canSkip
      />,
      emptyWorkspace({ tasks: [task], projects: [] }),
    );
    const due = screen.queryAllByText(/Due 14:30/i);
    expect(due).toHaveLength(1);
    expect(due[0].querySelector("svg")).not.toBeNull();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.queryByText("High priority")).toBeNull();
    const row = screen.getByTestId("up-next");
    expect(row.textContent?.match(/Due /g)).toHaveLength(1);
    expect(screen.getByText("Unblocks 2").querySelector("svg")).not.toBeNull();
  });

  it("shows no badge for priority 0", () => {
    setup({ priority: 0 });
    const row = screen.getByTestId("up-next");
    expect(row.textContent).not.toMatch(/High|Medium|Low/);
  });

  it("shows the project name when the task has one", async () => {
    const project = makeProject();
    setup({ projectId: project.id });
    expect(await screen.findByText("Website")).toBeInTheDocument();
  });

  it("title click opens the task", async () => {
    setup();
    await userEvent.setup().click(screen.getByRole("button", { name: "Finalise venue" }));
    expect(screen.getByTestId("open-id")).toHaveTextContent(ID);
  });

  it("checkbox completes the task", async () => {
    const { mock, task } = setup();
    mock.respondWith(`/api/tasks/${ID}/complete`, {
      task: { ...task, status: "done", completedAt: "2026-11-12T10:00:00.000Z" },
      next: null,
    });
    await userEvent.setup().click(screen.getByRole("checkbox", { name: "Mark done Finalise venue" }));
    await waitFor(() => expect(mock.calls.length).toBeGreaterThan(0));
    expect(mock.calls.some((c) => c.url.includes(ID))).toBe(true);
  });

  it("has Start and Not today", () => {
    setup();
    expect(screen.getByRole("button", { name: "Start timer for Finalise venue" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Not today" })).toBeInTheDocument();
  });

  it("hides Something else when canSkip is false", async () => {
    setup({ canSkip: false });
    await userEvent.setup().click(screen.getByRole("button", { name: "More actions for Finalise venue" }));
    expect(screen.queryByRole("menuitem", { name: "Something else" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Open" })).toBeInTheDocument();
  });

  it("Something else is a menu item and calls the callback when canSkip is true", async () => {
    const { onSomethingElse } = setup({ canSkip: true });
    const user = userEvent.setup();
    expect(screen.queryByRole("button", { name: "Something else" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "More actions for Finalise venue" }));
    await user.click(screen.getByRole("menuitem", { name: "Something else" }));
    expect(onSomethingElse).toHaveBeenCalledTimes(1);
  });

  it("the overflow trigger is an icon only, with no chevron and no '...' text", () => {
    setup();
    const trigger = screen.getByRole("button", { name: "More actions for Finalise venue" });
    expect(trigger.querySelector("svg")).not.toBeNull();
    expect(trigger.querySelector('path[d="m9 6 6 6-6 6"]')).toBeNull();
    expect(trigger.textContent).not.toBe("...");
    expect(trigger.textContent).not.toContain("...");
  });

  it("the tag reads exactly 'Up next' in sentence case", () => {
    setup();
    const tag = screen.getByText("Up next");
    expect(tag.textContent).toBe("Up next");
    expect(tag.className).not.toMatch(/uppercase|font-mono|tracking/);
  });

  it("uses two columns with actions on a second row below rail:, three columns from rail:", () => {
    setup();
    const root = screen.getByTestId("up-next");
    expect(root).toHaveClass("grid-cols-[20px_minmax(0,1fr)]", "rail:grid-cols-[20px_minmax(0,1fr)_auto]");
    const actions = screen.getByTestId("up-next-actions");
    expect(actions).toHaveClass("col-start-2", "justify-start", "rail:col-start-auto", "rail:justify-end");
    expect(actions).toContainElement(screen.getByRole("button", { name: "Not today" }));
    expect(actions).toContainElement(screen.getByRole("button", { name: "Start timer for Finalise venue" }));
  });

  it("Focus sits between Not today and Start and starts a time entry", async () => {
    const { mock } = setup();
    const notToday = screen.getByRole("button", { name: "Not today" });
    const focus = screen.getByRole("button", { name: "Focus on Finalise venue" });
    const start = screen.getByRole("button", { name: "Start timer for Finalise venue" });
    expect(notToday.compareDocumentPosition(focus) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(focus.compareDocumentPosition(start) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await userEvent.setup().click(focus);
    await waitFor(() =>
      expect(mock.calls.some((c) => c.method === "POST" && c.url === "/api/time-entries")).toBe(true),
    );
  });
});
