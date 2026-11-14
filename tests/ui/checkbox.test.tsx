import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import Checkbox from "@/components/ui/Checkbox";

describe("Checkbox", () => {
  test("exposes role checkbox with its accessible name", () => {
    render(<Checkbox checked={false} onCheckedChange={() => {}} label="Book van" />);
    expect(screen.getByRole("checkbox", { name: "Book van" })).toBeInTheDocument();
  });

  test("aria-checked reflects the prop", () => {
    const { rerender } = render(
      <Checkbox checked={false} onCheckedChange={() => {}} label="Task" />,
    );
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "false");
    rerender(<Checkbox checked onCheckedChange={() => {}} label="Task" />);
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
  });

  test("click calls onCheckedChange with the opposite value", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <Checkbox checked={false} onCheckedChange={onChange} label="Task" />,
    );
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenLastCalledWith(true);
    rerender(<Checkbox checked onCheckedChange={onChange} label="Task" />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  test("click does not reach a parent onClick", () => {
    const parent = vi.fn();
    render(
      <div onClick={parent}>
        <Checkbox checked={false} onCheckedChange={() => {}} label="Task" />
      </div>,
    );
    fireEvent.click(screen.getByRole("checkbox"));
    expect(parent).not.toHaveBeenCalled();
  });

  test("disabled does not call onCheckedChange", () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onCheckedChange={onChange} label="Task" disabled />);
    const box = screen.getByRole("checkbox");
    expect(box).toBeDisabled();
    fireEvent.click(box);
    expect(onChange).not.toHaveBeenCalled();
  });

  test("Space toggles via keyboard", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox checked={false} onCheckedChange={onChange} label="Task" />);
    await user.tab();
    await user.keyboard(" ");
    expect(onChange).toHaveBeenCalledWith(true);
  });

  test("check icon is only rendered when checked", () => {
    const { container, rerender } = render(
      <Checkbox checked={false} onCheckedChange={() => {}} label="Task" />,
    );
    expect(container.querySelector("svg")).toBeNull();
    rerender(<Checkbox checked onCheckedChange={() => {}} label="Task" />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  test("root carries data-part chk and the mockup box classes", () => {
    render(<Checkbox checked={false} onCheckedChange={() => {}} label="Task" />);
    const box = screen.getByRole("checkbox");
    expect(box).toHaveAttribute("data-part", "chk");
    expect(box).toHaveClass("size-[18px]", "rounded-check", "bg-surface", "inset-ring-line-strong", "hover:inset-ring-ink-3");
  });

  test("checked fills with ink and shows a surface-coloured check", () => {
    const { container } = render(<Checkbox checked onCheckedChange={() => {}} label="Task" />);
    expect(screen.getByRole("checkbox")).toHaveClass("bg-ink", "inset-ring-0");
    expect(container.querySelector("svg")).toHaveClass("text-surface");
  });
});
