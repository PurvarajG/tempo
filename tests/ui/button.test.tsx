import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import Button from "@/components/ui/Button";

describe("Button", () => {
  test("defaults to type=button", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  test("click fires onClick", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  test("disabled does not fire onClick", () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Save</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  test("loading is busy, disabled, keeps label, no click", () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Save</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent("Save");
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  test("icon renders an aria-hidden svg", () => {
    const { container } = render(<Button icon="plus" iconAfter="chev">Add</Button>);
    const svgs = container.querySelectorAll("svg");
    expect(svgs).toHaveLength(2);
    svgs.forEach((s) => expect(s).toHaveAttribute("aria-hidden", "true"));
  });

  test("variant classes differ", () => {
    const { rerender } = render(<Button variant="primary">A</Button>);
    const primary = screen.getByRole("button").className;
    expect(primary).toContain("bg-accent");
    rerender(<Button variant="ghost">A</Button>);
    const ghost = screen.getByRole("button").className;
    expect(ghost).not.toContain("bg-accent");
    rerender(<Button variant="chip">A</Button>);
    const chip = screen.getByRole("button").className;
    expect(chip).toContain("inset-ring");
    expect(new Set([primary, ghost, chip]).size).toBe(3);
  });

  test("danger primary uses bg-hi", () => {
    render(<Button variant="primary" tone="danger">Delete</Button>);
    expect(screen.getByRole("button").className).toContain("bg-hi");
  });

  test("aria-pressed passes through and shows pressed style", () => {
    render(<Button variant="chip" aria-pressed="true">Mon</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(btn.className).toContain("bg-sunk");
  });

  test("ref reaches the button", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Save</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  test("data-part and data-variant follow the variant", () => {
    const { rerender } = render(<Button variant="primary">A</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("data-part", "btn");
    expect(btn).toHaveAttribute("data-variant", "primary");
    rerender(<Button>A</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("data-variant", "ghost");
    rerender(<Button variant="chip">A</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("data-variant", "chip");
  });

  test("mockup forms: primary filled with shadow, ghost plain, chip ring only, sm sizes", () => {
    const { rerender } = render(<Button variant="primary">A</Button>);
    let c = screen.getByRole("button").className;
    expect(c).toContain("h-9");
    expect(c).toContain("px-4");
    expect(c).toContain("text-secondary");
    expect(c).toContain("shadow-primary");
    expect(c).toContain("active:scale-[.97]");
    rerender(<Button variant="ghost">A</Button>);
    c = screen.getByRole("button").className;
    expect(c).toContain("text-ink-2");
    expect(c).toContain("hover:bg-sunk");
    expect(c).not.toContain("inset-ring");
    rerender(<Button variant="chip">A</Button>);
    c = screen.getByRole("button").className;
    expect(c).toContain("inset-ring-line-2");
    expect(c).not.toMatch(/(^| )bg-(accent|surface|raised)/);
    rerender(<Button variant="chip" size="sm">A</Button>);
    c = screen.getByRole("button").className;
    expect(c).toContain("h-[30px]");
    expect(c).toContain("px-3");
    expect(c).toContain("text-meta");
    expect(c).toContain("text-ink");
  });
});
