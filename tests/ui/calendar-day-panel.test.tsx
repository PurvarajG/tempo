import { describe, expect, test } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DayPanelBody } from "@/components/calendar/DayPanel";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

const DAY = "2026-03-10";

describe("DayPanelBody v2 form", () => {
  test("the add field sits in a composer frame with a plus icon", () => {
    renderWorkspace(<DayPanelBody iso={DAY} tasks={[]} />, emptyWorkspace());
    const input = screen.getByLabelText("Add a task on this day");
    const frame = input.closest(".composer-frame") as HTMLElement;
    expect(frame).not.toBeNull();
    expect(frame.querySelector("svg")).not.toBeNull();
    expect(input).toHaveAttribute("data-day-add-input");
  });

  test("a task's estimate renders as an icon item, not bare text", () => {
    const t = makeTask({ scheduled: DAY, title: "Standup", minutes: 30 });
    renderWorkspace(<DayPanelBody iso={DAY} tasks={[t]} />, emptyWorkspace({ tasks: [t] }));
    const item = screen.getByText("30m").closest("span") as HTMLElement;
    expect(item.querySelector("svg")).not.toBeNull();
  });

  test("Move date then a new date keeps dueTime by sending only the date", async () => {
    const t = makeTask({ scheduled: DAY, title: "Standup", dueTime: "09:30" });
    const { mock } = renderWorkspace(<DayPanelBody iso={DAY} tasks={[t]} />, emptyWorkspace({ tasks: [t] }));
    await userEvent.click(screen.getByRole("button", { name: "Move date for Standup" }));
    const field = screen.getByLabelText("New date for Standup");
    await userEvent.clear(field);
    await userEvent.type(field, "2026-03-18");
    await waitFor(() =>
      expect(mock.calls).toContainEqual({
        url: `/api/tasks/${t.id}`,
        method: "PATCH",
        body: { scheduled: "2026-03-18" },
      }),
    );
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });

  test("Cancel closes the date picker", async () => {
    const t = makeTask({ scheduled: DAY, title: "Standup" });
    renderWorkspace(<DayPanelBody iso={DAY} tasks={[t]} />, emptyWorkspace({ tasks: [t] }));
    await userEvent.click(screen.getByRole("button", { name: "Move date for Standup" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("New date for Standup")).toBeNull();
  });

  test("the Apple Calendar section is absent when empty and present with events", () => {
    const { unmount } = renderWorkspace(<DayPanelBody iso={DAY} tasks={[]} />, emptyWorkspace());
    expect(screen.queryByText("From Apple Calendar")).toBeNull();
    unmount();
    renderWorkspace(
      <DayPanelBody
        iso={DAY}
        tasks={[]}
        externalEvents={[{ id: "e1", title: "Dentist", start: "2026-03-10T14:00:00.000Z", end: "2026-03-10T15:00:00.000Z", allDay: false }]}
      />,
      emptyWorkspace(),
    );
    const section = screen.getByText("From Apple Calendar").closest("section") as HTMLElement;
    expect(within(section).queryByRole("button")).toBeNull();
  });
});
