import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ActivitiesSection from "@/components/tracking/settings/ActivitiesSection";
import { emptyWorkspace, makeCategory, renderWorkspace } from "./harness";
import type { Activity } from "@/lib/types";

// SettingRow lands in parallel; stand-in with the agreed value.
vi.mock("@/components/settings/SettingRow", () => ({ SETTING_SELECT: "" }));

const CAT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CAT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function activity(over: Partial<Activity>): Activity {
  return {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    categoryId: CAT_A,
    name: "Deep work",
    isPreset: false,
    pinned: false,
    archived: false,
    sortOrder: 0,
    createdAt: "2026-03-01T09:00:00.000Z",
    ...over,
  };
}

function render(activities: Activity[]) {
  const ws = emptyWorkspace();
  ws.categories = [
    makeCategory({ id: CAT_B, name: "Home", sortOrder: 1 }),
    makeCategory({ id: CAT_A, name: "Focus Work", sortOrder: 0 }),
    makeCategory({ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", name: "Old", sortOrder: 2, archived: true }),
  ];
  ws.activities = activities;
  return renderWorkspace(<ActivitiesSection />, ws);
}

function calls(mock: { calls: { url: string; method: string; body: unknown }[] }, method: string) {
  return mock.calls.filter((c) => c.url.includes("/api/activities") && c.method === method);
}

describe("ActivitiesSection", () => {
  it("groups under non-archived categories by sortOrder", async () => {
    render([activity({ name: "Deep work" }), activity({ id: "e1", categoryId: CAT_B, name: "Laundry" })]);
    await screen.findByDisplayValue("Deep work");
    const heads = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(heads).toEqual(["Focus Work", "Home"]);
    expect(screen.getByDisplayValue("Laundry").closest("section")!.textContent).toContain("Home");
  });

  it("renames per keystroke with a PATCH", async () => {
    const { mock } = render([activity({})]);
    fireEvent.change(await screen.findByLabelText("Rename Deep work"), { target: { value: "Deep work 2" } });
    await waitFor(() => expect(calls(mock, "PATCH")[0].body).toMatchObject({ name: "Deep work 2" }));
  });

  it("pin is disabled until quick start is on, and rows carry visible labels", async () => {
    render([activity({}), activity({ id: "e2", name: "Email", isPreset: true, sortOrder: 1 })]);
    await screen.findByDisplayValue("Deep work");
    expect(screen.getByRole("switch", { name: "Pin Deep work" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Pin Email" })).not.toBeDisabled();
    expect(screen.getAllByText("Quick start")).toHaveLength(2);
    expect(screen.getAllByText("Pin to Now")).toHaveLength(2);
    expect(screen.getAllByText("Archived")).toHaveLength(2);
    expect(screen.getAllByText("Delete")).toHaveLength(2);
  });

  it("adds an activity with minutes", async () => {
    const { mock } = render([]);
    fireEvent.change(await screen.findByLabelText("New activity name in Focus Work"), { target: { value: "Review" } });
    fireEvent.change(screen.getByLabelText("Typical minutes for new activity in Focus Work"), { target: { value: "25" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Add activity" })[0]);
    await waitFor(() =>
      expect(calls(mock, "POST")[0].body).toMatchObject({ categoryId: CAT_A, name: "Review", typicalMinutes: 25 }),
    );
  });

  it("drops zero minutes on add", async () => {
    const { mock } = render([]);
    fireEvent.change(await screen.findByLabelText("New activity name in Focus Work"), { target: { value: "Review" } });
    fireEvent.change(screen.getByLabelText("Typical minutes for new activity in Focus Work"), { target: { value: "0" } });
    // min=1 blocks a click-submit in jsdom; submit the form directly.
    fireEvent.submit(screen.getAllByRole("button", { name: "Add activity" })[0].closest("form")!);
    await waitFor(() => expect(calls(mock, "POST")).toHaveLength(1));
    expect((calls(mock, "POST")[0].body as Record<string, unknown>).typicalMinutes).toBeUndefined();
  });
});
