import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Sidebar, { NAV } from "@/components/Sidebar";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

/** jsdom in this Node version doesn't wire up localStorage on its own; ThemeToggle needs it. */
beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
});

function withHiddenNavItems(hiddenNavItems: string[]) {
  return emptyWorkspace({
    trackingSettings: {
      dayStartHour: 4,
      wakingStartHour: 7,
      wakingEndHour: 23,
      minGapMinutes: 10,
      moduleOrder: [],
      hiddenModules: [],
      collapsedModules: [],
      hiddenNavItems,
      updatedAt: "2026-03-01T09:00:00.000Z",
    },
  });
}

describe("sidebar nav visibility", () => {
  it("shows the full nav before settings has loaded, to avoid flashing an empty sidebar", () => {
    renderWorkspace(<Sidebar collapsed={false} onToggleCollapsed={() => {}} />);
    // Right after render, the tracking-settings fetch hasn't resolved yet —
    // the sidebar must still show every entry, Trash included.
    expect(screen.getByRole("link", { name: "Trash" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Settings & sync/ })).toBeInTheDocument();
  });

  it("hides an entry on the nav once it's in hiddenNavItems", async () => {
    renderWorkspace(<Sidebar collapsed={false} onToggleCollapsed={() => {}} />, withHiddenNavItems(["trash"]));

    await screen.findByRole("link", { name: "Next 7 days" });
    expect(screen.queryByRole("link", { name: "Trash" })).toBeNull();
    expect(screen.getByRole("button", { name: /Settings & sync/ })).toBeInTheDocument();
  });

  it("keeps the profile row when every hideable entry is hidden", async () => {
    const hideable = NAV.filter((n) => n.group !== "footer").map((n) => n.key);
    renderWorkspace(<Sidebar collapsed={false} onToggleCollapsed={() => {}} />, withHiddenNavItems(hideable));
    await waitFor(() => expect(screen.queryByRole("link", { name: "Trash" })).toBeNull());
    expect(screen.getByRole("button", { name: /Settings & sync/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Settings" })).toBeNull();
  });
});

describe("sidebar groups and actions", () => {
  it("renders the Main, Projects and More groups as labelled navs", () => {
    renderWorkspace(<Sidebar collapsed={false} onToggleCollapsed={() => {}} />);
    for (const name of ["Main", "Projects", "More"]) {
      expect(screen.getByRole("navigation", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "All tasks" })).toBeInTheDocument();
  });

  it("shows a Today count for an open task scheduled today", async () => {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    renderWorkspace(
      <Sidebar collapsed={false} onToggleCollapsed={() => {}} />,
      emptyWorkspace({ tasks: [makeTask({ scheduled: iso })] }),
    );
    const link = await screen.findByRole("link", { name: "Today" });
    await vi.waitFor(() => expect(link).toHaveTextContent("1"));
  });

  it("lists Inbox right after Today in the Main nav, linking to /inbox", async () => {
    renderWorkspace(<Sidebar collapsed={false} onToggleCollapsed={() => {}} />);
    const main = screen.getByRole("navigation", { name: "Main" });
    const links = Array.from(main.querySelectorAll("a"));
    const hrefs = links.map((a) => a.getAttribute("href"));
    expect(hrefs.slice(0, 2)).toEqual(["/", "/inbox"]);
    expect(await screen.findByRole("link", { name: /^Inbox/ })).toHaveAttribute("href", "/inbox");
  });

  it("shows the Inbox count for open undated tasks only", async () => {
    renderWorkspace(
      <Sidebar collapsed={false} onToggleCollapsed={() => {}} />,
      emptyWorkspace({
        tasks: [
          makeTask({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", scheduled: null }),
          makeTask({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", scheduled: null }),
          makeTask({ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", scheduled: "2026-03-01" }),
        ],
      }),
    );
    const link = await screen.findByRole("link", { name: /^Inbox/ });
    await vi.waitFor(() => expect(link).toHaveTextContent("2"));
  });

  it("shows no Inbox count when there are no undated tasks", async () => {
    renderWorkspace(<Sidebar collapsed={false} onToggleCollapsed={() => {}} />);
    const link = await screen.findByRole("link", { name: /^Inbox/ });
    expect(link.textContent).toBe("Inbox");
  });

  it("calls onToggleCollapsed from the collapse button", () => {
    const onToggle = vi.fn();
    renderWorkspace(<Sidebar collapsed={false} onToggleCollapsed={onToggle} />);
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("keeps the project delete button in the DOM so keyboard focus can reach it", async () => {
    renderWorkspace(
      <Sidebar collapsed={false} onToggleCollapsed={() => {}} />,
      emptyWorkspace({
        projects: [
          { id: "p1", name: "Alpha", color: "#4f51e0", archived: false, createdAt: "2026-03-01T09:00:00.000Z" } as never,
        ],
      }),
    );
    const del = await screen.findByRole("button", { name: "Delete Alpha" });
    expect(del).toBeInTheDocument();
    expect(del.className).not.toMatch(/\bhidden\b/);
    expect(del.className).toContain("group-focus-within:opacity-100");
  });

  describe("project delete confirmation", () => {
    function setup() {
      return renderWorkspace(
        <Sidebar collapsed={false} onToggleCollapsed={() => {}} />,
        emptyWorkspace({
          projects: [
            { id: "p1", name: "Alpha", color: "#4f51e0", archived: false, createdAt: "2026-03-01T09:00:00.000Z" } as never,
          ],
        }),
      );
    }
    const deletes = (mock: { calls: { url: string; method: string }[] }) =>
      mock.calls.filter((c) => c.method === "DELETE");

    it("opens an alertdialog naming the project", async () => {
      setup();
      fireEvent.click(await screen.findByRole("button", { name: "Delete Alpha" }));
      const dialog = screen.getByRole("alertdialog");
      expect(dialog).toHaveAccessibleName('Delete "Alpha"?');
      expect(dialog).toHaveTextContent("Its tasks move to No project.");
    });

    it("Cancel closes it without deleting", async () => {
      const { mock } = setup();
      fireEvent.click(await screen.findByRole("button", { name: "Delete Alpha" }));
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByRole("alertdialog")).toBeNull();
      expect(deletes(mock)).toHaveLength(0);
    });

    it("Escape closes it without deleting", async () => {
      const { mock } = setup();
      fireEvent.click(await screen.findByRole("button", { name: "Delete Alpha" }));
      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByRole("alertdialog")).toBeNull();
      expect(deletes(mock)).toHaveLength(0);
    });

    it("Delete removes the project once", async () => {
      const { mock } = setup();
      fireEvent.click(await screen.findByRole("button", { name: "Delete Alpha" }));
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
      expect(screen.queryByRole("alertdialog")).toBeNull();
      await waitFor(() => expect(deletes(mock)).toHaveLength(1));
      expect(deletes(mock)[0].url).toBe("/api/projects/p1");
    });
  });
});

describe("sidebar nav icons", () => {
  it("gives every main and more nav item an icon", () => {
    for (const item of NAV.filter((n) => n.group === "main" || n.group === "more")) {
      expect(item.icon, item.key).toBeTruthy();
    }
  });

  it("renders an svg inside the Trash link, like All tasks and Completed", () => {
    renderWorkspace(<Sidebar collapsed={false} onToggleCollapsed={() => {}} />);
    for (const name of [/All tasks/, /Completed/, /Trash/]) {
      expect(screen.getByRole("link", { name }).querySelector("svg")).not.toBeNull();
    }
  });
});

describe("sidebar form", () => {
  it("draws the Inbox row with the inbox glyph", () => {
    expect(NAV.find((n) => n.key === "inbox")?.icon).toBe("inbox");
  });

  it("marks only the active row medium weight", () => {
    renderWorkspace(<Sidebar collapsed={false} onToggleCollapsed={() => {}} />);
    const rows = Array.from(document.querySelectorAll('[data-part="nav-row"]'));
    expect(rows.length).toBeGreaterThan(0);
    const medium = rows.filter((r) => r.className.includes("font-medium"));
    expect(medium).toHaveLength(1);
    expect(medium[0]).toHaveAttribute("aria-current", "page");
  });

  it("exposes the side, brand, lbl-s, nav-row and side-foot parts", () => {
    renderWorkspace(<Sidebar collapsed={false} onToggleCollapsed={() => {}} />);
    for (const part of ["side", "brand", "lbl-s", "nav-row", "side-foot"]) {
      expect(document.querySelector(`[data-part="${part}"]`), part).not.toBeNull();
    }
    expect(document.querySelector('[data-part="side"]')?.className).not.toContain("bg-shell");
  });

  it("keeps the foot outside the nav scroll region, which can scroll clear of its fade", () => {
    renderWorkspace(<Sidebar collapsed={false} onToggleCollapsed={() => {}} />);
    const scroll = document.querySelector('[data-part="nav-scroll"]') as HTMLElement;
    const foot = document.querySelector('[data-part="side-foot"]') as HTMLElement;
    expect(scroll.className).toContain("overflow-y-auto");
    expect(scroll.className).toContain("pb-6");
    expect(scroll.contains(foot)).toBe(false);
    expect(scroll.parentElement).toBe(foot.parentElement);
    expect(scroll.className).toContain("min-h-0");
  });
});
