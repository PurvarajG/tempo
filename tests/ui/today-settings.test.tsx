import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TodaySection from "@/components/settings/TodaySection";
import { SETTINGS_DEFAULTS } from "@/lib/types";
import { fmtTime } from "@/lib/format";
import { emptyWorkspace, renderWorkspace } from "./harness";

const url = "/api/tracking-settings";

const rect = (r: Partial<DOMRect>): DOMRect =>
  ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}), ...r }) as DOMRect;

describe("Today settings", () => {
  // jsdom has no layout; the portalled menu stays hidden until it can measure itself.
  beforeEach(() => {
    Element.prototype.getBoundingClientRect = vi.fn(function (this: Element) {
      if (this.hasAttribute("data-picker-menu")) return rect({ height: 120, width: 120 });
      if (this.getAttribute("aria-haspopup") === "menu") return rect({ top: 100, bottom: 136, left: 20, right: 100, width: 80, height: 36 });
      return rect({});
    }) as unknown as typeof Element.prototype.getBoundingClientRect;
  });

  it("renders nothing before settings load", () => {
    const { container } = renderWorkspace(<TodaySection />);
    expect(container.textContent).toBe("");
  });

  it("shows the defaults", async () => {
    renderWorkspace(<TodaySection />, emptyWorkspace());
    const cap = await screen.findByRole("radio", { name: String(SETTINGS_DEFAULTS.todayCap) });
    expect(cap).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: "Wrap-up time" })).toHaveTextContent(
      fmtTime(`${String(SETTINGS_DEFAULTS.wrapHour).padStart(2, "0")}:00`),
    );
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const reset = screen.getByRole("radio", { name: days[SETTINGS_DEFAULTS.weeklyResetDay] });
    expect(reset).toHaveAttribute("aria-checked", "true");
    expect(within(screen.getByRole("radiogroup", { name: "Weekly reset" })).getAllByRole("radio")).toHaveLength(7);
  });

  it("has the Today's list control with 1, 3, 5 and patches todayCap", async () => {
    const { mock } = renderWorkspace(<TodaySection />);
    expect(await screen.findByText("Today's list")).toBeTruthy();
    const group = screen.getByRole("radiogroup", { name: "Today's list size" });
    expect(within(group).getAllByRole("radio").map((r) => r.textContent)).toEqual(["1", "3", "5"]);
    expect(SETTINGS_DEFAULTS.todayCap).toBe(3);
    fireEvent.click(await screen.findByRole("radio", { name: "5" }));
    expect(mock.calls[0]).toMatchObject({ url, method: "PATCH", body: { todayCap: 5 } });
  });

  it("patches wrapHour as a number", async () => {
    const { mock } = renderWorkspace(<TodaySection />);
    fireEvent.click(await screen.findByRole("button", { name: "Wrap-up time" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "09:00" }));
    expect(mock.calls[0]).toMatchObject({ url, method: "PATCH", body: { wrapHour: 9 } });
  });

  it("patches weeklyResetDay with the Sunday-based number", async () => {
    const { mock } = renderWorkspace(<TodaySection />);
    fireEvent.click(await screen.findByRole("radio", { name: "Mon" }));
    expect(mock.calls[0]).toMatchObject({ url, method: "PATCH", body: { weeklyResetDay: 1 } });
    fireEvent.click(screen.getByRole("radio", { name: "Sun" }));
    expect(mock.calls[1]).toMatchObject({ body: { weeklyResetDay: 0 } });
  });

  it("patches dateOrder", async () => {
    const { mock } = renderWorkspace(<TodaySection />);
    fireEvent.click(await screen.findByRole("radio", { name: "Month first" }));
    expect(mock.calls[0]).toMatchObject({ url, method: "PATCH", body: { dateOrder: "mdy" } });
  });
});
