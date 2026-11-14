import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WrapPage from "@/app/wrap/page";
import { emptyWorkspace, renderWorkspace } from "./harness";

let search = "";
vi.mock("next/navigation", () => ({
  usePathname: () => "/wrap",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

const todayDay = new Date().getDay();
const otherDay = (todayDay + 3) % 7;

function render(resetDay: number) {
  const ws = emptyWorkspace();
  ws.trackingSettings = { ...ws.trackingSettings, weeklyResetDay: resetDay };
  const view = renderWorkspace(<WrapPage />, ws);
  view.mock.respondWith("/api/tasks/expire", []);
  return view;
}

describe("Wrap page", () => {
  beforeEach(() => {
    search = "";
  });

  it("renders the four daily parts and no weekly section on a normal day", async () => {
    render(otherDay);
    expect(await screen.findByRole("heading", { name: /Wrap up/, level: 1 })).toBeTruthy();
    expect(screen.getAllByText("Nothing marked done today.")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Done today" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Tomorrow" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Estimates" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "How was today?" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Gone quiet" })).toBeNull();
    expect(screen.queryByText(/brain dump/i)).toBeNull();
    expect(screen.queryByLabelText("This week")).toBeNull();
  });

  it("adds the weekly section with ?reset=1", async () => {
    search = "reset=1";
    render(otherDay);
    await screen.findByRole("heading", { name: "Gone quiet" });
    expect(screen.getByRole("heading", { name: "Inbox" })).toBeTruthy();
    expect(screen.getByText(/brain dump/i)).toBeTruthy();
    expect(screen.getByLabelText("This week")).toBeTruthy();
    expect(screen.getByText("Done")).toBeTruthy();
    expect(screen.getByText("Focused")).toBeTruthy();
    expect(screen.getAllByText("Estimates").length).toBeGreaterThan(1);
  });

  it("adds the weekly section when today is the reset day", async () => {
    render(todayDay);
    await screen.findByRole("heading", { name: "Gone quiet" });
    expect(screen.getByLabelText("This week")).toBeTruthy();
  });
});
