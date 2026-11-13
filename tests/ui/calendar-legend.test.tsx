import { screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import CalendarLegend from "@/components/calendar/CalendarLegend";
import { emptyWorkspace, makeProject, renderWorkspace } from "./harness";

const A = makeProject({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Alpha" });
const B = makeProject({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Beta" });

async function renderLegend(ui: React.ReactElement) {
  const result = renderWorkspace(ui, emptyWorkspace({ projects: [A, B] }));
  await waitFor(() => expect(screen.getByLabelText("Calendar legend")).toBeInTheDocument());
  return result;
}

describe("CalendarLegend", () => {
  test("names in the given order, one swatch each, plus Planned and Tracked", async () => {
    await renderLegend(<CalendarLegend projectIds={[B.id, A.id]} />);
    const row = screen.getByLabelText("Calendar legend");
    await waitFor(() => expect(row.textContent).toContain("Beta"));
    expect(row.textContent).toBe("BetaAlphaPlannedTracked");
    expect(row.querySelectorAll(".legend-swatch")).toHaveLength(4);
    expect(row.querySelector(".legend-swatch.is-solid")).not.toBeNull();
    expect(row.querySelector(".legend-swatch.is-stripe")).not.toBeNull();
    row.querySelectorAll(".legend-swatch").forEach((s) => expect(s).toHaveAttribute("aria-hidden", "true"));
  });

  test("skips unknown ids", async () => {
    await renderLegend(<CalendarLegend projectIds={["missing", A.id]} showKinds={false} />);
    const row = screen.getByLabelText("Calendar legend");
    await waitFor(() => expect(row.textContent).toBe("Alpha"));
    expect(row.querySelectorAll(".legend-swatch")).toHaveLength(1);
  });

  test("showKinds false hides Planned and Tracked", async () => {
    await renderLegend(<CalendarLegend projectIds={[A.id]} showKinds={false} />);
    await waitFor(() => expect(screen.getByText("Alpha")).toBeInTheDocument());
    expect(screen.queryByText("Planned")).toBeNull();
    expect(screen.queryByText("Tracked")).toBeNull();
  });

  test("root never shrinks and wraps; items never wrap", async () => {
    await renderLegend(<CalendarLegend projectIds={[A.id]} tip="A tip" />);
    const row = screen.getByLabelText("Calendar legend");
    expect(row).toHaveClass("shrink-0");
    expect(row).toHaveClass("flex-wrap");
    expect(screen.getByText("Alpha")).toHaveClass("whitespace-nowrap");
    expect(screen.getByText("A tip")).toHaveClass("ml-auto");
  });

  test("renders the tip", async () => {
    await renderLegend(<CalendarLegend projectIds={[]} tip="A tip" />);
    expect(screen.getByText("A tip")).toBeInTheDocument();
  });
});
