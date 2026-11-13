import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import DaySchedule from "@/components/today/DaySchedule";
import type { DayPlan } from "@/lib/day-plan";
import { useTasks } from "@/lib/store-context";
import { makeTask, renderWorkspace } from "./harness";

function Open() {
  const { openTaskId } = useTasks();
  return <output data-testid="open">{openTaskId ?? ""}</output>;
}

const venue = makeTask({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", title: "Finalise venue", minutes: 45 });
const proofs = makeTask({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", title: "Backdrop proofs", minutes: 90 });
const draft = makeTask({ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", title: "Sponsor draft", minutes: 60 });

const plan: DayPlan = {
  label: "This afternoon",
  from: "14:00",
  to: "18:00",
  blocks: [
    { kind: "task", task: venue, start: "14:00", end: "14:45", minutes: 45, fixed: false, current: true },
    { kind: "task", task: proofs, start: "14:45", end: "16:15", minutes: 90, fixed: false, current: false },
    { kind: "free", start: "16:15", end: "17:00", minutes: 45, fits: draft },
    { kind: "free", start: "17:00", end: "18:00", minutes: 60, fits: null },
  ],
  leftover: [],
};

function show(p: DayPlan) {
  return renderWorkspace(
    <>
      <DaySchedule plan={p} />
      <Open />
    </>,
  );
}

describe("DaySchedule", () => {
  test("header shows label and range", () => {
    show(plan);
    expect(screen.getByText("This afternoon")).toBeInTheDocument();
    expect(screen.getByText("14:00 to 18:00")).toBeInTheDocument();
  });

  test("task title opens the panel", () => {
    show(plan);
    fireEvent.click(screen.getByRole("button", { name: "Finalise venue" }));
    expect(screen.getByTestId("open")).toHaveTextContent(venue.id);
    expect(screen.getAllByText("45m")).toHaveLength(2);
    expect(screen.getByText("1h 30m")).toBeInTheDocument();
  });

  test("current block has the now edge, not a full ring", () => {
    show(plan);
    const blk = screen.getByRole("button", { name: "Finalise venue" }).parentElement!;
    expect(blk).toHaveClass("shadow-now-edge");
    expect(blk).not.toHaveClass("inset-ring-accent");
    expect(blk).toHaveClass("rounded-tab");
  });

  test("free blocks with and without fits", () => {
    show(plan);
    expect(screen.getByText("Free, fits Sponsor draft")).toBeInTheDocument();
    expect(screen.getByText("Free")).toBeInTheDocument();
  });

  test("empty plan", () => {
    show({ ...plan, blocks: [] });
    expect(screen.getByText("Nothing left to place today.")).toBeInTheDocument();
  });

  test("leftover count", () => {
    show({ ...plan, leftover: [draft, proofs] });
    expect(screen.getByText("Not placed: 2")).toBeInTheDocument();
  });

  test("no dashes or middle dots in rendered text", () => {
    const { container } = show({ ...plan, leftover: [draft] });
    expect(container.textContent).not.toMatch(/[–—·]/);
  });
});
