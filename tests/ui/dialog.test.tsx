import { useRef, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import Dialog from "@/components/ui/Dialog";

function setup(props: Partial<React.ComponentProps<typeof Dialog>> = {}) {
  const onClose = vi.fn();
  render(
    <Dialog
      open
      onClose={onClose}
      title="Remove stage"
      description="This moves its tasks."
      actions={
        <>
          <button>Cancel</button>
          <button>Remove</button>
        </>
      }
      {...props}
    >
      <input aria-label="Name" />
    </Dialog>,
  );
  return onClose;
}

describe("Dialog", () => {
  test("closed renders nothing", () => {
    setup({ open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("open renders a named, described modal", () => {
    setup();
    const dialog = screen.getByRole("dialog", { name: "Remove stage" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("This moves its tasks.");
  });

  test("alertdialog role is supported", () => {
    setup({ role: "alertdialog" });
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  test("Escape calls onClose and stops before document bubble listeners", () => {
    const onClose = setup();
    const bubble = vi.fn();
    document.addEventListener("keydown", bubble);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    document.removeEventListener("keydown", bubble);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(bubble).not.toHaveBeenCalled();
  });

  test("Escape still closes when not dismissible", () => {
    const onClose = setup({ dismissible: false });
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("backdrop click closes; surface click does not", async () => {
    const onClose = setup();
    const dialog = screen.getByRole("dialog");
    await userEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(dialog.parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("backdrop spacer is first child and also dismisses", async () => {
    const onClose = setup();
    const backdrop = screen.getByRole("dialog").parentElement as HTMLElement;
    const spacer = backdrop.firstElementChild as HTMLElement;
    expect(spacer).toHaveClass("no-drag", "h-9");
    await userEvent.click(spacer);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("dismissible false ignores backdrop click", async () => {
    const onClose = setup({ dismissible: false });
    await userEvent.click(screen.getByRole("dialog").parentElement as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();
  });

  test("focus moves in, and Tab wraps both ways", async () => {
    setup();
    const name = screen.getByLabelText("Name");
    const remove = screen.getByRole("button", { name: "Remove" });
    expect(name).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(remove).toHaveFocus();
    await userEvent.tab();
    expect(name).toHaveFocus();
  });

  test("falls back to the surface when nothing is focusable", () => {
    render(<Dialog open onClose={() => {}} title="Hi" />);
    expect(screen.getByRole("dialog")).toHaveFocus();
  });

  test("initial focus lands on a control, not the surface, and the surface has no outline removal", () => {
    setup();
    const dialog = screen.getByRole("dialog");
    expect(dialog).not.toHaveFocus();
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(["INPUT", "BUTTON"]).toContain(document.activeElement?.tagName);
    expect(dialog.className).not.toMatch(/outline/);
  });

  test("with only actions, initial focus lands on the first action button", () => {
    render(
      <Dialog
        open
        onClose={() => {}}
        title="Hi"
        actions={
          <>
            <button>Cancel</button>
            <button>Delete</button>
          </>
        }
      />,
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(screen.getByRole("dialog")).not.toHaveFocus();
  });

  test("initialFocusRef wins", () => {
    function Host() {
      const ref = useRef<HTMLButtonElement>(null);
      return (
        <Dialog
          open
          onClose={() => {}}
          title="Hi"
          initialFocusRef={ref}
          actions={
            <>
              <button>Cancel</button>
              <button ref={ref}>Delete</button>
            </>
          }
        />
      );
    }
    render(<Host />);
    expect(screen.getByRole("button", { name: "Delete" })).toHaveFocus();
  });

  test("focus returns to the opener after close", async () => {
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          <Dialog open={open} onClose={() => setOpen(false)} title="Hi" />
        </>
      );
    }
    render(<Host />);
    const opener = screen.getByRole("button", { name: "Open" });
    await userEvent.click(opener);
    expect(screen.getByRole("dialog")).toHaveFocus();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
