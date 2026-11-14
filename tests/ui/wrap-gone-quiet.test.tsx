import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import GoneQuiet from "@/components/wrap/GoneQuiet";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TODAY = "2026-03-10";
const tasks = [
  makeTask({ id: A, title: "Old one" }),
  makeTask({ id: B, title: "Older one" }),
];

const setup = (list = tasks) =>
  renderWorkspace(<GoneQuiet tasks={list} todayISO={TODAY} />, emptyWorkspace({ tasks: list }));

describe("GoneQuiet", () => {
  it("renders the header and rows", () => {
    setup();
    expect(screen.getByText("Gone quiet")).toBeTruthy();
    expect(screen.getByText("Untouched for 14 days")).toBeTruthy();
    expect(screen.getByText("Old one")).toBeTruthy();
    expect(screen.getByText("Older one")).toBeTruthy();
  });

  it("Keep removes the row with no request", async () => {
    const { mock } = setup();
    await act(async () => fireEvent.click(screen.getAllByRole("button", { name: "Keep" })[0]));
    expect(screen.queryByText("Old one")).toBeNull();
    expect(screen.getByText("Older one")).toBeTruthy();
    expect(mock.calls).toHaveLength(0);
  });

  it("Push back a week sets startOn to today plus 7", async () => {
    const { mock } = setup();
    await act(async () =>
      fireEvent.click(screen.getAllByRole("button", { name: "Push back a week" })[0]),
    );
    await waitFor(() => expect(mock.calls).toHaveLength(1));
    expect(mock.calls[0].method).toBe("PATCH");
    expect(mock.calls[0].url).toContain(`/api/tasks/${A}`);
    expect(mock.calls[0].body).toMatchObject({ startOn: "2026-03-17" });
  });

  it("Move to trash sends the trash request", async () => {
    const { mock } = setup();
    await act(async () =>
      fireEvent.click(screen.getAllByRole("button", { name: "Move to trash" })[0]),
    );
    await waitFor(() => expect(mock.calls.some((c) => c.url.includes(`/api/tasks/${A}`))).toBe(true));
  });

  it("shows a quiet line when empty or all kept", async () => {
    setup([]);
    expect(screen.getByText("Nothing has gone quiet.")).toBeTruthy();
  });
});
