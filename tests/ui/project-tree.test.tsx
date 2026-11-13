import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectTree from "@/components/sidebar/ProjectTree";
import { emptyWorkspace, makeProject, makeStages, makeTask, renderWorkspace } from "./harness";

const nav = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn() }),
}));

let store: Map<string, string>;
beforeEach(() => {
  nav.pathname = "/";
  store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
});

const alpha = makeProject({ id: "p1", name: "Alpha", color: "#4f51e0" });
const beta = makeProject({ id: "p2", name: "Beta", sortOrder: 1 });
const old = makeProject({ id: "p3", name: "Old", archived: true, sortOrder: 2 });

function workspace() {
  const stages = makeStages("p1").map((s, i) => ({ ...s, sortOrder: 3 - i }));
  return emptyWorkspace({
    projects: [alpha, beta, old],
    stages: [...stages, ...makeStages("p2").map((s) => ({ ...s, id: `b-${s.id}`, name: `B ${s.name}` }))],
    tasks: [makeTask({ id: "t1", projectId: "p1" }), makeTask({ id: "t2", projectId: "p1" })],
  });
}

function noStagesWorkspace() {
  const stages = makeStages("p1").map((s, i) => ({ ...s, sortOrder: 3 - i }));
  return emptyWorkspace({ projects: [alpha, beta, old], stages, tasks: [] });
}

