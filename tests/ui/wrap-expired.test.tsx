import { useEffect, useState } from "react";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import ExpiredNotice from "@/components/wrap/ExpiredNotice";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

// The harness mock only exists after render, so the notice mounts once the response is canned.
let openGate: () => void = () => {};
let remountGate: () => void = () => {};
function Gate() {
  const [open, setOpen] = useState(false);
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    openGate = () => setOpen(true);
    remountGate = () => setGeneration((g) => g + 1);
  }, []);
  return open ? <ExpiredNotice key={generation} todayISO="2026-03-01" /> : null;
}

function setup(expired: unknown[]) {
  const view = renderWorkspace(<Gate />, emptyWorkspace());
  view.mock.respondWith("/api/tasks/expire", expired);
  act(() => openGate());
  return view;
}

const expireCalls = (mock: ReturnType<typeof setup>["mock"]) =>
  mock.calls.filter((c) => c.url === "/api/tasks/expire");

describe("ExpiredNotice", () => {
  it("lists expired tasks once", async () => {
    const { mock } = setup([
      makeTask({ id: A, title: "Old draft" }),
      makeTask({ id: B, title: "Stale note" }),
    ]);
    expect(await screen.findByText("2 tasks expired.")).toBeTruthy();
    expect(screen.getByText("Old draft, Stale note")).toBeTruthy();
    expect(expireCalls(mock)).toHaveLength(1);
  });

  it("uses the singular for one task", async () => {
    setup([makeTask({ id: A, title: "Old draft" })]);
    expect(await screen.findByText("1 task expired.")).toBeTruthy();
  });

  it("restores every task on Undo and disappears", async () => {
    const user = userEvent.setup();
    const { mock } = setup([
      makeTask({ id: A, title: "Old draft" }),
      makeTask({ id: B, title: "Stale note" }),
    ]);
    await screen.findByText("2 tasks expired.");
    await user.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(screen.queryByText("2 tasks expired.")).toBeNull());
    for (const id of [A, B]) {
      expect(mock.calls.some((c) => c.url === `/api/tasks/${id}/restore` && c.method === "POST")).toBe(true);
      const patch = mock.calls.find((c) => c.url === `/api/tasks/${id}` && c.method === "PATCH");
      expect(patch?.body).toEqual({ expiresOn: null });
    }
  });

  it("does not expire the tasks again after Undo and a remount", async () => {
    const user = userEvent.setup();
    const { mock, container } = setup([makeTask({ id: A, title: "Old draft" })]);
    await screen.findByText("1 task expired.");
    await user.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(screen.queryByText("1 task expired.")).toBeNull());
    mock.respondWith("/api/tasks/expire", []);
    act(() => remountGate());
    await waitFor(() => expect(expireCalls(mock)).toHaveLength(2));
    expect(container.textContent).toBe("");
    expect(screen.queryByText(/tasks? expired/)).toBeNull();
  });

  it("renders nothing when nothing expired", async () => {
    const { mock, container } = setup([]);
    await waitFor(() => expect(expireCalls(mock)).toHaveLength(1));
    expect(container.textContent).toBe("");
  });
});
