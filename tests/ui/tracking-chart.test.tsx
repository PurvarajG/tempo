import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TimeByDayChart from "@/components/tracking/TimeByDayChart";
import { fmtHours } from "@/lib/tracking-stats";

const DAYS = [
  "2026-11-09",
  "2026-11-10",
  "2026-11-11",
  "2026-11-12",
  "2026-11-13",
  "2026-11-14",
  "2026-11-15",
  "2026-11-16",
];
const TRACKED = [60, 120, 0, 105, 30, 0, 0, 240];
const PLANNED = [90, 120, 60, 260, 0, 0, 0, 0];

function chart() {
  return render(
    <TimeByDayChart days={DAYS} tracked={TRACKED} planned={PLANNED} todayISO="2026-11-12" />,
  );
}

describe("TimeByDayChart", () => {
  it("shows the heading, the total and the big-value class", () => {
    chart();
    expect(screen.getByRole("heading", { name: "Time by day" })).toBeTruthy();
    const total = screen.getByText("9h 15m");
    expect(total.className).toContain("text-chart-total");
    expect(screen.getByText("Total tracked")).toBeTruthy();
  });

  it("draws one column per day with 16 dots and the right filled count", () => {
    chart();
    const cols = screen.getAllByRole("img");
    expect(cols).toHaveLength(8);
    cols.forEach((c) => expect(c.querySelectorAll("i")).toHaveLength(16));
    const mon = screen.getByRole("img", { name: "Mon 9 Nov, 1h tracked, 1h 30m planned" });
    expect(mon.querySelectorAll("i.bg-ink")).toHaveLength(2);
    expect(mon.getAttribute("tabindex")).toBe("0");
  });

  it("fills only today's column in the accent colour", () => {
    chart();
    const today = screen.getByRole("img", { name: "Thu 12 Nov, 1h 45m tracked, 4h 20m planned" });
    expect(today.getAttribute("data-today")).toBe("true");
    expect(today.querySelectorAll("i.bg-accent")).toHaveLength(4);
    expect(today.querySelectorAll("i.bg-ink")).toHaveLength(0);
    expect(document.querySelectorAll("[data-today]")).toHaveLength(1);
  });

  it("shows a tooltip with Tracked and Planned on hover", () => {
    chart();
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.mouseEnter(screen.getByRole("img", { name: /^Thu 12 Nov/ }));
    const tip = screen.getByRole("tooltip");
    expect(within(tip).getByText("Thu 12 Nov")).toBeTruthy();
    expect(within(tip).getByText("Tracked")).toBeTruthy();
    expect(within(tip).getByText("1h 45m")).toBeTruthy();
    expect(within(tip).getByText("Planned")).toBeTruthy();
    expect(within(tip).getByText("4h 20m")).toBeTruthy();
  });

  it("groups into Monday-start weeks under By week", () => {
    chart();
    fireEvent.click(screen.getByRole("radio", { name: "By week" }));
    const cols = screen.getAllByRole("img");
    expect(cols).toHaveLength(2);
    expect(screen.getByRole("img", { name: "Week of 9 Nov, 5h 15m tracked, 8h 50m planned" })).toBeTruthy();
    fireEvent.focus(cols[1]);
    expect(within(screen.getByRole("tooltip")).getByText("Week of 16 Nov")).toBeTruthy();
    expect(screen.getByText("9h 15m")).toBeTruthy();
  });
});

describe("TimeByDayChart scaling and hours", () => {
  it("scales day mode to the peak when a day is over 8h", () => {
    const { container } = render(
      <TimeByDayChart
        days={["2026-11-09", "2026-11-10"]}
        tracked={[600, 300]}
        planned={[0, 0]}
        todayISO="2026-11-30"
      />,
    );
    const cols = screen.getAllByRole("img");
    const filled = (el: Element) => el.querySelectorAll("i.bg-ink, i.bg-accent").length;
    const unit = Math.max(30, Math.ceil(600 / 16 / 30) * 30);
    expect(filled(cols[0])).toBe(Math.min(16, Math.round(600 / unit)));
    const half = filled(cols[1]);
    expect(half).toBe(Math.round(300 / unit));
    expect(filled(cols[0])).toBeGreaterThan(half);
    expect(cols[1].querySelectorAll("i.bg-off").length).toBe(16 - half);
    expect(within(container).getByText(fmtHours(unit * 16))).toBeTruthy();
  });

  it("reads totals over 24h in hours, never days", () => {
    render(
      <TimeByDayChart
        days={["2026-11-09", "2026-11-10"]}
        tracked={[1500, 1415]}
        planned={[0, 0]}
        todayISO="2026-11-30"
      />,
    );
    expect(screen.getByText("48h 35m")).toBeTruthy();
  });
});
