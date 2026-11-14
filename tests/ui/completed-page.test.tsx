import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import CompletedPage from "@/app/completed/page";
import { fmt, fmtDate } from "@/lib/format";
import { addDays, toISODate } from "@/lib/parse";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

const todayISO = toISODate(new Date());
const at = (iso: string, h = 12) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, h).toISOString();
};
const lastYear = `${Number(todayISO.slice(0, 4)) - 1}-06-15`;
const yesterday = addDays(todayISO, -1);

const T1 = makeTask({ id: "aaaaaaaa-1111-4111-8111-111111111111", title: "Book van", minutes: 15, status: "done", completedAt: at(todayISO, 9) });
const T2 = makeTask({ id: "bbbbbbbb-1111-4111-8111-111111111111", title: "Pay tax", minutes: 90, status: "done", completedAt: at(todayISO, 11) });
const T3 = makeTask({ id: "cccccccc-1111-4111-8111-111111111111", title: "Old job", minutes: 45, status: "done", completedAt: at(lastYear) });
const T4 = makeTask({ id: "dddddddd-1111-4111-8111-111111111111", title: "Yesterday job", minutes: 20, status: "done", completedAt: at(yesterday) });

describe("Completed page", () => {
  test("groups by local day, newest first, with totals and years", async () => {
    renderWorkspace(<CompletedPage />, emptyWorkspace({ tasks: [T3, T1, T4, T2] }));
    await screen.findByText("Today");
    expect(screen.getByText("1h 45m")).toBeInTheDocument();
    expect(screen.getByText(fmt(105))).toBeInTheDocument();
    expect(screen.getByText(fmtDate(yesterday, todayISO))).toBeInTheDocument();
    expect(screen.getByText(fmtDate(lastYear, todayISO))).toBeInTheDocument();
    expect(fmtDate(lastYear, todayISO)).toContain(lastYear.slice(0, 4));
    const titles = screen.getAllByText(/Book van|Pay tax|Yesterday job|Old job/).map((n) => n.textContent);
    expect(titles.indexOf("Pay tax")).toBeLessThan(titles.indexOf("Book van"));
    expect(titles.indexOf("Book van")).toBeLessThan(titles.indexOf("Yesterday job"));
    expect(titles.indexOf("Yesterday job")).toBeLessThan(titles.indexOf("Old job"));
    expect(screen.getByText("4 tasks done.")).toBeInTheDocument();
  });

  test("rows offer Reopen only and it reopens", async () => {
    const { mock } = renderWorkspace(<CompletedPage />, emptyWorkspace({ tasks: [T1, T2] }));
    await screen.findByText("Book van");
    expect(screen.queryByLabelText(/More actions/)).not.toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: "Reopen" });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1]);
    await waitFor(() => expect(mock.calls.some((c) => c.url.endsWith("/reopen"))).toBe(true));
  });

  test("singular subtitle and empty state", async () => {
    const one = renderWorkspace(<CompletedPage />, emptyWorkspace({ tasks: [T1] }));
    expect(await screen.findByText("1 task done.")).toBeInTheDocument();
    one.unmount();
    renderWorkspace(<CompletedPage />, emptyWorkspace({ tasks: [] }));
    expect(await screen.findAllByText("Nothing done yet.")).not.toHaveLength(0);
  });
});
