import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import Today from "@/components/Today";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

vi.mock("@/lib/useNow", async () => {
  const React = await import("react");
  return {
    useNow: () => React.useMemo(() => new Date(), []),
  };
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Today page", () => {
  test("a task planned, committed and picked as up next appears once", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-14T12:00:00"));
    const task = makeTask({
      scheduled: "2026-08-14",
      committedOn: "2026-08-14",
      title: "Ship the report",
    });
    renderWorkspace(<Today />, emptyWorkspace({ tasks: [task] }));

    await vi.waitFor(() => expect(screen.getAllByText("Ship the report").length).toBeGreaterThan(0));
    const main = screen.getByTestId("today-primary-pane");
    expect(main.textContent!.split("Ship the report").length - 1).toBe(1);
  });

  test("the Day tab shows the timeline and no Timeline range control", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-14T12:00:00"));
    renderWorkspace(<Today />);

    await userEvent.click(await screen.findByRole("radio", { name: "Day" }));

    expect(screen.getByTestId("today-timeline")).toBeInTheDocument();
    expect(screen.queryByLabelText("Timeline range")).not.toBeInTheDocument();
  });

  test("no Quick list; undated tasks show an Inbox link with the count", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-14T12:00:00"));
    const tasks = [
      makeTask({ id: "aaaaaaaa-1111-4111-8111-111111111111", scheduled: null, title: "Someday one" }),
      makeTask({ id: "aaaaaaaa-2222-4222-8222-222222222222", scheduled: null, title: "Someday two" }),
    ];
    renderWorkspace(<Today />, emptyWorkspace({ tasks }));

    expect(await screen.findByRole("link", { name: /Inbox, 2/ })).toBeInTheDocument();
    expect(screen.queryByText("Quick list")).not.toBeInTheDocument();
  });

  test("the composer carries the Cmd+N target id", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-14T12:00:00"));
    const { container } = renderWorkspace(<Today />);
    await screen.findByTestId("today-primary-pane");
    expect(container.querySelector("#doem-quick-add")).toBeInTheDocument();
  });

  test("the composer is not focused on load", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-14T12:00:00"));
    const { container } = renderWorkspace(<Today />);
    await screen.findByTestId("today-primary-pane");
    const composer = container.querySelector("#doem-quick-add") as HTMLElement;
    const input = composer.matches("input") ? composer : (composer.querySelector("input") as HTMLElement);
    expect(input).not.toBe(document.activeElement);
  });

  test("the headline says the day's done after the waking end hour", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-14T23:30:00"));
    renderWorkspace(<Today />);
    expect(await screen.findByText("Day's done.")).toBeInTheDocument();
  });

  test("Overdue never appears", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-14T12:00:00"));
    const task = makeTask({ scheduled: "2026-08-10", title: "Old thing" });
    const { container } = renderWorkspace(<Today />, emptyWorkspace({ tasks: [task] }));
    await screen.findByTestId("today-primary-pane");
    expect(container.textContent).not.toMatch(/overdue/i);
  });

  test("the head has no Today actions menu; the segmented control is List, Board, Day", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-14T12:00:00"));
    renderWorkspace(<Today />);

    await screen.findByTestId("today-primary-pane");
    expect(screen.queryByRole("button", { name: "Today actions" })).not.toBeInTheDocument();
    const group = screen.getByRole("radiogroup", { name: "Today view" });
    expect(within(group).getAllByRole("radio").map((r) => r.textContent)).toEqual(["List", "Board", "Day"]);
  });
});
