import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import ShortcutSheet from "@/components/ShortcutSheet";
import { GLOBAL_SHORTCUTS, SHORTCUTS } from "@/lib/shortcuts";

describe("ShortcutSheet", () => {
  test("renders every label and key when open", () => {
    render(<ShortcutSheet open onClose={() => {}} />);
    expect(screen.getByText("Keyboard shortcuts")).toBeInTheDocument();
    expect(screen.getByText("Task rows")).toBeInTheDocument();
    expect(screen.getByText("Anywhere")).toBeInTheDocument();
    for (const s of SHORTCUTS) {
      expect(screen.getByText(s.label)).toBeInTheDocument();
      for (const key of s.keys) expect(screen.getAllByText(key).length).toBeGreaterThan(0);
    }
    for (const s of GLOBAL_SHORTCUTS) {
      expect(screen.getByText(s.label)).toBeInTheDocument();
    }
  });

  test("combined keys share one chip", () => {
    const { container } = render(<ShortcutSheet open onClose={() => {}} />);
    const combo = GLOBAL_SHORTCUTS[0];
    const chip = Array.from(container.ownerDocument.querySelectorAll("kbd")).find(
      (k) => k.querySelectorAll("kbd").length === combo.keys.length,
    );
    expect(chip).toBeTruthy();
  });

  test("renders nothing when closed", () => {
    render(<ShortcutSheet open={false} onClose={() => {}} />);
    expect(screen.queryByText("Keyboard shortcuts")).toBeNull();
  });

  test("Escape calls onClose", () => {
    const onClose = vi.fn();
    render(<ShortcutSheet open onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
