import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ModuleOrderSection from "@/components/tracking/settings/ModuleOrderSection";
import { emptyWorkspace, renderWorkspace } from "./harness";

// BELOW_MODULES lands in parallel; stand-ins with the agreed values.
vi.mock("@/lib/tracking-modules", () => ({
  BELOW_MODULES: ["now", "unaccounted", "ribbon"],
  MODULE_TITLE: {
    now: "Now",
    unaccounted: "Gaps today",
    ribbon: "Day ribbon",
    rollups: "Roll-ups",
    signals: "Signals",
    records: "Records",
  },
}));

function workspace(moduleOrder: string[], hiddenModules: string[] = []) {
  const ws = emptyWorkspace();
  ws.trackingSettings = { ...ws.trackingSettings, moduleOrder, hiddenModules };
  return ws;
}

const FULL = ["records", "now", "rollups", "unaccounted", "signals", "ribbon"];

function render(ws: ReturnType<typeof workspace>) {
  const r = renderWorkspace(<ModuleOrderSection />, ws);
  // The default fetch stub echoes {ok:true}; keep settings well-formed on patch.
  r.mock.respondWith("/api/tracking-settings", ws.trackingSettings);
  return r;
}

function patches(mock: { calls: { url: string; method: string; body: unknown }[] }) {
  return mock.calls.filter((c) => c.url.includes("/api/tracking-settings")).map((c) => c.body as Record<string, unknown>);
}

describe("ModuleOrderSection", () => {
  it("lists only the three below modules, in stored order", async () => {
    render(workspace(FULL));
    await screen.findByText("Now");
    const rows = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(rows).toEqual(["NowShown", "Gaps todayShown", "Day ribbonShown"]);
    expect(screen.queryByText("Records")).toBeNull();
    expect(screen.queryByText("Roll-ups")).toBeNull();
    expect(screen.queryByText("Signals")).toBeNull();
  });

  it("shows plain Shown or Hidden text beside each toggle", async () => {
    render(workspace(FULL, ["ribbon"]));
    await screen.findByText("Now");
    expect(screen.getAllByText("Shown")).toHaveLength(2);
    expect(screen.getAllByText("Hidden")).toHaveLength(1);
    expect(screen.getByText("Day ribbon").closest("li")!.textContent).toBe("Day ribbonHidden");
  });

  it("hide toggle patches hiddenModules", async () => {
    const { mock } = render(workspace(FULL));
    fireEvent.click(await screen.findByRole("switch", { name: "Hide Gaps today" }));
    await waitFor(() => expect(patches(mock)).toContainEqual({ hiddenModules: ["unaccounted"] }));
  });

  it("show toggle removes the key from hiddenModules", async () => {
    const { mock } = render(workspace(FULL, ["ribbon", "records"]));
    fireEvent.click(await screen.findByRole("switch", { name: "Show Day ribbon" }));
    await waitFor(() => expect(patches(mock)).toContainEqual({ hiddenModules: ["records"] }));
  });

  it("reorder keeps records, rollups and signals in the saved moduleOrder", async () => {
    const { mock } = render(workspace(FULL));
    const now = (await screen.findByText("Now")).closest("li")!;
    const ribbon = screen.getByText("Day ribbon").closest("li")!;
    fireEvent.dragStart(now);
    fireEvent.dragOver(ribbon);
    fireEvent.drop(ribbon);
    await waitFor(() =>
      expect(patches(mock)).toContainEqual({
        moduleOrder: ["unaccounted", "ribbon", "now", "records", "rollups", "signals"],
      }),
    );
  });

  it("appends a below module missing from moduleOrder", async () => {
    const { mock } = render(workspace(["records", "now", "rollups"]));
    await screen.findByText("Now");
    const rows = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(rows).toEqual(["NowShown", "Gaps todayShown", "Day ribbonShown"]);
    const now = screen.getByText("Now").closest("li")!;
    const ribbon = screen.getByText("Day ribbon").closest("li")!;
    fireEvent.dragStart(now);
    fireEvent.dragOver(ribbon);
    fireEvent.drop(ribbon);
    await waitFor(() =>
      expect(patches(mock)).toContainEqual({ moduleOrder: ["unaccounted", "ribbon", "now", "records", "rollups"] }),
    );
  });
});
