import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import EstimateMisses from "@/components/wrap/EstimateMisses";
import { useTasks } from "@/lib/store-context";
import { makeTask, renderWorkspace } from "./harness";

function OpenProbe() {
  const { openTaskId } = useTasks();
  return <output data-testid="open">{openTaskId ?? "none"}</output>;
}

const A = makeTask({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", title: "Report" });
const B = makeTask({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", title: "Slides" });
const C = makeTask({ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", title: "Inbox sweep" });

const misses = [
  { task: A, planned: 30, actual: 110, over: 80 },
  { task: B, planned: 60, actual: 90, over: 30 },
  { task: C, planned: 45, actual: 25, over: -20 },
];

describe("EstimateMisses", () => {
  test("renders misses in order with planned and took text and pills", () => {
    renderWorkspace(<EstimateMisses misses={misses} />);
    const titles = screen.getAllByRole("button").map((b) => b.textContent);
    expect(titles).toEqual(["Report", "Slides", "Inbox sweep"]);
    expect(screen.getByText((_, el) => el?.textContent === "planned 30m, took 1h 50m")).toBeTruthy();
    expect(screen.getByText("+1h 20m")).toBeTruthy();
    expect(screen.getByText("20m under")).toBeTruthy();
  });

  test("title click opens the task panel", async () => {
    renderWorkspace(
      <>
        <EstimateMisses misses={misses} />
        <OpenProbe />
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Slides" }));
    expect(screen.getByTestId("open").textContent).toBe(B.id);
  });

  test("empty state", () => {
    renderWorkspace(<EstimateMisses misses={[]} />);
    expect(screen.getByText("Nothing tracked against an estimate today.")).toBeTruthy();
  });
});
