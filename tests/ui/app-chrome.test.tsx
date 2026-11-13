import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AppChrome, { useSidebarCollapsed } from "@/components/AppChrome";

let pathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn() }),
}));

let store: Map<string, string>;

beforeEach(() => {
  store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
});

afterEach(() => {
  pathname = "/";
  vi.unstubAllGlobals();
});

function Probe() {
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  return (
    <button onClick={() => setCollapsed(!collapsed)}>{collapsed ? "collapsed" : "expanded"}</button>
  );
}

describe("useSidebarCollapsed", () => {
  it("defaults to expanded", () => {
    render(<Probe />);
    expect(screen.getByRole("button").textContent).toBe("expanded");
  });

  it("persists a collapse and survives a remount", () => {
    const first = render(<Probe />);
    act(() => screen.getByRole("button").click());
    expect(screen.getByRole("button").textContent).toBe("collapsed");
    expect(store.get("doem.sidebarCollapsed")).toBe("1");
    first.unmount();

    render(<Probe />);
    expect(screen.getByRole("button").textContent).toBe("collapsed");
  });

  it("falls back to expanded when storage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    render(<Probe />);
    expect(screen.getByRole("button").textContent).toBe("expanded");
  });
});

describe("AppChrome palette", () => {
  it("opens the command palette on Cmd+K", async () => {
    render(
      <AppChrome>
        <div />
      </AppChrome>,
    );
    expect(screen.queryByRole("dialog", { name: "Command palette" })).toBeNull();
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(await screen.findByRole("dialog", { name: "Command palette" })).toBeInTheDocument();
  });
});

describe("AppChrome glass shell", () => {
  it("marks the window as a frosted bg-shell sheet and main as the inset panel", () => {
    const { container } = render(
      <AppChrome>
        <div />
      </AppChrome>,
    );
    const win = container.querySelector('[data-part="window"]');
    expect(win).not.toBeNull();
    expect(win).toHaveClass("shell-glass", "bg-shell", "relative");
    const main = container.querySelector('[data-part="main"]');
    expect(main).not.toBeNull();
    expect(main).toHaveClass("rounded-panel", "bg-surface", "m-2", "ml-0");
  });
});

describe("AppChrome capture route", () => {
  it("renders only the children on /capture: no sidebar, no nav", () => {
    pathname = "/capture";
    render(
      <AppChrome>
        <div>composer</div>
      </AppChrome>,
    );
    expect(screen.getByText("composer")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.queryByRole("main")).toBeNull();
    expect(document.querySelector('[data-part="window"]')).toBeNull();
  });
});
