import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import InboxPage from "@/app/inbox/page";
import { addDays, toISODate } from "@/lib/parse";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

vi.mock("next/navigation", () => ({
  usePathname: () => "/inbox",
  useRouter: () => ({ push: vi.fn() }),
}));

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const D = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PLACEHOLDER = "Add to the inbox. No day needed.";
const today = toISODate(new Date());

const rowTitles = () =>
  screen.getAllByText(/^(Sort receipts|Renew passport)$/).map((e) => e.textContent);

describe("Inbox page", () => {
  it("lists only open undated tasks, counts them and heads the page", async () => {
    renderWorkspace(
      <InboxPage />,
      emptyWorkspace({
        tasks: [
          makeTask({ id: A, title: "Sort receipts", scheduled: null }),
          makeTask({ id: B, title: "Renew passport", scheduled: null }),
          makeTask({ id: C, title: "Dated thing", scheduled: today }),
        ],
      }),
    );
    expect(await screen.findByText("Sort receipts")).toBeTruthy();
    expect(screen.getByText("Renew passport")).toBeTruthy();
    expect(screen.queryByText("Dated thing")).toBeNull();
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toContain("Inbox");
    expect(h1.textContent).toContain("2 to sort");
    expect(screen.getByText(/^2 tasks with no day yet\./)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Inbox", level: 2 }).nextElementSibling?.textContent).toBe("2");
  });

  it("hides an undated task that is hidden until a later day", async () => {
    renderWorkspace(
      <InboxPage />,
      emptyWorkspace({
        tasks: [
          makeTask({ id: A, title: "Visible one", scheduled: null }),
          makeTask({ id: D, title: "Later one", scheduled: null, startOn: addDays(today, 5) }),
        ],
      }),
    );
    expect(await screen.findByText("Visible one")).toBeTruthy();
    expect(screen.queryByText("Later one")).toBeNull();
  });

  it("sort chip toggles Oldest first / Newest first and reorders the rows", async () => {
    renderWorkspace(
      <InboxPage />,
      emptyWorkspace({
        tasks: [
          makeTask({ id: A, title: "Sort receipts", scheduled: null, createdAt: "2026-01-02T09:00:00.000Z" }),
          makeTask({ id: B, title: "Renew passport", scheduled: null, createdAt: "2026-01-05T09:00:00.000Z" }),
        ],
      }),
    );
    const chip = await screen.findByRole("button", { name: /Sort: Oldest first/ });
    expect(chip.textContent).toBe("Oldest first");
    expect(rowTitles()).toEqual(["Sort receipts", "Renew passport"]);
    await userEvent.click(chip);
    expect(screen.getByRole("button", { name: /Sort: Newest first/ }).textContent).toBe("Newest first");
    expect(rowTitles()).toEqual(["Renew passport", "Sort receipts"]);
    await userEvent.click(screen.getByRole("button", { name: /Sort: Newest first/ }));
    expect(rowTitles()).toEqual(["Sort receipts", "Renew passport"]);
  });

  it("shows the four KPI tiles", async () => {
    renderWorkspace(
      <InboxPage />,
      emptyWorkspace({ tasks: [makeTask({ id: A, title: "Sort receipts", scheduled: null })] }),
    );
    await screen.findByText("Sort receipts");
    for (const label of ["In inbox", "Oldest", "Estimated", "Cleared"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("keeps the brain dump card and Free this week beside the list", async () => {
    renderWorkspace(
      <InboxPage />,
      emptyWorkspace({ tasks: [makeTask({ id: A, title: "Sort receipts", scheduled: null })] }),
    );
    await screen.findByText("Sort receipts");
    expect(screen.getByRole("heading", { name: "Brain dump", level: 2 })).toBeTruthy();
    expect(screen.getByText("One task per line")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Brain dump" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Free this week", level: 2 })).toBeTruthy();
  });

  it("with nothing undated: no dim, empty sentence, brain dump still there", async () => {
    renderWorkspace(
      <InboxPage />,
      emptyWorkspace({ tasks: [makeTask({ id: C, title: "Dated thing", scheduled: today })] }),
    );
    expect((await screen.findAllByText("Nothing waiting for a day.")).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { level: 1 }).textContent).not.toContain("to sort");
    expect(screen.getByRole("textbox", { name: "Brain dump" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Brain dump", level: 2 })).toBeTruthy();
  });

  it("composer adds an undated task", async () => {
    const { mock } = renderWorkspace(<InboxPage />, emptyWorkspace());
    mock.respondNext("/api/tasks", makeTask({ id: A, title: "Buy stamps", scheduled: null }), "POST");
    await userEvent.type(await screen.findByPlaceholderText(PLACEHOLDER), "Buy stamps{Enter}");
    await waitFor(() => expect(mock.calls.some((c) => c.url === "/api/tasks")).toBe(true));
    const body = mock.calls.find((c) => c.url === "/api/tasks")!.body as { scheduled?: string | null };
    expect(body.scheduled).toBeNull();
  });
});
