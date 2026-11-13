import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DesktopSection from "@/components/settings/DesktopSection";
import { DESKTOP_BUILT, hasDesktopOptions } from "@/lib/desktop-options";
import TrackingSettings from "@/components/tracking/settings/TrackingSettings";
import { emptyWorkspace, renderWorkspace } from "./harness";

describe("TrackingSettings", () => {
  it("shows a placeholder first, then the four blocks", async () => {
    renderWorkspace(<TrackingSettings />, emptyWorkspace());
    for (const name of ["Categories", "Activities", "Gap rules", "Dashboard modules"]) {
      expect(await screen.findByRole("heading", { name, level: 3 })).toBeTruthy();
    }
    expect(screen.queryByTestId("tracking-settings-loading")).toBeNull();
  });
});

describe("DesktopSection", () => {
  it("shows the built options, Claude awareness included", async () => {
    expect(DESKTOP_BUILT).toEqual({
      captureShortcut: true,
      dockBadge: true,
      nudge: true,
      claudeAwareness: true,
    });
    expect(hasDesktopOptions()).toBe(true);
    const { container } = renderWorkspace(<DesktopSection />, emptyWorkspace());
    expect(await screen.findByText("Capture shortcut")).toBeTruthy();
    expect(container.querySelectorAll("li")).toHaveLength(4);
    expect(screen.getByText("Claude Code awareness", { selector: "span" })).toBeTruthy();
  });
});
