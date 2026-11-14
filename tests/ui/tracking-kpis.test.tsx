import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import TrackingKpis, { type TrackingKpisProps } from "@/components/tracking/TrackingKpis";
import { fmtHours } from "@/lib/tracking-stats";

const base: TrackingKpisProps = {
  thisWeek: 680,
  lastWeek: 555,
  dailyAverage: 170,
  weekdays: 4,
  accuracy: 82,
  overByAvg: 18,
  sessions: 14,
  longest: 112,
  sparks: {
    week: [4, 6, 5],
    average: [3, 4, 3],
    accuracy: [6, 7, 5],
    sessions: [2, 3, 2],
  },
};

const setup = (o: Partial<TrackingKpisProps> = {}) =>
  render(<TrackingKpis {...base} {...o} />);

describe("TrackingKpis", () => {
  test("four captions in order", () => {
    setup();
    const caps = screen.getAllByRole("term").map((e) => e.textContent);
    expect(caps).toEqual(["This week", "Daily average", "Plan accuracy", "Sessions"]);
  });

  test("values go through fmt", () => {
    setup();
    expect(screen.getByText(fmtHours(680))).toBeTruthy();
    expect(screen.getByText(fmtHours(170))).toBeTruthy();
    expect(screen.getByText("82%")).toBeTruthy();
    expect(screen.getByText("14")).toBeTruthy();
    expect(screen.getByText(fmtHours(112))).toBeTruthy();
    expect(screen.getByText(`by ${fmtHours(18)} avg`)).toBeTruthy();
  });

  test("positive delta has the up tone", () => {
    setup();
    const delta = screen.getByText(`+${fmtHours(125)}`);
    expect(delta.closest("span.text-ok")).not.toBeNull();
  });

  test("negative delta is neutral", () => {
    setup({ thisWeek: 100, lastWeek: 145 });
    const delta = screen.getByText(`-${fmtHours(45)}`);
    expect(delta.closest("span.text-ok")).toBeNull();
  });

  test("ahead of a zero last week is up and ok-toned", () => {
    setup({ lastWeek: 0 });
    const delta = screen.getByText(`+${fmtHours(680)}`);
    expect(delta.closest("span.text-ok")).not.toBeNull();
  });

  test("a drop is neutral, never hi", () => {
    setup({ thisWeek: 100, lastWeek: 145 });
    const delta = screen.getByText(`-${fmtHours(45)}`);
    expect(delta.closest("span.text-hi")).toBeNull();
  });

  test("nothing tracked either week is a neutral first week", () => {
    setup({ thisWeek: 0, lastWeek: 0 });
    const delta = screen.getByText("First week");
    expect(delta.closest("span.text-ok")).toBeNull();
  });

  test("equal non-zero weeks read Same, neutral", () => {
    setup({ thisWeek: 90, lastWeek: 90 });
    expect(screen.getByText("Same").closest("span.text-ok")).toBeNull();
  });

  test("null accuracy and within estimate", () => {
    setup({ accuracy: null, overByAvg: 0 });
    expect(screen.getByText("No estimates")).toBeTruthy();
    expect(screen.getByText("Within estimate")).toBeTruthy();
  });

  test("singular day", () => {
    setup({ weekdays: 1 });
    expect(screen.getByText("1 day")).toBeTruthy();
  });

  test("sparks are labelled", () => {
    setup();
    expect(screen.getByRole("img", { name: "This week, last 12 days" })).toBeTruthy();
  });
});
