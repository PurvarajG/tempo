import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import NotificationsButton from "@/components/NotificationsButton";
import { useTasks } from "@/lib/store-context";
import { toISODate } from "@/lib/parse";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push }),
}));

const rect = (r: Partial<DOMRect>): DOMRect =>
  ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => {}, ...r }) as DOMRect;

const TODAY = toISODate(new Date());
const OTHER_DAY = toISODate(new Date(Date.now() + 3 * 86_400_000));

let n = 0;
const task = (o: Parameters<typeof makeTask>[0]) =>
  makeTask({ id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`, scheduled: TODAY, ...o });

function OpenId() {
  const { openTaskId } = useTasks();
  return <output data-testid="open-id">{openTaskId ?? ""}</output>;
}

const nudgeSettings = (nudgeMinutes: number | null) => {
  const w = emptyWorkspace();
  return { ...w, trackingSettings: { ...w.trackingSettings, nudgeMinutes } };
};

describe("NotificationsButton", () => {
  beforeEach(() => {
    push.mockClear();
    Element.prototype.getBoundingClientRect = vi.fn(function (this: Element) {
      if (this.hasAttribute("data-picker-menu")) return rect({ height: 160, width: 288 });
      if (this.getAttribute("aria-haspopup") === "dialog") return rect({ top: 14, bottom: 50, left: 1000, right: 1036, width: 36, height: 36 });
      return rect({});
    }) as unknown as typeof Element.prototype.getBoundingClientRect;
  });

  test("is an icon button named Notifications inside a no-drag wrapper", () => {
    renderWorkspace(<NotificationsButton />);
    const btn = screen.getByRole("button", { name: "Notifications" });
    expect(btn).toHaveAttribute("data-part", "icon-btn");
    expect(btn.closest(".no-drag")).not.toBeNull();
    expect(btn.className).toContain("size-9");
    expect(btn.className).toContain("rounded-full");
  });

  test("lists today's open timed tasks by time in 24-hour form and skips the rest", async () => {
    const tasks = [
      task({ title: "Afternoon call", dueTime: "15:30" }),
      task({ title: "Early run", dueTime: "07:05" }),
      task({ title: "No time" }),
      task({ title: "Already done", dueTime: "09:00", status: "done" }),
      task({ title: "Other day", dueTime: "10:00", scheduled: OTHER_DAY }),
      task({ title: "Hidden for now", dueTime: "11:00", startOn: OTHER_DAY }),
    ];
    renderWorkspace(<NotificationsButton />, emptyWorkspace({ tasks }));
    await userEvent.click(await screen.findByRole("button", { name: "Notifications" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(within(dialog).getByText("Early run")).toBeInTheDocument());
    const text = dialog.textContent ?? "";
    expect(text.indexOf("Early run")).toBeLessThan(text.indexOf("Afternoon call"));
    expect(within(dialog).getByText("07:05")).toBeInTheDocument();
    expect(within(dialog).getByText("15:30")).toBeInTheDocument();
    for (const t of ["No time", "Already done", "Other day", "Hidden for now"]) {
      expect(within(dialog).queryByText(t)).toBeNull();
    }
  });

  test("shows the empty state", async () => {
    renderWorkspace(<NotificationsButton />);
    await userEvent.click(await screen.findByRole("button", { name: "Notifications" }));
    expect(await screen.findByText("Nothing due today.")).toBeInTheDocument();
  });

  test("selecting a reminder opens the task and closes the popover", async () => {
    const t = task({ title: "Send invoice", dueTime: "09:00" });
    renderWorkspace(
      <>
        <NotificationsButton />
        <OpenId />
      </>,
      emptyWorkspace({ tasks: [t] }),
    );
    await userEvent.click(await screen.findByRole("button", { name: "Notifications" }));
    await userEvent.click(await screen.findByRole("button", { name: /Send invoice/ }));
    expect(screen.getByTestId("open-id")).toHaveTextContent(t.id);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("nudge line for a set value", async () => {
    renderWorkspace(<NotificationsButton />, nudgeSettings(90));
    await userEvent.click(await screen.findByRole("button", { name: "Notifications" }));
    expect(await screen.findByText("Nudge after 1h 30m without a timer.")).toBeInTheDocument();
  });

  test("nudge line when off, and the settings row routes to the Desktop section", async () => {
    renderWorkspace(<NotificationsButton />, nudgeSettings(null));
    await userEvent.click(await screen.findByRole("button", { name: "Notifications" }));
    expect(await screen.findByText("Nudges are off.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Reminder and nudge settings/ }));
    expect(push).toHaveBeenCalledWith("/settings#desktop");
  });

  test("Escape closes and focus returns to the trigger", async () => {
    renderWorkspace(<NotificationsButton />);
    const btn = await screen.findByRole("button", { name: "Notifications" });
    await userEvent.click(btn);
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(btn).toHaveFocus();
  });
});
