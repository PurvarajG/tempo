import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import TomorrowCard from "@/components/wrap/TomorrowCard";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

const TODAY = "2026-11-12";
const TOMORROW = "2026-11-13";
const A = makeTask({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", title: "Planned one", scheduled: TOMORROW });
const B = makeTask({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", title: "Carried one", scheduled: "2026-11-10" });
const full = ["cccccccc", "dddddddd", "eeeeeeee"].map((p, i) =>
  makeTask({ id: `${p}-cccc-4ccc-8ccc-cccccccccccc`, title: `Committed ${i + 1}`, committedOn: TOMORROW }),
);

function setup(planned = [A], carried = [B]) {
  return renderWorkspace(
    <TomorrowCard planned={planned} carried={carried} todayISO={TODAY} />,
    emptyWorkspace({ tasks: [...planned, ...carried, ...full] }),
  );
}

afterEach(() => vi.restoreAllMocks());

describe("TomorrowCard", () => {
  it("lists planned rows, then the Carried over header, then carried rows", () => {
    setup();
    expect(screen.getByText("Fri 13 Nov")).toBeInTheDocument();
    const a = screen.getByText("Planned one");
    const h = screen.getByText("Carried over, 1");
    const b = screen.getByText("Carried one");
    expect(a.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(h.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("Commit sends the commit request for tomorrow", async () => {
    const { mock } = setup();
    mock.respondWith(`/api/tasks/${A.id}/commit`, makeTask({ id: A.id, committedOn: TOMORROW }));
    const row = screen.getByText("Planned one").closest("li") as HTMLElement;
    await userEvent.setup().click(within(row).getByRole("button", { name: "Commit" }));
    await waitFor(() => expect(mock.calls.some((c) => c.url === `/api/tasks/${A.id}/commit` && c.method === "POST")).toBe(true));
    expect(mock.calls.find((c) => c.url.endsWith("/commit"))?.body).toEqual({ day: TOMORROW });
  });

  it("a full day opens Swap with...", async () => {
    const { mock } = setup();
    mock.failNext(`/api/tasks/${A.id}/commit`, 409, "Full", { committed: full });
    const row = screen.getByText("Planned one").closest("li") as HTMLElement;
    await userEvent.setup().click(within(row).getByRole("button", { name: "Commit" }));
    const dialog = await screen.findByRole("dialog", { name: "Swap with..." });
    expect(dialog).toHaveTextContent("Tomorrow's 3 is full. Pick one to swap out.");
  });

  it("Later reschedules to the inbox", async () => {
    const { mock } = setup();
    const row = screen.getByText("Carried one").closest("li") as HTMLElement;
    await userEvent.setup().click(within(row).getByRole("button", { name: "Later" }));
    await waitFor(() => expect(mock.calls.length).toBeGreaterThan(0));
    expect(mock.calls[0].url).toBe("/api/tasks/reschedule");
    expect(mock.calls[0].body).toMatchObject({ ids: [B.id], day: null });
  });

  it("a complex task has no Later button, a simple one does", () => {
    const complex = makeTask({
      id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      title: "Complex one",
      scheduled: TOMORROW,
      isComplex: true,
      finishDate: "2026-11-20",
    });
    setup([complex, A], []);
    const complexRow = screen.getByText("Complex one").closest("li") as HTMLElement;
    const simpleRow = screen.getByText("Planned one").closest("li") as HTMLElement;
    expect(within(complexRow).queryByRole("button", { name: "Later" })).toBeNull();
    expect(within(complexRow).getByRole("button", { name: "Commit" })).toBeInTheDocument();
    expect(within(complexRow).getByRole("button", { name: "Move to trash" })).toBeInTheDocument();
    expect(within(simpleRow).getByRole("button", { name: "Later" })).toBeInTheDocument();
  });

  it("Move to trash sends the trash request", async () => {
    const { mock } = setup();
    const row = screen.getByText("Planned one").closest("li") as HTMLElement;
    await userEvent.setup().click(within(row).getByRole("button", { name: "Move to trash" }));
    await waitFor(() => expect(mock.calls.some((c) => c.url.includes(`/api/tasks/${A.id}`))).toBe(true));
  });

  it("shows the empty line", () => {
    setup([], []);
    expect(screen.getByText("Nothing planned for tomorrow yet.")).toBeInTheDocument();
  });
});
