import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import CommitStar from "@/components/today/CommitStar";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

const TODAY = "2026-11-12";
const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const others = ["bbbbbbbb", "cccccccc", "dddddddd"].map((p, i) =>
  makeTask({ id: `${p}-bbbb-4bbb-8bbb-bbbbbbbbbbbb`, title: `Committed ${i + 1}`, committedOn: TODAY }),
);

function setup(task = makeTask({ id: ID, scheduled: TODAY })) {
  return renderWorkspace(
    <CommitStar task={task} todayISO={TODAY} />,
    emptyWorkspace({ tasks: [task, ...others] }),
  );
}

const hasCall = (mock: { calls: { url: string; method: string }[] }, url: string, method: string) =>
  mock.calls.some((c) => c.url === url && c.method === method);

afterEach(() => vi.restoreAllMocks());

describe("CommitStar", () => {
  it("is unpressed when not committed today", () => {
    setup();
    const b = screen.getByRole("button", { name: "Add to Today's 3" });
    expect(b).toHaveAttribute("aria-pressed", "false");
  });

  it("is pressed when committed today", () => {
    setup(makeTask({ id: ID, committedOn: TODAY }));
    expect(screen.getByRole("button", { name: "Remove from Today's 3" })).toHaveAttribute("aria-pressed", "true");
  });

  it("click sends the commit request", async () => {
    const { mock } = setup();
    mock.respondWith(`/api/tasks/${ID}/commit`, makeTask({ id: ID, committedOn: TODAY }));
    await userEvent.setup().click(screen.getByRole("button", { name: "Add to Today's 3" }));
    await waitFor(() => expect(hasCall(mock, `/api/tasks/${ID}/commit`, "POST")).toBe(true));
    expect(mock.calls.at(-1)?.body).toEqual({ day: TODAY });
  });

  it("click when committed uncommits", async () => {
    const { mock } = setup(makeTask({ id: ID, committedOn: TODAY }));
    await userEvent.setup().click(screen.getByRole("button", { name: "Remove from Today's 3" }));
    await waitFor(() => expect(hasCall(mock, `/api/tasks/${ID}/commit`, "DELETE")).toBe(true));
  });

  it("a full day opens the Swap dialog listing the three, and Swap uncommits then commits", async () => {
    const { mock } = setup();
    mock.failNext(`/api/tasks/${ID}/commit`, 409, "Today is full", { committed: others });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Add to Today's 3" }));
    const dialog = await screen.findByRole("dialog", { name: "Swap with..." });
    expect(dialog).toHaveTextContent("Today's 3 is full. Pick one to swap out.");
    for (const o of others) expect(within(dialog).getByText(o.title)).toBeInTheDocument();
    expect(within(dialog).getAllByRole("button", { name: "Swap" })).toHaveLength(3);

    mock.respondWith(`/api/tasks/${ID}/commit`, makeTask({ id: ID, committedOn: TODAY }));
    await user.click(within(dialog).getAllByRole("button", { name: "Swap" })[1]);
    await waitFor(() => expect(mock.calls.filter((c) => c.url.endsWith("/commit"))).toHaveLength(3));
    const commits = mock.calls.filter((c) => c.url.endsWith("/commit"));
    expect(commits[1]).toMatchObject({ url: `/api/tasks/${others[1].id}/commit`, method: "DELETE" });
    expect(commits[2]).toMatchObject({ url: `/api/tasks/${ID}/commit`, method: "POST" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("Cancel closes the dialog without swapping", async () => {
    const { mock } = setup();
    mock.failNext(`/api/tasks/${ID}/commit`, 409, "Today is full", { committed: others });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Add to Today's 3" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mock.calls).toHaveLength(1);
  });
});
