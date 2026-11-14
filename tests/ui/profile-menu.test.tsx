import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import ProfileMenu from "@/components/sidebar/ProfileMenu";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push }),
}));

const rect = (r: Partial<DOMRect>): DOMRect =>
  ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => {}, ...r }) as DOMRect;

let store: Map<string, string>;

beforeEach(() => {
  push.mockClear();
  store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
  Element.prototype.getBoundingClientRect = vi.fn(function (this: Element) {
    if (this.hasAttribute("data-picker-menu")) return rect({ height: 180, width: 200 });
    if (this.getAttribute("aria-haspopup") === "menu")
      return rect({ top: 700, bottom: 740, left: 20, right: 240, width: 220, height: 40 });
    return rect({});
  }) as unknown as typeof Element.prototype.getBoundingClientRect;
});

async function openMenu() {
  const user = userEvent.setup();
  render(<ProfileMenu />);
  const row = screen.getByRole("button", { name: /Settings & sync/ });
  await user.click(row);
  return { user, row };
}

describe("ProfileMenu", () => {
  test("row shows avatar, name and subtitle", () => {
    const { container } = render(<ProfileMenu />);
    const row = screen.getByRole("button", { name: /Settings & sync/ });
    expect(row).toHaveAttribute("data-part", "me");
    expect(row).toHaveAttribute("aria-haspopup", "menu");
    expect(container.querySelector('[data-part="avatar"]')).toHaveTextContent("Y");
    expect(screen.getByText("You")).toBeInTheDocument();
  });

  test("click opens a menu with five items in order", async () => {
    const { row } = await openMenu();
    expect(row).toHaveAttribute("aria-expanded", "true");
    const items = screen.getAllByRole("menuitem").map((i) => i.textContent);
    expect(items).toEqual(["Settings", "Tracking settings", "Sync and calendars", "Theme: Auto", "Shortcuts"]);
  });

  test.each([
    ["Settings", "/settings"],
    ["Tracking settings", "/tracking/settings"],
    ["Sync and calendars", "/settings#calendar"],
  ])("%s navigates to %s", async (name, path) => {
    const { user } = await openMenu();
    await user.click(screen.getByRole("menuitem", { name }));
    expect(push).toHaveBeenCalledWith(path);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  test("Theme cycles and stores the choice", async () => {
    const { user } = await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Theme: Auto" }));
    expect(store.get("theme")).toBe("light");
    await user.click(screen.getByRole("button", { name: /Settings & sync/ }));
    expect(screen.getByRole("menuitem", { name: "Theme: Light" })).toBeInTheDocument();
  });

  test("Shortcuts opens the shortcut sheet", async () => {
    const { user } = await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Shortcuts" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  test("Escape closes the menu and returns focus to the row", async () => {
    const { user, row } = await openMenu();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(row).toHaveFocus();
  });
});
