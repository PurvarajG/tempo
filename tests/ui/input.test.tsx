import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import Input from "@/components/ui/Input";

describe("Input", () => {
  test("renders a textbox with its aria-label", () => {
    render(<Input aria-label="Task title" />);
    expect(screen.getByRole("textbox", { name: "Task title" })).toBeInTheDocument();
  });

  test("typing calls onChange", () => {
    const onChange = vi.fn();
    render(<Input aria-label="Task title" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Plan" } });
    expect(onChange).toHaveBeenCalledOnce();
  });

  test("ref reaches the input element", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input aria-label="Task title" ref={ref} />);
    expect(ref.current).toBe(screen.getByRole("textbox"));
  });

  test("renders leading and trailing slots", () => {
    render(
      <Input
        aria-label="Task title"
        leading={<span data-testid="lead" />}
        trailing={<span data-testid="trail" />}
      />,
    );
    expect(screen.getByTestId("lead")).toBeInTheDocument();
    expect(screen.getByTestId("trail")).toBeInTheDocument();
  });

  test("invalid sets aria-invalid", () => {
    render(<Input aria-label="Task title" invalid />);
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });

  test("disabled disables the input", () => {
    render(<Input aria-label="Task title" disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  test("variant changes the wrapper classes", () => {
    const wrapperOf = () => screen.getByRole("textbox").parentElement as HTMLElement;
    const { rerender } = render(<Input aria-label="Task title" />);
    expect(wrapperOf().className).toContain("rounded-row");
    rerender(<Input aria-label="Task title" variant="composer" />);
    expect(wrapperOf().className).toContain("rounded-composer");
    rerender(<Input aria-label="Task title" variant="search" />);
    expect(wrapperOf().className).toContain("rounded-full");
  });
});