describe("ProjectTree", () => {
  it("renders project rows with a letter logo and open count, hiding archived", async () => {
    renderWorkspace(<ProjectTree />, workspace());
    const link = await screen.findByRole("link", { name: /Alpha/ });
    const logo = link.querySelector('[data-part="logo"]');
    expect(logo).toHaveTextContent("A");
    expect(link.querySelector('[data-part="nav-count"]')).toHaveTextContent("2");
    expect(screen.getByRole("link", { name: /Beta/ }).querySelector('[data-part="nav-count"]')).toBeNull();
    expect(screen.queryByRole("link", { name: /Old/ })).toBeNull();
  });

  it("opens only the first project's tree on / with no storage, in sortOrder", async () => {
    renderWorkspace(<ProjectTree />, workspace());
    await screen.findByRole("link", { name: /Alpha/ });
    const trees = document.querySelectorAll('[data-part="tree"]');
    expect(trees).toHaveLength(1);
    const rows = Array.from(trees[0].querySelectorAll('[data-part="tree-row"]')).map((r) => r.textContent);
    expect(rows).toEqual(["Done", "Blocked"]);
    expect(trees[0].querySelector('[data-part="tree-more"]')).toHaveTextContent("2 more");
    expect(screen.queryByText("B Backlog")).toBeNull();
    expect(screen.getByRole("link", { name: /Beta/ })).toBeInTheDocument();
  });

  it("opens the route's project and leaves the first as one row", async () => {
    nav.pathname = "/projects/p2";
    renderWorkspace(<ProjectTree />, workspace());
    await screen.findByRole("link", { name: /Alpha/ });
    const trees = document.querySelectorAll<HTMLElement>('[data-part="tree"]');
    expect(trees).toHaveLength(1);
    expect(within(trees[0]).getByText("B Backlog")).toBeInTheDocument();
    expect(screen.queryByText("In Progress")).toBeNull();
  });

  it("opens the remembered project when the route is not a project", async () => {
    store.set("doem.sidebarOpenProject", "p2");
    renderWorkspace(<ProjectTree />, workspace());
    await screen.findByRole("link", { name: /Alpha/ });
    const trees = document.querySelectorAll<HTMLElement>('[data-part="tree"]');
    expect(trees).toHaveLength(1);
    expect(within(trees[0]).getByText("B Backlog")).toBeInTheDocument();
  });

  it("falls through to the first project when the remembered id is gone or archived", async () => {
    store.set("doem.sidebarOpenProject", "p3");
    renderWorkspace(<ProjectTree />, workspace());
    await screen.findByRole("link", { name: /Alpha/ });
    expect(document.querySelectorAll('[data-part="tree"]')).toHaveLength(1);
    expect(screen.getByText("Blocked")).toBeInTheDocument();
  });

  it("still renders with the first project open when localStorage throws", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    renderWorkspace(<ProjectTree />, workspace());
    await screen.findByRole("link", { name: /Alpha/ });
    expect(document.querySelectorAll('[data-part="tree"]')).toHaveLength(1);
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: /Beta/ }));
  });

  it("clicking a project row remembers it and opens its tree", async () => {
    renderWorkspace(<ProjectTree />, workspace());
    fireEvent.click(await screen.findByRole("link", { name: /Beta/ }));
    expect(store.get("doem.sidebarOpenProject")).toBe("p2");
    await waitFor(() => expect(screen.getByText("B Backlog")).toBeInTheDocument());
    expect(screen.queryByText("In Progress")).toBeNull();
  });

  it("caps the open tree at three rows: two stages plus an N more row, none when it fits", async () => {
    renderWorkspace(<ProjectTree />, workspace());
    await screen.findByRole("link", { name: /Alpha/ });
    const tree = document.querySelector<HTMLElement>('[data-part="tree"]')!;
    expect(tree.querySelectorAll('[data-part="tree-row"], [data-part="tree-more"]')).toHaveLength(3);
    expect(within(tree).getByRole("link", { name: "2 more" })).toHaveAttribute("href", "/projects/p1");
    expect(within(tree).getByRole("button", { name: "Add list" })).toBeInTheDocument();
  });

  it("keeps Add list under the open project even without stages", async () => {
    nav.pathname = "/projects/p2";
    renderWorkspace(<ProjectTree />, noStagesWorkspace());
    await screen.findByRole("link", { name: /Beta/ });
    const trees = Array.from(document.querySelectorAll<HTMLElement>('[data-part="tree"]'));
    expect(trees).toHaveLength(1);
    expect(within(trees[0]).getByRole("button", { name: "Add list" })).toBeInTheDocument();
    expect(trees[0].querySelectorAll('[data-part="tree-row"]')).toHaveLength(0);
  });

  it("Add list opens the input in the open tree only", async () => {
    renderWorkspace(<ProjectTree />, workspace());
    await screen.findByRole("link", { name: /Alpha/ });
    const buttons = await screen.findAllByRole("button", { name: "Add list" });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(screen.getAllByRole("textbox", { name: "List name" })).toHaveLength(1);
    const tree = document.querySelector<HTMLElement>('[data-part="tree"]')!;
    expect(within(tree).getByRole("textbox", { name: "List name" })).toBeInTheDocument();
  });

  it("New project button shows a 16px plus icon", async () => {
    renderWorkspace(<ProjectTree />, workspace());
    const svg = (await screen.findByRole("button", { name: "New project" })).querySelector("svg");
    expect(svg).toHaveAttribute("width", "16");
    expect(svg).toHaveAttribute("height", "16");
  });

  it("Add list calls addStage with the typed name", async () => {
    nav.pathname = "/projects/p1";
    const { mock } = renderWorkspace(<ProjectTree />, workspace());
    await screen.findByRole("link", { name: /Alpha/ });
    fireEvent.click((await screen.findAllByRole("button", { name: "Add list" }))[0]);
    const input = screen.getByRole("textbox", { name: "List name" });
    fireEvent.change(input, { target: { value: "Review" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(mock.calls.find((c) => c.url.includes("/api/projects/p1/stages") && c.method === "POST")?.body).toEqual(
        { name: "Review", kind: "backlog" },
      ),
    );
  });

  it("Escape cancels Add list without creating", async () => {
    nav.pathname = "/projects/p1";
    const { mock } = renderWorkspace(<ProjectTree />, workspace());
    await screen.findByRole("link", { name: /Alpha/ });
    fireEvent.click((await screen.findAllByRole("button", { name: "Add list" }))[0]);
    const input = screen.getByRole("textbox", { name: "List name" });
    fireEvent.change(input, { target: { value: "Nope" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("textbox", { name: "List name" })).toBeNull();
    expect(mock.calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  it("collapse toggle hides the rows and remembers the choice", async () => {
    renderWorkspace(<ProjectTree />, workspace());
    await screen.findByRole("link", { name: /Alpha/ });
    fireEvent.click(screen.getByRole("button", { name: "Collapse projects" }));
    expect(screen.queryByRole("link", { name: /Alpha/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "New project" })).toBeNull();
    expect(screen.getByRole("button", { name: "Expand projects" })).toHaveAttribute("aria-expanded", "false");
    expect(store.get("doem.projectsCollapsed")).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "Expand projects" }));
    expect(await screen.findByRole("link", { name: /Alpha/ })).toBeInTheDocument();
    expect(store.get("doem.projectsCollapsed")).toBe("0");
  });

  it("delete opens the alertdialog and Delete calls deleteProject once", async () => {
    const { mock } = renderWorkspace(<ProjectTree />, workspace());
    fireEvent.click(await screen.findByRole("button", { name: "Delete Alpha" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAccessibleName('Delete "Alpha"?');
    expect(dialog).toHaveTextContent("Its tasks move to No project.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(mock.calls.filter((c) => c.method === "DELETE")).toHaveLength(1));
  });
});
