import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import TaskRow from "@/components/TaskRow";
import { addDays, toISODate } from "@/lib/parse";
import { useTasks } from "@/lib/store-context";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

function Probe() {
  return <output data-testid="open-id">{useTasks().openTaskId ?? ""}</output>;
}

const A = makeTask({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", title: "First task", sortOrder: 0 });
const B = makeTask({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", title: "Second task", sortOrder: 1 });
const TODAY = toISODate(new Date());

const rect = (r: Partial<DOMRect>): DOMRect =>
  ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => {}, ...r }) as DOMRect;

function setup() {
  const ws = emptyWorkspace({ tasks: [A, B] });
  const view = renderWorkspace(
    <>
      <input id="doem-quick-add" aria-label="Quick add" />
      <ul>
        <TaskRow task={A} todayISO={TODAY} />
        <TaskRow task={B} todayISO={TODAY} />
      </ul>
      <KeyboardShortcuts />
      <Probe />
    </>,
    ws,
  );
  return view;
}

const li = (id: string) => document.querySelector(`[data-task-id="${id}"]`) as HTMLElement;

describe("KeyboardShortcuts", () => {
  beforeEach(() => {
    Element.prototype.getBoundingClientRect = vi.fn(() => rect({})) as unknown as typeof Element.prototype.getBoundingClientRect;
    Element.prototype.scrollIntoView = vi.fn();
  });

  test("j selects the first row, k moves back", async () => {
    setup();
    await screen.findByText("First task");
    await userEvent.keyboard("j");
    expect(li(A.id)).toHaveAttribute("data-kbd-selected", "true");
    await userEvent.keyboard("j");
    expect(li(A.id)).not.toHaveAttribute("data-kbd-selected");
    expect(li(B.id)).toHaveAttribute("data-kbd-selected", "true");
    await userEvent.keyboard("k");
    expect(li(A.id)).toHaveAttribute("data-kbd-selected", "true");
  });

  test("keys are ignored while an input has focus", async () => {
    setup();
    await screen.findByText("First task");
    await userEvent.click(screen.getByLabelText("Quick add"));
    await userEvent.keyboard("j");
    expect(document.querySelector("[data-kbd-selected]")).toBeNull();
  });

  test("modifier chords are ignored", async () => {
    setup();
    await screen.findByText("First task");
    await userEvent.keyboard("{Meta>}j{/Meta}");
    expect(document.querySelector("[data-kbd-selected]")).toBeNull();
  });

  test("x completes the selected task", async () => {
    const { mock } = setup();
    await screen.findByText("First task");
    mock.respondWith("/complete", { task: { ...A, status: "done" }, next: null });
    await userEvent.keyboard("jx");
    await waitFor(() => expect(mock.calls.some((c) => c.url.includes(`${A.id}/complete`))).toBe(true));
  });

  test("t reschedules to tomorrow", async () => {
    const { mock } = setup();
    await screen.findByText("First task");
    await userEvent.keyboard("jt");
    await waitFor(() =>
      expect(JSON.stringify(mock.calls)).toContain(addDays(TODAY, 1)),
    );
  });

  test("e opens the task panel", async () => {
    setup();
    await screen.findByText("First task");
    await userEvent.keyboard("je");
    expect(screen.getByTestId("open-id")).toHaveTextContent(A.id);
  });

  test("Backspace trashes and moves the selection", async () => {
    const { mock } = setup();
    await screen.findByText("First task");
    await userEvent.keyboard("j{Backspace}");
    await waitFor(() => expect(mock.calls.some((c) => c.url.includes(A.id))).toBe(true));
    await waitFor(() => expect(li(B.id)).toHaveAttribute("data-kbd-selected", "true"));
  });

  test("f starts a focus session on the selected task", async () => {
    const { mock } = setup();
    await screen.findByText("First task");
    await userEvent.keyboard("jf");
    await waitFor(() => expect(mock.calls.some((c) => c.url.includes("/api/time-entries"))).toBe(true));
    expect(JSON.stringify(mock.calls.filter((c) => c.url.includes("/api/time-entries")))).toContain(A.id);
  });

  test("f inside an input does nothing", async () => {
    const { mock } = setup();
    await screen.findByText("First task");
    await userEvent.keyboard("j");
    await userEvent.click(screen.getByLabelText("Quick add"));
    await userEvent.keyboard("f");
    expect(mock.calls.some((c) => c.url.includes("/api/time-entries"))).toBe(false);
  });

  test("? opens the sheet", async () => {
    setup();
    await screen.findByText("First task");
    await userEvent.keyboard("?");
    expect(await screen.findByText("Keyboard shortcuts")).toBeInTheDocument();
  });

  test("/ focuses quick add without typing it", async () => {
    setup();
    await screen.findByText("First task");
    await userEvent.keyboard("/");
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById("doem-quick-add")));
    expect((document.activeElement as HTMLInputElement).value).toBe("");
  });
});
