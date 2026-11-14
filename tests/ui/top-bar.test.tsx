import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TopBar from "@/components/TopBar";
import { renderWorkspace } from "./harness";

let pathname = "/";
const push = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push }),
}));

const rect = (r: Partial<DOMRect>): DOMRect =>
  ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => {}, ...r }) as DOMRect;

beforeEach(() => {
  Element.prototype.getBoundingClientRect = vi.fn(function (this: Element) {
    if (this.hasAttribute("data-picker-menu")) return rect({ height: 160, width: 288 });
    if (this.getAttribute("aria-haspopup") === "dialog") return rect({ top: 14, bottom: 50, left: 1000, right: 1036, width: 36, height: 36 });
    return rect({});
  }) as unknown as typeof Element.prototype.getBoundingClientRect;
  pathname = "/";
  push.mockClear();
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
});

function renderBar(collapsed = false, onExpand = vi.fn()) {
  renderWorkspace(<TopBar sidebarCollapsed={collapsed} onExpandSidebar={onExpand} />);
  return onExpand;
}

describe("TopBar", () => {
  it("shows Main / Today at the root", () => {
    renderBar();
    expect(screen.getByText("Main")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("shows More / Trash at /trash", () => {
    pathname = "/trash";
    renderBar();
    expect(screen.getByText("More")).toBeInTheDocument();
    expect(screen.getByText("Trash")).toBeInTheDocument();
  });

  it("shows Today / Wrap up at /wrap", () => {
    pathname = "/wrap";
    renderBar();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Wrap up")).toBeInTheDocument();
  });

  it("shows You / Settings at /settings", () => {
    pathname = "/settings";
    renderBar();
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("opens the command palette when the search pill is clicked", () => {
    const opened = vi.fn();
    window.addEventListener("doem:command-palette", opened);
    renderBar();
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    window.removeEventListener("doem:command-palette", opened);
    expect(opened).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("keeps the pill id the native Cmd+F command used to focus", () => {
    renderBar();
    const pill = screen.getByRole("button", { name: "Search" });
    expect(pill.id).toBe("doem-sidebar-search");
    expect(pill.getAttribute("type")).toBe("button");
    expect(pill.textContent).toContain("⌘ K");
  });

  it("shows the expand button only when collapsed, and it calls back", () => {
    const { unmount } = renderWorkspace(
      <TopBar sidebarCollapsed={false} onExpandSidebar={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: "Show sidebar" })).toBeNull();
    unmount();
    const onExpand = renderBar(true);
    fireEvent.click(screen.getByRole("button", { name: "Show sidebar" }));
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it("shows a Notifications button after the search pill", () => {
    renderBar();
    const search = screen.getByRole("button", { name: "Search" });
    const bell = screen.getByRole("button", { name: /notifications/i });
    expect(search.compareDocumentPosition(bell) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders the real bell and opens its panel", () => {
    renderBar();
    const bell = screen.getByRole("button", { name: "Notifications" });
    expect(bell).toHaveAttribute("data-part", "icon-btn");
    expect(screen.queryByRole("dialog", { name: "Notifications" })).toBeNull();
    fireEvent.click(bell);
    const panel = screen.getByRole("dialog", { name: "Notifications" });
    expect(panel).toBeInTheDocument();
    expect(screen.getByText("Nothing due today.")).toBeInTheDocument();
  });

  it("marks the bar, crumb and search parts", () => {
    const { container } = renderWorkspace(
      <TopBar sidebarCollapsed={false} onExpandSidebar={vi.fn()} />,
    );
    expect(container.querySelector('header[data-part="bar"]')).not.toBeNull();
    expect(container.querySelector('nav[data-part="crumb"]')).not.toBeNull();
    expect(container.querySelector('button[data-part="search"]')).not.toBeNull();
  });

  it("uses the short search copy", () => {
    renderBar();
    expect(screen.getByRole("button", { name: "Search" }).textContent).toContain(
      "Search tasks, projects…",
    );
  });

  it("shows the moon when the theme is light and the sun when dark", () => {
    localStorage.setItem("theme", "light");
    const { unmount } = renderWorkspace(
      <TopBar sidebarCollapsed={false} onExpandSidebar={vi.fn()} />,
    );
    const light = screen.getByRole("button", { name: /^Theme:/ });
    expect(light.querySelector("path")?.getAttribute("d")).toContain("M19 14.5");
    unmount();
    localStorage.setItem("theme", "dark");
    renderBar();
    const dark = screen.getByRole("button", { name: /^Theme:/ });
    expect(dark.querySelector("path")?.getAttribute("d")).not.toContain("M19 14.5");
    expect(dark.querySelector("circle")).not.toBeNull();
  });

  it("puts every control inside a .no-drag ancestor", () => {
    renderBar(true);
    const controls = screen.getAllByRole("button");
    expect(controls.length).toBeGreaterThan(1);
    for (const el of controls) expect(el.closest(".no-drag")).not.toBeNull();
  });
});
