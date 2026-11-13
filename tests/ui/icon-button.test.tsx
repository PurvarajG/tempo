import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import IconButton from "@/components/ui/IconButton";

describe("IconButton", () => {
  test("is found by its label and title equals label", () => {
    render(<IconButton icon="plus" label="Add task" />);
    const btn = screen.getByRole("button", { name: "Add task" });
    expect(btn).toHaveAttribute("title", "Add task");
    expect(btn).toHaveAttribute("type", "button");
  });

  test("click fires", () => {
    const onClick = vi.fn();
    render(<IconButton icon="plus" label="Add" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  test("disabled does not fire", () => {
    const onClick = vi.fn();
    render(<IconButton icon="plus" label="Add" disabled onClick={onClick} />);
    const btn = screen.getByRole("button", { name: "Add" });
    fireEvent.click(btn);
    expect(btn).toBeDisabled();
    expect(onClick).not.toHaveBeenCalled();
  });

  test("aria-pressed passes through", () => {
    render(<IconButton icon="moon" label="Theme" aria-pressed={true} />);
    const btn = screen.getByRole("button", { name: "Theme" });
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(btn.className).toContain("bg-sunk");
  });

  test("svg inside is aria-hidden", () => {
    render(<IconButton icon="plus" label="Add" />);
    const svg = screen.getByRole("button", { name: "Add" }).querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  test("shape tile changes the radius class", () => {
    const { rerender } = render(<IconButton icon="plus" label="Add" />);
    const round = screen.getByRole("button", { name: "Add" }).className;
    expect(round).toContain("rounded-full");
    rerender(<IconButton icon="plus" label="Add" shape="tile" />);
    const tile = screen.getByRole("button", { name: "Add" }).className;
    expect(tile).toContain("rounded-tile");
    expect(tile).not.toContain("rounded-full");
  });

  test("data-part is icon-btn for round and icon-tile for tile", () => {
    const { rerender } = render(<IconButton icon="plus" label="Add" />);
    expect(screen.getByRole("button", { name: "Add" })).toHaveAttribute("data-part", "icon-btn");
    rerender(<IconButton icon="plus" label="Add" shape="tile" />);
    expect(screen.getByRole("button", { name: "Add" })).toHaveAttribute("data-part", "icon-tile");
  });

  test("round is a 36px outlined circle, tile is a 32px square", () => {
    const { rerender } = render(<IconButton icon="plus" label="Add" />);
    let c = screen.getByRole("button", { name: "Add" }).className;
    expect(c).toContain("size-9");
    expect(c).toContain("ring-1");
    expect(c).toContain("ring-line");
    expect(c).toContain("text-ink-2");
    expect(c).not.toMatch(/(^| )bg-(surface|raised|sunk)/);
    rerender(<IconButton icon="plus" label="Add" shape="tile" />);
    c = screen.getByRole("button", { name: "Add" }).className;
    expect(c).toContain("size-8");
    expect(c).toContain("text-ink-3");
    expect(c).not.toContain("ring-1");
  });

  test("compact round is a 32px ringed circle with an ink-3 glyph", () => {
    render(<IconButton icon="trash" label="Trash" compact />);
    const c = screen.getByRole("button", { name: "Trash" }).className;
    expect(c).toContain("size-8");
    expect(c).not.toContain("size-9");
    expect(c).toContain("rounded-full");
    expect(c).toContain("ring-line");
    expect(c).toContain("text-ink-3");
  });
});
