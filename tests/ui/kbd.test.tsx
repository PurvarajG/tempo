import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import Kbd from "@/components/ui/Kbd";

describe("Kbd", () => {
  test("renders children inside a kbd element", () => {
    render(<Kbd>Esc</Kbd>);

    const el = screen.getByText("Esc");
    expect(el.tagName).toBe("KBD");
  });

  test("keys renders one nested kbd per key", () => {
    const { container } = render(<Kbd keys={["⌘", "K"]} />);

    const outer = container.querySelector("kbd") as HTMLElement;
    const nested = outer.querySelectorAll("kbd");
    expect(nested).toHaveLength(2);
    expect(nested[0]).toHaveTextContent("⌘");
    expect(nested[1]).toHaveTextContent("K");
  });

  test("className merges with the base classes", () => {
    render(<Kbd className="ml-auto">N</Kbd>);

    const el = screen.getByText("N");
    expect(el).toHaveClass("ml-auto");
    expect(el).toHaveClass("font-mono");
  });

  test("root is inline text: no flex, no gap, keys read as '⌘ K'", () => {
    const { container } = render(<Kbd keys={["⌘", "K"]} />);
    const outer = container.querySelector("kbd") as HTMLElement;
    const classes = outer.className.split(/\s+/);
    expect(classes.some((c) => /(^|:)gap-/.test(c))).toBe(false);
    expect(classes).not.toContain("flex");
    expect(classes).not.toContain("inline-flex");
    expect(outer.textContent).toBe("⌘ K");
  });

  test("root carries data-part kbd, a ring and no shadow", () => {
    render(<Kbd>K</Kbd>);
    const el = screen.getByText("K");
    expect(el).toHaveAttribute("data-part", "kbd");
    expect(el).toHaveClass("ring-1", "ring-line", "bg-surface", "rounded-full", "text-caption");
    expect(el.className).not.toContain("shadow");
  });
});
