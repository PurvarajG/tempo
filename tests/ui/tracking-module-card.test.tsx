import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ModuleCard from "@/components/tracking/ModuleCard";

describe("ModuleCard", () => {
  it("renders a sentence-case heading and an icon tile", () => {
    const { container } = render(
      <ModuleCard title="Gaps today" icon="clock">
        body
      </ModuleCard>,
    );
    const h = screen.getByRole("heading", { name: "Gaps today" });
    expect(h.className).not.toMatch(/uppercase|font-mono/);
    expect(container.querySelector("span.size-7 svg")).not.toBeNull();
  });

  it("controlled collapse calls onToggleCollapse and hides the body", () => {
    const onToggle = vi.fn();
    render(
      <ModuleCard title="Now" icon="clock" collapsed onToggleCollapse={onToggle}>
        body text
      </ModuleCard>,
    );
    expect(screen.queryByText("body text")).toBeNull();
    const btn = screen.getByRole("button", { name: "Expand Now" });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("uncontrolled default collapse toggles and flips aria-expanded", () => {
    render(
      <ModuleCard title="Day ribbon" icon="clock" defaultCollapsed>
        body text
      </ModuleCard>,
    );
    expect(screen.queryByText("body text")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Expand Day ribbon" }));
    expect(screen.getByText("body text")).toBeTruthy();
    const btn = screen.getByRole("button", { name: "Collapse Day ribbon" });
    expect(btn.getAttribute("aria-expanded")).toBe("true");
  });

  it("collapsible=false has no button and always shows the body", () => {
    render(
      <ModuleCard title="Now" icon="clock" collapsible={false} defaultCollapsed>
        body text
      </ModuleCard>,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("body text")).toBeTruthy();
  });
});
