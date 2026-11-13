import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DesktopSection from "@/components/settings/DesktopSection";
import { emptyWorkspace, renderWorkspace } from "./harness";

type Status = { shortcut: string; registered: boolean } | null;

afterEach(() => {
  delete (window as unknown as { doem?: unknown }).doem;
});

function stubBridge(status: Status) {
  let cb: ((s: Status) => void) | null = null;
  (window as unknown as { doem: unknown }).doem = {
    getCaptureStatus: vi.fn(async () => status),
    onCaptureStatus: vi.fn((fn: (s: Status) => void) => {
      cb = fn;
      return () => {
        cb = null;
      };
    }),
  };
  return { emit: (s: Status) => cb?.(s) };
}

function workspace(settings: object = {}) {
  const w = emptyWorkspace();
  w.trackingSettings = { ...w.trackingSettings, ...settings };
  return w;
}

const FAIL = "Doem could not register this shortcut. Another app may be using it.";

describe("DesktopSection", () => {
  it("renders the four rows with the Mac-form shortcut and no select", async () => {
    const { container } = renderWorkspace(<DesktopSection />, workspace());
    expect(await screen.findByText("Capture shortcut")).toBeTruthy();
    expect(screen.getByText("Dock badge", { selector: "span" })).toBeTruthy();
    expect(screen.getByText("Not tracking nudge", { selector: "span" })).toBeTruthy();
    expect(screen.getByText("Claude Code awareness", { selector: "span" })).toBeTruthy();
    expect(container.querySelectorAll("li")).toHaveLength(4);
    expect(container.querySelector("kbd")?.textContent).toBe("⌃ ⌥ Space");
    expect(container.querySelector("select")).toBeNull();
  });

  it("says so when the shortcut cannot be registered, and clears when it can", async () => {
    const bridge = stubBridge({ shortcut: "Control+Alt+Space", registered: false });
    renderWorkspace(<DesktopSection />, workspace());
    expect(await screen.findByText(FAIL)).toBeTruthy();
    act(() => bridge.emit({ shortcut: "Control+Alt+Space", registered: true }));
    await waitFor(() => expect(screen.queryByText(FAIL)).toBeNull());
  });

  it("keeps the normal description without a bridge", async () => {
    renderWorkspace(<DesktopSection />, workspace());
    expect(await screen.findByText("Opens quick capture from anywhere on your Mac.")).toBeTruthy();
  });

  it("has Off selected by default and patches nudgeMinutes", async () => {
    const { mock } = renderWorkspace(<DesktopSection />, workspace());
    const off = await screen.findByRole("radio", { name: "Off" });
    expect(off.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: "30m" }));
    await waitFor(() => expect(mock.calls.at(-1)?.body).toEqual({ nudgeMinutes: 30 }));
    fireEvent.click(screen.getByRole("radio", { name: "Off" }));
    await waitFor(() => expect(mock.calls.at(-1)?.body).toEqual({ nudgeMinutes: null }));
  });

  it("has Claude Code awareness on by default and patches claudeAwareness", async () => {
    const { mock } = renderWorkspace(<DesktopSection />, workspace());
    const toggle = await screen.findByRole("switch", { name: "Claude Code awareness" });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText(/never changes them/)).toBeTruthy();
    fireEvent.click(toggle);
    await waitFor(() => expect(mock.calls.at(-1)?.body).toEqual({ claudeAwareness: false }));
  });

  it("patches the Dock badge to none", async () => {
    const { mock } = renderWorkspace(<DesktopSection />, workspace());
    fireEvent.click(await screen.findByRole("switch", { name: "Dock badge" }));
    await waitFor(() => expect(mock.calls.at(-1)?.body).toEqual({ dockBadge: "none" }));
  });
});
