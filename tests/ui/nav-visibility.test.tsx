import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NavVisibility from "@/components/settings/NavVisibility";
import { emptyWorkspace, renderWorkspace } from "./harness";

describe("nav visibility settings", () => {
  it("renders nothing before settings has loaded", () => {
    const { container } = renderWorkspace(<NavVisibility />);
    expect(container.textContent).toBe("");
  });

  it("the Settings toggle is disabled — there is no way back once it's hidden", async () => {
    renderWorkspace(<NavVisibility />);
    const toggle = await screen.findByRole("switch", { name: "Hide Settings" });
    expect(toggle).toBeDisabled();
  });

  it("toggling Trash patches hiddenNavItems", async () => {
    const { mock } = renderWorkspace(<NavVisibility />);
    const toggle = await screen.findByRole("switch", { name: "Hide Trash" });
    fireEvent.click(toggle);

    expect(mock.calls[0]).toMatchObject({
      url: "/api/tracking-settings",
      method: "PATCH",
      body: { hiddenNavItems: ["trash"] },
    });
  });

  it("the locked Settings row says it is always shown", async () => {
    renderWorkspace(<NavVisibility />);
    await screen.findByRole("switch", { name: "Hide Settings" });
    expect(screen.getByText("Always shown")).toBeTruthy();
  });
});
