import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NowModule from "@/components/tracking/modules/NowModule";
import { useTasks } from "@/lib/store-context";
import type { Activity, Segment } from "@/lib/types";
import { emptyWorkspace, makeCategory, makeTask, renderWorkspace } from "./harness";

const CAT = makeCategory({ id: "cat-1", name: "Focus Work", color: "cat-indigo" });
const mkAct = (id: string, name: string, pinned: boolean): Activity => ({
  id,
  categoryId: "cat-1",
  name,
  isPreset: true,
  pinned,
  sortOrder: 0,
  archived: false,
  createdAt: "2026-03-01T09:00:00.000Z",
});
const ACTIVITIES = [mkAct("a-1", "Deep work", true), mkAct("a-2", "Email", true), mkAct("a-3", "Reading", false)];
const TASK = makeTask({ id: "task-1", title: "Write the plan" });

function seg(over: Partial<Segment>): Segment {
  return {
    id: "s-1",
    startedAt: new Date(Date.now() - (42 * 60 + 30) * 1000).toISOString(),
    categoryId: "cat-1",
    source: "timer",
    createdAt: "2026-03-01T09:00:00.000Z",
    updatedAt: "2026-03-01T09:00:00.000Z",
    ...over,
  };
}

function Loader() {
  const { loadSegments } = useTasks();
  return <button onClick={() => void loadSegments("2026-01-01", "2027-01-01")}>load</button>;
}

const rect = (r: Partial<DOMRect>): DOMRect =>
  ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => {}, ...r }) as DOMRect;
const original = Element.prototype.getBoundingClientRect;

async function setup(running: Segment | null = null) {
  const r = renderWorkspace(
    <>
      <Loader />
      <NowModule />
    </>,
    emptyWorkspace({ categories: [CAT], activities: ACTIVITIES, tasks: [TASK] }),
  );
  r.mock.respondWith("/api/segments/stop", { id: "s-1", endedAt: new Date().toISOString() });
  r.mock.respondWith("/api/segments", { segments: running ? [running] : [], running });
  await userEvent.click(screen.getByText("load"));
  if (running) await screen.findByText("Running");
  return r;
}

describe("NowModule", () => {
  beforeEach(() => {
    Element.prototype.getBoundingClientRect = vi.fn(function (this: Element) {
      if (this.hasAttribute("data-picker-menu")) return rect({ height: 200, width: 280 });
      if (this.getAttribute("role") === "combobox") return rect({ top: 100, bottom: 140, left: 20, right: 300, width: 280, height: 40 });
      return rect({});
    }) as unknown as typeof Element.prototype.getBoundingClientRect;
  });
  afterEach(() => {
    Element.prototype.getBoundingClientRect = original;
  });

  it("idle: says nothing is running and has no Stop", async () => {
    await setup();
    expect(screen.getByText("Nothing running")).toBeInTheDocument();
    expect(screen.getByText("Pick a task or an activity below.")).toBeInTheDocument();
    expect(screen.queryByText("00:00")).toBeNull();
    expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
  });

  it("running: shows label and Stop calls the stop endpoint", async () => {
    const r = await setup(seg({ activityId: "a-1" }));
    const status = screen.getByTestId("now-status");
    expect(within(status).getByText("Deep work")).toBeInTheDocument();
    expect(within(status).getByText("42m")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Stop" }));
    await waitFor(() => expect(r.mock.calls.some((c) => c.url.includes("/api/segments/stop"))).toBe(true));
    expect(await screen.findByText("Nothing running")).toBeInTheDocument();
  });

  it("running chip is pressed and disabled", async () => {
    await setup(seg({ activityId: "a-1" }));
    const chip = screen.getByRole("button", { name: "Deep work" });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(chip).toBeDisabled();
    expect(screen.getByRole("button", { name: "Email" })).toHaveAttribute("aria-pressed", "false");
  });

  it("a chip starts an activity", async () => {
    const r = await setup();
    r.mock.respondNext("/api/segments", seg({ activityId: "a-2" }), "POST");
    await userEvent.click(screen.getByRole("button", { name: "Email" }));
    await waitFor(() =>
      expect(r.mock.calls.find((c) => c.url === "/api/segments")?.body).toMatchObject({ categoryId: "cat-1", activityId: "a-2" }),
    );
  });

  it("a chip while running switches with replaceRunning", async () => {
    const r = await setup(seg({ activityId: "a-1" }));
    r.mock.respondNext("/api/segments", { stopped: seg({ activityId: "a-1" }), started: seg({ id: "s-2", activityId: "a-2" }) }, "POST");
    await userEvent.click(screen.getByRole("button", { name: "Email" }));
    await waitFor(() =>
      expect(r.mock.calls.find((c) => c.url === "/api/segments")?.body).toMatchObject({ activityId: "a-2", replaceRunning: true }),
    );
  });

  it("Start a task picker starts a task", async () => {
    const r = await setup();
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByText("Write the plan"));
    await waitFor(() => expect(r.mock.calls.find((c) => c.url === "/api/segments")?.body).toMatchObject({ taskId: "task-1" }));
  });

  it("Show all toggles the unpinned presets", async () => {
    await setup();
    expect(screen.queryByRole("button", { name: "Reading" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Show all (1 more)" }));
    expect(screen.getByRole("button", { name: "Reading" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Show fewer" }));
    expect(screen.queryByRole("button", { name: "Reading" })).toBeNull();
  });

  it("Manage links to tracking settings", async () => {
    await setup();
    expect(screen.getByRole("link", { name: "Manage" })).toHaveAttribute("href", "/tracking/settings");
  });
});
