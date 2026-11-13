import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import TrackingPage from "@/app/tracking/page";
import { emptyWorkspace, makeCategory, makeProject, makeTask, renderWorkspace } from "./harness";

vi.mock("@/lib/useNow", () => ({
  useNow: () => new Date(2026, 10, 12, 14, 0),
}));

const rect = (r: Partial<DOMRect>): DOMRect =>
  ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => {}, ...r }) as DOMRect;

const at = (d: number, h: number, mi: number) => new Date(2026, 10, d, h, mi).toISOString();

const SEGMENTS = [
  {
    id: "s-1",
    categoryId: "cat-1",
    taskId: "task-1",
    startedAt: at(11, 9, 0),
    endedAt: at(11, 10, 0),
    source: "timer",
    createdAt: at(11, 9, 0),
    updatedAt: at(11, 9, 0),
  },
];

const settings = (over: object = {}) => ({
  ...emptyWorkspace().trackingSettings,
  moduleOrder: ["now", "unaccounted", "ribbon", "records", "rollups", "signals"],
  ...over,
});

function mount(over: object = {}, categories = [makeCategory({ id: "cat-1" })]) {
  const view = renderWorkspace(
    <TrackingPage />,
    emptyWorkspace({
      categories,
      tasks: [makeTask({ id: "task-1", projectId: "proj-1", scheduled: "2026-11-11" })],
      projects: [makeProject({ id: "proj-1" })],
      trackingSettings: settings(over),
    }),
  );
  view.mock.respondWith("/api/segments?", { segments: SEGMENTS, running: null });
  view.mock.respondWith("/api/segments/gaps", []);
  return view;
}

beforeEach(() => {
  Element.prototype.getBoundingClientRect = vi.fn(() => rect({})) as unknown as typeof Element.prototype.getBoundingClientRect;
});

describe("Tracking page", () => {
  test("head: title, dim month, exact subtitle, range chip", async () => {
    mount();
    const h1 = await screen.findByRole("heading", { level: 1 });
    expect(h1.textContent).toContain("Tracking");
    expect(h1.textContent).toContain("November");
    expect(screen.getByText("Where your time went, next to what you planned.")).toBeTruthy();
    expect(screen.getByText("16 Oct to 12 Nov")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Tracking settings" }).getAttribute("href")).toBe("/tracking/settings");
  });

  test("range Segmented switches 28 to 7 and the chart follows", async () => {
    mount();
    await screen.findByText("Time by day");
    const group = screen.getByRole("radiogroup", { name: "Range" });
    expect(within(group).getByRole("radio", { name: "28 days" }).getAttribute("aria-checked")).toBe("true");
    const dots = () => screen.getAllByRole("img", { name: /tracked, .* planned/ }).length;
    expect(dots()).toBe(28);
    await userEvent.click(within(group).getByRole("radio", { name: "7 days" }));
    expect(within(group).getByRole("radio", { name: "7 days" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("Last 7 days")).toBeTruthy();
    expect(screen.getByText("10 to 12 Nov".length ? "6 to 12 Nov" : "")).toBeTruthy();
    expect(dots()).toBe(7);
  });

  test("KPIs, By project and Recent entries are present", async () => {
    mount();
    expect(await screen.findByText("This week")).toBeTruthy();
    for (const label of ["Daily average", "Plan accuracy", "Sessions"]) expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByText("By project")).toBeTruthy();
    expect(screen.getByText("Recent entries")).toBeTruthy();
  });

  test("day pager changes the label and Today disables on today", async () => {
    mount();
    const todayBtn = await screen.findByRole("button", { name: "Today" });
    expect((todayBtn as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("heading", { level: 2, name: "Today" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Previous day" }));
    expect(await screen.findByRole("heading", { level: 2, name: "Wed 11 Nov" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Today" }) as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(await screen.findByRole("heading", { level: 2, name: "Today" })).toBeTruthy();
  });

  test("below cards follow order, hidden ones are not rendered, rollups and signals never are", async () => {
    mount({ hiddenModules: ["ribbon"] });
    await screen.findByText("Gaps today");
    expect(screen.getByText("Now")).toBeTruthy();
    expect(screen.queryByText("Day ribbon")).toBeNull();
    expect(screen.queryByText("By category")).toBeNull();
    expect(screen.queryByText("Day summary")).toBeNull();
  });

  test("collapse patches collapsedModules", async () => {
    const { mock } = mount();
    mock.respondWith("/api/tracking-settings", settings({ collapsedModules: ["unaccounted"] }));
    await userEvent.click(await screen.findByRole("button", { name: "Collapse Gaps today" }));
    await waitFor(() => {
      const call = mock.calls.find((c) => c.url.includes("/api/tracking-settings"));
      expect(call?.body).toEqual({ collapsedModules: ["unaccounted"] });
    });
  });

  test("no categories shows the empty state", async () => {
    mount({}, []);
    expect(await screen.findByText(/No categories yet/)).toBeTruthy();
    const link = screen.getByRole("link", { name: "Set some up" });
    expect(link.className).toContain("text-accent");
  });
});
