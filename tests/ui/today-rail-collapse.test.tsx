import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import Today from "@/components/Today";
import { emptyWorkspace, renderWorkspace } from "./harness";

vi.mock("@/lib/useNow", () => ({
  useNow: () => new Date("2026-08-14T12:00:00"),
}));

const settings = (collapsedModules: string[]) => ({
  ...emptyWorkspace().trackingSettings,
  collapsedModules,
});

describe("Today's Notepad card", () => {
  test("starts collapsed and opens through patchSettings, keeping the other collapsedModules keys", async () => {
    const { mock } = renderWorkspace(
      <Today />,
      emptyWorkspace({ trackingSettings: settings(["records", "rollups"]) }),
    );

    const toggle = await screen.findByRole("button", { name: "Expand Notepad" });
    // Let tracking settings arrive before clicking; the guard ignores earlier clicks.
    await vi.waitFor(() => {
      fireEvent.click(toggle);
      expect(mock.calls.some((c) => c.url === "/api/tracking-settings")).toBe(true);
    });

    expect(mock.calls.at(-1)).toMatchObject({
      url: "/api/tracking-settings",
      method: "PATCH",
      body: { collapsedModules: ["records", "rollups", "today-notepad:open"] },
    });
    expect(screen.getByRole("button", { name: "Collapse Notepad" })).toBeInTheDocument();
  });

  test("a saved open state renders open on load", async () => {
    renderWorkspace(<Today />, emptyWorkspace({ trackingSettings: settings(["today-notepad:open"]) }));

    expect(await screen.findByRole("button", { name: "Collapse Notepad" })).toBeInTheDocument();
  });
});
