import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DesktopBridge from "@/components/DesktopBridge";
import { useTasks } from "@/lib/store-context";
import { renderWorkspace } from "./harness";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

const revert = vi.fn();

function Probe() {
  const { offerUndo, undoOffer } = useTasks();
  return (
    <>
      <button onClick={() => offerUndo("Marked done", revert)}>offer</button>
      <input aria-label="field" />
      <span data-testid="offer">{undoOffer ? "yes" : "no"}</span>
    </>
  );
}

function setup() {
  renderWorkspace(
    <>
      <DesktopBridge />
      <Probe />
    </>,
  );
}

function offer() {
  act(() => screen.getByText("offer").click());
}

function press(init: KeyboardEventInit, target: Element | Document = document.body) {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

afterEach(() => {
  revert.mockReset();
  vi.unstubAllGlobals();
});

describe("DesktopBridge undo shortcut", () => {
  it("Cmd+Z with focus on body reverts once and clears the offer", () => {
    setup();
    offer();
    const e = press({ key: "z", metaKey: true });
    expect(revert).toHaveBeenCalledTimes(1);
    expect(e.defaultPrevented).toBe(true);
    expect(screen.getByTestId("offer").textContent).toBe("no");
  });

  it("Ctrl+Z does too", () => {
    setup();
    offer();
    press({ key: "z", ctrlKey: true });
    expect(revert).toHaveBeenCalledTimes(1);
  });

  it("leaves native undo alone while an input has focus", () => {
    setup();
    offer();
    const input = screen.getByLabelText("field");
    input.focus();
    const e = press({ key: "z", metaKey: true }, input);
    expect(revert).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
  });

  it("ignores Cmd+Shift+Z", () => {
    setup();
    offer();
    const e = press({ key: "z", metaKey: true, shiftKey: true });
    expect(revert).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
  });

  it("does not preventDefault when there is no offer", () => {
    setup();
    const e = press({ key: "z", metaKey: true });
    expect(revert).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
  });

  it("still works when window.doem exists (Electron)", () => {
    vi.stubGlobal("doem", {
      onCommand: vi.fn(() => vi.fn()),
      setBadge: vi.fn(),
      setTimerStatus: vi.fn(),
      setCanToggleTimer: vi.fn(),
    });
    setup();
    offer();
    press({ key: "z", metaKey: true });
    expect(revert).toHaveBeenCalledTimes(1);
  });
});
