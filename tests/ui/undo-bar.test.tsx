import { act, fireEvent, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UndoBar from "@/components/ui/UndoBar";
import { useTasks } from "@/lib/store-context";
import { renderWorkspace } from "./harness";

type Api = ReturnType<typeof useTasks>;
const probe: { api: Api | null } = { api: null };
const offer = (...args: Parameters<Api["offerUndo"]>) => probe.api?.offerUndo(...args);

function Probe() {
  const tasks = useTasks();
  useEffect(() => {
    probe.api = tasks;
  });
  return null;
}

function setup() {
  return renderWorkspace(
    <>
      <Probe />
      <UndoBar />
    </>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("UndoBar", () => {
  it("renders an empty live region when there is no offer", () => {
    setup();
    const region = screen.getByRole("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.textContent).toBe("");
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  it("shows the label and Undo reverts once and hides the bar", async () => {
    setup();
    const revert = vi.fn();
    act(() => offer("Task deleted", revert));
    expect(screen.getByText("Task deleted")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    });
    expect(revert).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Task deleted")).toBeNull();
  });

  it("replaces the label on a second offer", () => {
    setup();
    act(() => offer("First", vi.fn()));
    act(() => offer("Second", vi.fn()));
    expect(screen.queryByText("First")).toBeNull();
    expect(screen.getByText("Second")).toBeTruthy();
  });

  it("runs the optional action and hides the bar", async () => {
    setup();
    const run = vi.fn();
    const revert = vi.fn();
    act(() => offer("Moved", revert, { label: "View", run }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "View" }));
    });
    expect(run).toHaveBeenCalledTimes(1);
    expect(revert).not.toHaveBeenCalled();
    expect(screen.queryByText("Moved")).toBeNull();
  });

  it("disappears after 6000ms", () => {
    setup();
    act(() => offer("Gone soon", vi.fn()));
    act(() => {
      vi.advanceTimersByTime(5900);
    });
    expect(screen.getByText("Gone soon")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText("Gone soon")).toBeNull();
  });
});
