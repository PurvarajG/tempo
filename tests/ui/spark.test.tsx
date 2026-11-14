import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import Spark from "@/components/ui/Spark";

function bars(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>("[data-spark-bar]"));
}

describe("Spark", () => {
  test("exposes an image role with the label", () => {
    render(<Spark values={[1, 2]} label="Focus hours, last 14 days" />);
    expect(screen.getByRole("img", { name: "Focus hours, last 14 days" })).toBeInTheDocument();
  });

  test("renders one bar per value and the tallest is 100%", () => {
    const { container } = render(<Spark values={[2, 8, 4]} label="x" />);
    const b = bars(container);
    expect(b).toHaveLength(3);
    expect(b[1].style.height).toBe("100%");
    expect(b[0].style.height).toBe("25%");
  });

  test("empty array renders without crashing", () => {
    const { container } = render(<Spark values={[]} label="x" />);
    expect(bars(container)).toHaveLength(0);
  });

  test("zero and negative values show stubs", () => {
    const { container } = render(<Spark values={[0, -3]} label="x" />);
    expect(bars(container).map((b) => b.style.height)).toEqual(["2px", "2px"]);
  });

  test("default highlights only the last bar", () => {
    const { container } = render(<Spark values={[1, 2, 3]} label="x" />);
    expect(bars(container).map((b) => b.dataset.on)).toEqual(["false", "false", "true"]);
  });

  test("highlight array highlights exactly those indexes", () => {
    const { container } = render(<Spark values={[1, 2, 3, 4]} label="x" highlight={[0, 2]} />);
    expect(bars(container).map((b) => b.dataset.on)).toEqual(["true", "false", "true", "false"]);
  });

  test("highlight none highlights nothing", () => {
    const { container } = render(<Spark values={[1, 2]} label="x" highlight="none" />);
    expect(bars(container).every((b) => b.dataset.on === "false")).toBe(true);
  });
});
