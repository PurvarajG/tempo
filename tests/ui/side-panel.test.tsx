import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import Dialog from "@/components/ui/Dialog";
import SidePanel from "@/components/ui/SidePanel";

function Panel({ onClose, footer }: { onClose: () => void; footer?: boolean }) {
  return (
    <SidePanel open onClose={onClose} title="Task" footer={footer ? <button>Save</button> : undefined}>
      <input aria-label="Name" />
    </SidePanel>
  );
}

describe("SidePanel", () => {
  test("Escape calls onClose", () => {
    const onClose = vi.fn();
    render(<Panel onClose={onClose} />);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("close button and backdrop call onClose", async () => {
    const onClose = vi.fn();
    const { container } = render(<Panel onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Close panel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    const scrim = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    fireEvent.click(scrim);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  test("Tab and Shift+Tab wrap inside the panel", async () => {
    const user = userEvent.setup();
    render(<Panel onClose={() => {}} footer />);
    const save = screen.getByRole("button", { name: "Save" });
    const first = screen.getByRole("button", { name: "Close panel" });
    // jsdom has no layout, so offsetParent is null; give elements one.
    for (const el of [first, save, screen.getByLabelText("Name")]) {
      Object.defineProperty(el, "offsetParent", { get: () => document.body });
    }
    save.focus();
    await user.tab();
    expect(first).toHaveFocus();
    await user.tab({ shift: true });
    expect(save).toHaveFocus();
  });

  test("focus returns to the opener on close", () => {
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          <SidePanel open={open} onClose={() => setOpen(false)} title="Task">
            <input aria-label="Name" />
          </SidePanel>
        </>
      );
    }
    render(<Host />);
    const opener = screen.getByRole("button", { name: "Open" });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole("dialog", { name: "Task" })).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  describe("with a Dialog above it", () => {
    function Stack({ panelClose }: { panelClose: () => void }) {
      const [dialog, setDialog] = useState(true);
      return (
        <>
          <Panel onClose={panelClose} footer />
          <Dialog open={dialog} onClose={() => setDialog(false)} title="Timer">
            <input aria-label="Minutes" />
          </Dialog>
        </>
      );
    }

    test("Escape closes only the Dialog, then the panel", () => {
      const panelClose = vi.fn();
      render(<Stack panelClose={panelClose} />);
      fireEvent.keyDown(document.body, { key: "Escape" });
      expect(panelClose).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog", { name: "Timer" })).not.toBeInTheDocument();
      fireEvent.keyDown(document.body, { key: "Escape" });
      expect(panelClose).toHaveBeenCalledTimes(1);
    });

    test("Tab inside the Dialog is not trapped back into the panel", () => {
      render(<Stack panelClose={() => {}} />);
      const input = screen.getByLabelText("Minutes");
      input.focus();
      const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
      input.dispatchEvent(event);
      // Dialog's only focusable is the input, so Dialog itself wraps; the panel must not act.
      expect(screen.getByRole("dialog", { name: "Task" })).toBeInTheDocument();
      expect(screen.getByLabelText("Name")).not.toHaveFocus();
    });
  });
});
