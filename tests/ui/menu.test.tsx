import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import Menu, { type MenuItem } from "@/components/ui/Menu";

const rect = (r: Partial<DOMRect>): DOMRect =>
  ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => {}, ...r }) as DOMRect;

function stubRects() {
  Element.prototype.getBoundingClientRect = vi.fn(function (this: Element) {
    if (this.hasAttribute("data-picker-menu")) return rect({ height: 120, width: 180 });
    if (this.getAttribute("aria-haspopup") === "menu")
      return rect({ top: 100, bottom: 136, left: 20, right: 100, width: 80, height: 36 });
    return rect({});
  }) as unknown as typeof Element.prototype.getBoundingClientRect;
}

function setup(overrides: Partial<Record<string, MenuItem["onSelect"]>> = {}) {
  stubRects();
  const fns = {
    a: overrides.a ?? vi.fn(),
    b: overrides.b ?? vi.fn(),
    c: overrides.c ?? vi.fn(),
  };
  const items: MenuItem[] = [
    { id: "a", label: "Rename", disabled: true, onSelect: fns.a },
    { id: "b", label: "Duplicate", onSelect: fns.b },
    { id: "c", label: "Trash", danger: true, onSelect: fns.c },
  ];
  const utils = render(
    <div data-testid="host">
      <Menu label="Actions" items={items} />
      <button type="button">outside</button>
    </div>,
  );
  return { fns, ...utils };
}

afterEach(() => vi.restoreAllMocks());

describe("Menu", () => {
  test("trigger toggles aria-expanded", async () => {
    setup();
    const user = userEvent.setup();
    const trigger = screen.getByRole("button", { name: "Actions" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  test("items render in a portal on document.body", async () => {
    setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Actions" }));
    const menu = screen.getByRole("menu");
    expect(menu.parentElement).toBe(document.body);
    expect(screen.getByTestId("host")).not.toContainElement(menu);
    expect(screen.getAllByRole("menuitem")).toHaveLength(3);
  });

  test("clicking an item calls onSelect once and closes", async () => {
    const { fns } = setup();
    const user = userEvent.setup();
    const trigger = screen.getByRole("button", { name: "Actions" });
    await user.click(trigger);
    await user.click(screen.getByRole("menuitem", { name: "Duplicate" }));
    expect(fns.b).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  test("ArrowDown then Enter selects the first enabled item", async () => {
    const { fns } = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Actions" }));
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Actions" })).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("menuitem", { name: "Duplicate" }).id,
    );
    await user.keyboard("{Enter}");
    expect(fns.b).toHaveBeenCalledTimes(1);
    expect(fns.a).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  test("disabled items are skipped and not selectable", async () => {
    const { fns } = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Actions" }));
    const disabled = screen.getByRole("menuitem", { name: "Rename" });
    expect(disabled).toHaveAttribute("aria-disabled", "true");
    await user.click(disabled);
    expect(fns.a).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(fns.c).toHaveBeenCalledTimes(1);
    expect(fns.a).not.toHaveBeenCalled();
  });

  test("Escape closes", async () => {
    setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Actions" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  test("outside pointerdown closes", async () => {
    setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Actions" }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "outside" }));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  test("icon variant: icon-only trigger, no chevron, opens and selects", async () => {
    stubRects();
    const onPick = vi.fn();
    render(
      <Menu
        variant="icon"
        ariaLabel="Card actions"
        label={<svg data-testid="trigger-glyph" aria-hidden />}
        items={[{ id: "m", label: "Move to Doing", onSelect: onPick }]}
      />,
    );
    const user = userEvent.setup();
    const trigger = screen.getByRole("button", { name: "Card actions" });
    expect(trigger).toHaveClass("size-7", "rounded-tile", "justify-center");
    expect(trigger.querySelectorAll("svg")).toHaveLength(1);
    expect(screen.getByTestId("trigger-glyph")).toBeInTheDocument();
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("menuitem", { name: "Move to Doing" }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
