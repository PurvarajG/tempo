import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UpcomingPage from "@/app/upcoming/page";
import { fmtRange, fmtWeekday } from "@/lib/format";
import { addDays, toISODate } from "@/lib/parse";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

const push = vi.fn();
const replace = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  usePathname: () => "/upcoming",
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams(search),
}));

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const D = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const today = toISODate(new Date());
const tomorrow = addDays(today, 1);

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
  search = "";
});

describe("Next 7 days page", () => {
  it("shows the two-tone heading, derived sentence and seven day rows", async () => {
    renderWorkspace(
      <UpcomingPage />,
      emptyWorkspace({
        tasks: [
          makeTask({ id: A, title: "Tomorrow thing", scheduled: tomorrow, minutes: 60 }),
          makeTask({ id: B, title: "Later thing", scheduled: addDays(today, 3), minutes: 30 }),
          makeTask({ id: C, title: "Undated thing", scheduled: null, minutes: 600 }),
        ],
      }),
    );
    const h1 = await screen.findByRole("heading", { level: 1 });
    expect(h1.textContent).toContain("Next 7 days");
    expect(h1.textContent).toContain(fmtRange(today, addDays(today, 6)));
    expect(await screen.findByText("2 tasks, 1h 30m planned.")).toBeTruthy();
    expect(document.querySelectorAll("section")).toHaveLength(7);
    const row = screen.getByRole("region", { name: new RegExp(`^${fmtWeekday(tomorrow)}`) });
    expect(row.textContent).toContain("Tomorrow thing");
    expect(screen.queryByText("Undated thing")).toBeNull();
    expect(screen.queryByText(/what's coming/i)).toBeNull();
    expect(screen.queryByPlaceholderText(/add a task/i)).toBeNull();
  });

  it("shows a carried task in the Carried over row", async () => {
    renderWorkspace(
      <UpcomingPage />,
      emptyWorkspace({ tasks: [makeTask({ id: D, title: "Left behind", scheduled: addDays(today, -1) })] }),
    );
    expect(await screen.findByText("Left behind")).toBeTruthy();
    expect(screen.getByText("Carried over")).toBeTruthy();
    expect(screen.getByText(/1 carried over\./)).toBeTruthy();
  });

  it("offers Plan it on an empty day and reschedules on click", async () => {
    const { mock } = renderWorkspace(
      <UpcomingPage />,
      emptyWorkspace({
        tasks: [
          makeTask({ id: A, title: "Busy", scheduled: today, minutes: 60 }),
          makeTask({ id: B, title: "Floating errand", scheduled: null, minutes: 30 }),
        ],
      }),
    );
    const chip = await screen.findByRole("button", { name: `Plan it for ${fmtWeekday(tomorrow)}` });
    await userEvent.click(chip);
    await waitFor(() => expect(mock.calls.some((c) => c.url === "/api/tasks/reschedule")).toBe(true));
    const body = mock.calls.find((c) => c.url === "/api/tasks/reschedule")!.body as { ids?: string[]; date?: string };
    expect(JSON.stringify(body)).toContain(B);
    expect(JSON.stringify(body)).toContain(tomorrow);
  });

  it("the head is a List, Board, Calendar segmented control and Calendar goes to the week calendar", async () => {
    renderWorkspace(<UpcomingPage />, emptyWorkspace());
    const group = await screen.findByRole("radiogroup", { name: "Next 7 days view" });
    const radios = within(group).getAllByRole("radio");
    expect(radios.map((r) => r.textContent)).toEqual(["List", "Board", "Calendar"]);
    expect(radios[0].getAttribute("aria-checked")).toBe("true");
    await userEvent.click(radios[2]);
    expect(push).toHaveBeenCalledWith("/calendar?view=week");
    expect(radios[2].getAttribute("aria-checked")).toBe("false");
  });

  it("Board changes the query without a reload", async () => {
    renderWorkspace(<UpcomingPage />, emptyWorkspace());
    await userEvent.click(await screen.findByRole("radio", { name: "Board" }));
    expect(replace).toHaveBeenCalledWith("/upcoming?view=board", { scroll: false });
  });

  it("?view=board opens the Board", async () => {
    search = "view=board";
    renderWorkspace(<UpcomingPage />, emptyWorkspace());
    expect((await screen.findByRole("radio", { name: "Board" })).getAttribute("aria-checked")).toBe("true");
    expect(await screen.findByRole("region", { name: /^Today, 0 tasks/ })).toBeTruthy();
    expect(document.querySelectorAll("section")).toHaveLength(7);
  });
});
