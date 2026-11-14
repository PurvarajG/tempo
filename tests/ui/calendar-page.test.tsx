import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import CalendarPage from "@/app/calendar/page";
import { emptyWorkspace, makeProject, makeTask, renderWorkspace } from "./harness";

const replace = vi.fn();
let query = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(query),
}));

vi.mock("@/lib/useNow", () => ({
  useNow: () => new Date("2026-11-13T09:00:00.000Z"),
}));

function mount() {
  renderWorkspace(
    <CalendarPage />,
    emptyWorkspace({ tasks: [makeTask({ scheduled: "2026-11-13" })], projects: [makeProject()] }),
  );
}

describe("calendar page head", () => {
  beforeEach(() => {
    replace.mockClear();
    query = "";
  });

  test("H1 carries the month and the year as two tones", async () => {
    mount();
    const h1 = await screen.findByRole("heading", { level: 1 });
    expect(h1.textContent).toContain("November");
    expect(h1.querySelector("span")?.textContent).toBe("2026");
  });

  test("week view subtitle starts with the ISO week number", async () => {
    query = "view=week";
    mount();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByText(/^Week 46\./)).toBeTruthy();
  });

  test("the bare route opens on Month (decision 15)", async () => {
    query = "";
    mount();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText(/^Week 46\./)).toBeNull();
    expect(screen.getByRole("radio", { name: "Month" }).getAttribute("aria-checked")).toBe("true");
  });

  test("choosing Month from Week deletes the view param", async () => {
    query = "view=week";
    mount();
    await screen.findByRole("heading", { level: 1 });
    fireEvent.click(screen.getByRole("radio", { name: "Month" }));
    expect(replace).toHaveBeenCalledWith("/calendar", { scroll: false });
  });

  test("view tabs are a radiogroup and choosing Week writes ?view=week", async () => {
    mount();
    const group = await screen.findByRole("radiogroup", { name: "Calendar view" });
    expect(group.querySelectorAll('[role="radio"]')).toHaveLength(3);
    fireEvent.click(screen.getByRole("radio", { name: "Week" }));
    expect(replace).toHaveBeenCalledWith("/calendar?view=week", { scroll: false });
  });

  test("previous, Today and next controls exist and are named for the view", async () => {
    query = "view=week";
    mount();
    expect(await screen.findByRole("button", { name: "Previous week" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next week" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Today" })).toBeTruthy();
  });

  test("day view gives the grid wrapper a definite height below the rail breakpoint", async () => {
    query = "view=day";
    mount();
    const legend = await screen.findByLabelText("Calendar legend");
    const wrapper = legend.parentElement as HTMLElement;
    expect(wrapper.classList.contains("h-120")).toBe(true);
    expect(wrapper.classList.contains("rail:h-0")).toBe(true);
    expect(wrapper.classList.contains("rail:min-h-full")).toBe(true);
    expect(wrapper.classList.contains("shell:h-0")).toBe(false);
  });

  test("week view keeps the shell-level stretch classes", async () => {
    query = "view=week";
    mount();
    const legend = await screen.findByLabelText("Calendar legend");
    const wrapper = legend.parentElement as HTMLElement;
    expect(wrapper.classList.contains("shell:h-0")).toBe(true);
    expect(wrapper.classList.contains("shell:min-h-full")).toBe(true);
    expect(wrapper.classList.contains("h-120")).toBe(false);
  });

  test("the legend renders after the grid", async () => {
    mount();
    const legend = await screen.findByLabelText("Calendar legend");
    await waitFor(() => expect(legend.previousElementSibling).not.toBeNull());
  });

  test("the head wraps its actions under the title and the H1 never breaks", async () => {
    mount();
    await screen.findByRole("heading", { level: 1 });
    const frame = document.querySelector('[data-part="calendar-frame"]') as HTMLElement;
    expect(frame.className).toContain("[&_[data-part=head]]:flex-wrap");
    expect(frame.className).toContain("[&_[data-part=head]_h1]:whitespace-nowrap");
    expect(frame.querySelector('[data-part="head"]')).not.toBeNull();
  });

});
