import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import TaskRow, { ITEM, TaskMeta } from "@/components/TaskRow";
import { fmt } from "@/lib/format";
import { emptyWorkspace, makeProject, makeTask, renderWorkspace } from "./harness";

const TODAY = "2026-03-01";

const rect = (r: Partial<DOMRect>): DOMRect =>
  ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => {}, ...r }) as DOMRect;

describe("TaskRow", () => {
  // jsdom has no layout; the menu stays hidden until it can measure itself.
  beforeEach(() => {
    Element.prototype.getBoundingClientRect = vi.fn(function (this: Element) {
      if (this.hasAttribute("data-picker-menu")) return rect({ height: 120, width: 180 });
      if (this.getAttribute("aria-haspopup") === "menu") return rect({ top: 100, bottom: 136, left: 20, right: 100, width: 80, height: 36 });
      return rect({});
    }) as unknown as typeof Element.prototype.getBoundingClientRect;
  });

  test("title is a button that cannot collapse and carries the task title", async () => {
    const task = makeTask();
    renderWorkspace(<ul><TaskRow task={task} todayISO={TODAY} /></ul>, emptyWorkspace({ tasks: [task] }));
    const title = await screen.findByRole("button", { name: "Write the plan" });
    expect(title.className).toContain("min-w-0");
  });

  test("meta line shows priority, project and repeat mode", async () => {
    const project = makeProject();
    const task = makeTask({ priority: 1, projectId: project.id, recurrence: { freq: "weekly", interval: 1 } });
    renderWorkspace(
      <ul><TaskRow task={task} todayISO={TODAY} /></ul>,
      emptyWorkspace({ tasks: [task], projects: [project] }),
    );
    expect(await screen.findByText("High")).toBeInTheDocument();
    expect(screen.getByText("Website")).toBeInTheDocument();
    expect(screen.getByText("Weekly")).toBeInTheDocument();
  });

  test("a blocked task shows who it is waiting on", async () => {
    const blocker = makeTask({ id: "44444444-4444-4444-8444-444444444444", title: "Get the quote" });
    const task = makeTask({ blockedBy: [blocker.id] });
    renderWorkspace(
      <ul><TaskRow task={task} todayISO={TODAY} /></ul>,
      emptyWorkspace({ tasks: [task, blocker] }),
    );
    expect(await screen.findByText("Waiting on Get the quote")).toBeInTheDocument();
  });

  test("a hidden-until task shows its start date", async () => {
    const task = makeTask({ startOn: "2026-11-14", scheduled: "2026-11-14" });
    renderWorkspace(<ul><TaskRow task={task} todayISO="2026-11-12" /></ul>, emptyWorkspace({ tasks: [task] }));
    expect(await screen.findByText("From 14 Nov")).toBeInTheDocument();
  });

  test("a carried-over task says so and Do today reschedules it", async () => {
    const task = makeTask({ scheduled: "2026-02-27" });
    const { mock } = renderWorkspace(
      <ul><TaskRow task={task} todayISO={TODAY} /></ul>,
      emptyWorkspace({ tasks: [task] }),
    );
    expect(await screen.findByText("Carried over")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "More actions for Write the plan" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Do today" }));
    await waitFor(() =>
      expect(mock.calls).toContainEqual(
        expect.objectContaining({ method: "PATCH", body: expect.objectContaining({ scheduled: TODAY }) }),
      ),
    );
  });

  test("Move to trash calls the trash route", async () => {
    const task = makeTask();
    const { mock } = renderWorkspace(
      <ul><TaskRow task={task} todayISO={TODAY} /></ul>,
      emptyWorkspace({ tasks: [task] }),
    );
    await userEvent.click(await screen.findByRole("button", { name: "More actions for Write the plan" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Move to trash" }));
    await waitFor(() => expect(mock.calls.some((c) => c.url.includes(`/api/tasks/${task.id}`))).toBe(true));
  });

  test("the overflow trigger is an icon-only more glyph with no chevron", async () => {
    const task = makeTask();
    renderWorkspace(<ul><TaskRow task={task} todayISO={TODAY} /></ul>, emptyWorkspace({ tasks: [task] }));
    const trigger = await screen.findByRole("button", { name: `More actions for ${task.title}` });
    expect(trigger.querySelector('path[d="m9 6 6 6-6 6"]')).toBeNull();
    expect(trigger.textContent).not.toBe("...");
    expect(trigger.querySelector("svg")).not.toBeNull();
  });

  test("a done task has no Start button", async () => {
    const task = makeTask({ status: "done" });
    renderWorkspace(<ul><TaskRow task={task} todayISO={TODAY} /></ul>, emptyWorkspace({ tasks: [task] }));
    await screen.findByRole("button", { name: "Write the plan" });
    expect(screen.queryByRole("button", { name: /Start timer/ })).not.toBeInTheDocument();
  });

  test("compact row keeps the estimate once, in the right cell, in mono", async () => {
    const project = makeProject();
    const task = makeTask({ projectId: project.id, minutes: 45 });
    renderWorkspace(
      <ul><TaskRow task={task} todayISO={TODAY} compact /></ul>,
      emptyWorkspace({ tasks: [task], projects: [project] }),
    );
    const est = await screen.findAllByText(fmt(45));
    expect(est).toHaveLength(1);
    expect(est[0].className).toContain("font-mono");
    expect(est[0].parentElement).not.toBe(screen.getByText("Website").parentElement);
    expect(est[0].closest("li")?.className).toContain("_auto]");
  });

  test("trailing renders in the right cell before the estimate", async () => {
    const task = makeTask({ minutes: 45 });
    renderWorkspace(
      <ul><TaskRow task={task} todayISO={TODAY} trailing={<span data-testid="trail" />} /></ul>,
      emptyWorkspace({ tasks: [task] }),
    );
    const est = await screen.findByText(fmt(45));
    expect(screen.getByTestId("trail").nextElementSibling).toBe(est);
  });

  test("TaskMeta renders the priority pill, project and an icon item as separate elements", async () => {
    const project = makeProject();
    const task = makeTask({ priority: 1, projectId: project.id, dueTime: "14:30" });
    renderWorkspace(
      <TaskMeta task={task} todayISO={TODAY} />,
      emptyWorkspace({ tasks: [task], projects: [project] }),
    );
    const prio = await screen.findByText("High");
    const proj = screen.getByText("Website");
    const due = screen.getByText(/^Due /);
    expect(new Set([prio, proj, due]).size).toBe(3);
    expect(proj.closest("div")).toBe(prio.closest("div"));
    expect(due.querySelector("svg")).not.toBeNull();
    expect(proj.querySelector("span")).not.toBeNull();
  });

  test("non-compact row keeps the estimate once, outside the meta line", async () => {
    const project = makeProject();
    const task = makeTask({ projectId: project.id, minutes: 45 });
    renderWorkspace(
      <ul><TaskRow task={task} todayISO={TODAY} /></ul>,
      emptyWorkspace({ tasks: [task], projects: [project] }),
    );
    const est = await screen.findAllByText(fmt(45));
    expect(est).toHaveLength(1);
    expect(est[0].parentElement).not.toBe(screen.getByText("Website").parentElement);
  });

  test.each([false, true])("hover cluster is out of flow (compact=%s)", async (compact) => {
    const task = makeTask();
    renderWorkspace(<ul><TaskRow task={task} todayISO={TODAY} compact={compact} /></ul>, emptyWorkspace({ tasks: [task] }));
    await screen.findByRole("button", { name: "Write the plan" });
    expect(screen.getByTestId("row-hover-cluster").className).toMatch(/(^|\s)absolute(\s|$)/);
  });

  test("meta prop renders last inside the meta line", async () => {
    const task = makeTask({ priority: 2 });
    renderWorkspace(
      <ul><TaskRow task={task} todayISO={TODAY} meta={<span className={ITEM}>Added today</span>} /></ul>,
      emptyWorkspace({ tasks: [task] }),
    );
    await screen.findByRole("button", { name: "Write the plan" });
    const item = screen.getByText("Added today");
    expect(item.parentElement?.lastElementChild).toBe(item);
    expect(item.parentElement?.children.length).toBeGreaterThan(1);
  });

  test("row height is fixed across hover: the cluster is pinned to the row box and takes no flow space", async () => {
    const task = makeTask();
    renderWorkspace(<ul><TaskRow task={task} todayISO={TODAY} /></ul>, emptyWorkspace({ tasks: [task] }));
    await screen.findByRole("button", { name: "Write the plan" });
    const cls = screen.getByTestId("row-hover-cluster").className;
    expect(cls).toMatch(/(^|\s)absolute(\s|$)/);
    expect(cls).toContain("inset-y-0");
    expect(cls).not.toMatch(/(^|\s)(py-|p-|h-|min-h-)/);
    const li = document.querySelector("li") as HTMLElement;
    expect(li.className).not.toMatch(/hover:(p|py|h|min-h)-/);
  });

  test("a blocked task shows the blocked item in ink tokens, not an alarm tone", async () => {
    const blocker = makeTask({ id: "44444444-4444-4444-8444-444444444444", title: "Get the quote" });
    const task = makeTask({ blockedBy: [blocker.id] });
    renderWorkspace(<ul><TaskRow task={task} todayISO={TODAY} /></ul>, emptyWorkspace({ tasks: [task, blocker] }));
    const item = await screen.findByTestId("blocked-item");
    expect(item.className).toContain("text-ink-3");
    expect(item.className).not.toMatch(/text-(med|hi)/);
    expect(item.querySelector("svg")).toBeTruthy();
  });

  test("a task whose blocker is done shows no blocked item", async () => {
    const blocker = makeTask({ id: "44444444-4444-4444-8444-444444444444", title: "Get the quote", status: "done" });
    const task = makeTask({ blockedBy: [blocker.id] });
    renderWorkspace(<ul><TaskRow task={task} todayISO={TODAY} /></ul>, emptyWorkspace({ tasks: [task, blocker] }));
    await screen.findByRole("button", { name: "Write the plan" });
    expect(screen.queryByTestId("blocked-item")).toBeNull();
  });

  test("subtask count is an icon button that toggles the list", async () => {
    const task = makeTask({ subtasks: [{ id: "s1", title: "One", done: true }, { id: "s2", title: "Two", done: false }] } as never);
    renderWorkspace(<ul><TaskRow task={task} todayISO={TODAY} /></ul>, emptyWorkspace({ tasks: [task] }));
    const btn = await screen.findByRole("button", { name: `Subtasks for ${task.title}` });
    expect(btn.textContent).toContain("1/2");
    expect(btn.querySelector("svg")).not.toBeNull();
    expect(btn).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
  });

  test("Carried over sits beside an icon", async () => {
    const task = makeTask({ scheduled: "2026-02-27" });
    renderWorkspace(<ul><TaskRow task={task} todayISO={TODAY} /></ul>, emptyWorkspace({ tasks: [task] }));
    const el = await screen.findByText("Carried over");
    expect(el.querySelector("svg")).not.toBeNull();
  });

  test("TaskMeta draws the estimate before the due time", async () => {
    const task = makeTask({ minutes: 45, dueTime: "14:00" });
    renderWorkspace(<TaskMeta task={task} todayISO={TODAY} showEstimate />, emptyWorkspace({ tasks: [task] }));
    const est = await screen.findByText(fmt(45));
    const due = screen.getByText(/^Due /);
    expect(est.compareDocumentPosition(due) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("TaskMeta nowrap drops flex-wrap", async () => {
    const task = makeTask({ minutes: 45 });
    renderWorkspace(<TaskMeta task={task} todayISO={TODAY} showEstimate nowrap />, emptyWorkspace({ tasks: [task] }));
    const est = await screen.findByText(fmt(45));
    const box = est.closest("div") as HTMLElement;
    expect(box.className).not.toContain("flex-wrap");
    expect(box.className).toContain("flex-nowrap");
  });
  test("the row carries its task id for keyboard navigation", async () => {
    const task = makeTask();
    renderWorkspace(<ul><TaskRow task={task} todayISO={TODAY} /></ul>, emptyWorkspace({ tasks: [task] }));
    await screen.findByRole("button", { name: "Write the plan" });
    expect(document.querySelector("li")?.getAttribute("data-task-id")).toBe(task.id);
  });

  test("hideCheckbox removes the checkbox and keeps the title", async () => {
    const task = makeTask();
    renderWorkspace(<ul><TaskRow task={task} todayISO={TODAY} hideCheckbox /></ul>, emptyWorkspace({ tasks: [task] }));
    expect(await screen.findByRole("button", { name: "Write the plan" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  test("an outside data-kbd-selected write keeps the row rendered and styled", async () => {
    const task = makeTask();
    renderWorkspace(<ul><TaskRow task={task} todayISO={TODAY} /></ul>, emptyWorkspace({ tasks: [task] }));
    await screen.findByRole("button", { name: "Write the plan" });
    const li = document.querySelector("li") as HTMLElement;
    expect(li.className).toContain("data-[kbd-selected=true]:bg-row-hover");
    li.setAttribute("data-kbd-selected", "true");
    expect(screen.getByRole("button", { name: "Write the plan" })).toBeInTheDocument();
    expect(li.getAttribute("data-kbd-selected")).toBe("true");
  });

  test("an open row's hover cluster has a Focus button; done and custom-actions rows do not", async () => {
    const task = makeTask();
    const done = makeTask({ id: "55555555-5555-4555-8555-555555555555", title: "Shipped it", status: "done" } as never);
    const custom = makeTask({ id: "66666666-6666-4666-8666-666666666666", title: "Custom row" });
    renderWorkspace(
      <ul>
        <TaskRow task={task} todayISO={TODAY} />
        <TaskRow task={done} todayISO={TODAY} />
        <TaskRow task={custom} todayISO={TODAY} actions={<span>mine</span>} />
      </ul>,
      emptyWorkspace({ tasks: [task, done, custom] }),
    );
    await screen.findByRole("button", { name: "Write the plan" });
    const clusters = screen.getAllByTestId("row-hover-cluster");
    expect(within(clusters[0]).getByRole("button", { name: `Focus on ${task.title}` })).toBeInTheDocument();
    expect(within(clusters[1]).queryByRole("button", { name: /^Focus on/ })).toBeNull();
    expect(within(clusters[2]).queryByRole("button", { name: /^Focus on/ })).toBeNull();
  });
});
