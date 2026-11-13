import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import PostponeButton from "@/components/ui/PostponeButton";
import { fmtDate } from "@/lib/format";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

const TODAY = "2026-11-12"; // a Thursday
const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const rect = (r: Partial<DOMRect>): DOMRect =>
  ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => {}, ...r }) as DOMRect;

function stubRects() {
  Element.prototype.getBoundingClientRect = vi.fn(function (this: Element) {
    if (this.hasAttribute("data-picker-menu")) return rect({ height: 300, width: 180 });
    if (this.getAttribute("aria-haspopup") === "menu")
      return rect({ top: 100, bottom: 136, left: 20, right: 56, width: 36, height: 36 });
    return rect({});
  }) as unknown as typeof Element.prototype.getBoundingClientRect;
}

function setup(props: { onTomorrow?: () => void } = {}) {
  stubRects();
  const task = makeTask({ id: ID, scheduled: TODAY });
  const r = renderWorkspace(
    <PostponeButton task={task} todayISO={TODAY} {...props} />,
    emptyWorkspace({ tasks: [task] }),
  );
  r.mock.respondWith("/api/tasks/reschedule", [makeTask({ id: ID, scheduled: "2026-11-13" })]);
  return r;
}

const lastBody = (mock: ReturnType<typeof setup>["mock"]) => mock.calls.at(-1)?.body as Record<string, unknown>;

function setupPick(scheduled: string | null) {
  stubRects();
  const task = makeTask({ id: ID, scheduled });
  const r = renderWorkspace(
    <PostponeButton task={task} todayISO={TODAY} variant="pick" />,
    emptyWorkspace({ tasks: [task] }),
  );
  r.mock.respondWith("/api/tasks/reschedule", [makeTask({ id: ID, scheduled: "2026-11-13" })]);
  return r;
}

afterEach(() => vi.restoreAllMocks());

describe("PostponeButton", () => {
  it("click moves the task to tomorrow", async () => {
    const { mock } = setup();
    await userEvent.setup().click(screen.getByRole("button", { name: "Not today" }));
    await waitFor(() => expect(mock.calls.some((c) => c.url === "/api/tasks/reschedule")).toBe(true));
    const body = lastBody(mock);
    expect(body.day).toBe("2026-11-13");
    expect(body.ids).toEqual([ID]);
  });

  it("onTomorrow overrides the default move", async () => {
    const onTomorrow = vi.fn();
    const { mock } = setup({ onTomorrow });
    await userEvent.setup().click(screen.getByRole("button", { name: "Not today" }));
    expect(onTomorrow).toHaveBeenCalledTimes(1);
    expect(mock.calls).toHaveLength(0);
  });

  it("right-click opens 6 days, Next week and No date", () => {
    const { mock } = setup();
    fireEvent.contextMenu(screen.getByRole("button", { name: "Not today" }));
    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(8);
    expect(items[0]).toHaveTextContent(fmtDate("2026-11-14"));
    expect(items[5]).toHaveTextContent(fmtDate("2026-11-19"));
    expect(items[6]).toHaveTextContent("Next week");
    expect(items[7]).toHaveTextContent("No date");
    expect(mock.calls).toHaveLength(0);
  });

  it("Next week picks the coming Monday", async () => {
    const { mock } = setup();
    fireEvent.contextMenu(screen.getByRole("button", { name: "Not today" }));
    await userEvent.setup().click(screen.getByRole("menuitem", { name: "Next week" }));
    await waitFor(() => expect(mock.calls).toHaveLength(1));
    expect(lastBody(mock).day).toBe("2026-11-16");
  });

  it("No date reschedules to null", async () => {
    const { mock } = setup();
    fireEvent.contextMenu(screen.getByRole("button", { name: "Not today" }));
    await userEvent.setup().click(screen.getByRole("menuitem", { name: "No date" }));
    await waitFor(() => expect(mock.calls).toHaveLength(1));
    expect(lastBody(mock).day).toBeNull();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("Escape closes and returns focus to the button", async () => {
    setup();
    const button = screen.getByRole("button", { name: "Not today" });
    fireEvent.contextMenu(button);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await userEvent.setup().keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    await waitFor(() => expect(button).toHaveFocus());
  });

  it("ArrowDown on the focused button opens the menu", async () => {
    setup();
    screen.getByRole("button", { name: "Not today" }).focus();
    await userEvent.setup().keyboard("{ArrowDown}");
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("a long press opens the menu and does not fire the click", async () => {
    vi.useFakeTimers();
    try {
      const { mock } = setup();
      const button = screen.getByRole("button", { name: "Not today" });
      fireEvent.pointerDown(button, { button: 0 });
      await vi.advanceTimersByTimeAsync(600);
      fireEvent.pointerUp(button);
      fireEvent.click(button);
      expect(screen.getByRole("menu")).toBeInTheDocument();
      expect(mock.calls).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  describe("pick variant", () => {
    it("renders a 'Pick a day' button and a click opens the menu without moving the task", async () => {
      const { mock } = setupPick(null);
      expect(screen.queryByRole("button", { name: "Not today" })).toBeNull();
      expect(screen.getByRole("button", { name: "Pick a day" })).toHaveAttribute("data-variant", "chip");
      await userEvent.setup().click(screen.getByRole("button", { name: "Pick a day" }));
      expect(screen.getByRole("menu", { name: "Move to another day" })).toBeInTheDocument();
      expect(mock.calls).toHaveLength(0);
    });

    it("lists Tomorrow first and choosing it reschedules to tomorrow", async () => {
      const { mock } = setupPick(null);
      await userEvent.setup().click(screen.getByRole("button", { name: "Pick a day" }));
      const items = screen.getAllByRole("menuitem");
      expect(items[0]).toHaveTextContent("Tomorrow");
      expect(items[1]).toHaveTextContent(fmtDate("2026-11-14"));
      await userEvent.setup().click(items[0]);
      await waitFor(() => expect(mock.calls).toHaveLength(1));
      expect(lastBody(mock).day).toBe("2026-11-13");
    });

    it("leaves out No date for an undated task and keeps it for a dated one", () => {
      setupPick(null);
      fireEvent.click(screen.getByRole("button", { name: "Pick a day" }));
      expect(screen.queryByRole("menuitem", { name: "No date" })).toBeNull();
    });

    it("keeps No date for a dated task", () => {
      setupPick(TODAY);
      fireEvent.click(screen.getByRole("button", { name: "Pick a day" }));
      expect(screen.getByRole("menuitem", { name: "No date" })).toBeInTheDocument();
    });
  });
});
