import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import Icon, { ICON_NAMES } from "@/components/ui/Icon";

function svgOf(container: HTMLElement) {
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("no svg");
  return svg;
}

describe("Icon", () => {
  test("ICON_NAMES has 28 unique entries", () => {
    expect(ICON_NAMES).toHaveLength(28);
    expect(new Set(ICON_NAMES).size).toBe(28);
    expect(ICON_NAMES).toContain("monitor");
    expect(ICON_NAMES).toContain("trash");
    expect(ICON_NAMES).toContain("more");
    expect(ICON_NAMES).toContain("x");
    expect(ICON_NAMES).toContain("inbox");
  });

  test.each([...ICON_NAMES])("%s renders a 24 box svg with shapes", (name) => {
    const { container } = render(<Icon name={name} />);
    const svg = svgOf(container);
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.children.length).toBeGreaterThan(0);
  });

  test("is aria-hidden by default", () => {
    const { container } = render(<Icon name="plus" />);
    const svg = svgOf(container);
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("focusable")).toBe("false");
    expect(svg.getAttribute("role")).toBeNull();
  });

  test("label gives role img with that name", () => {
    const { getByRole, container } = render(<Icon name="bell" label="Alerts" />);
    expect(getByRole("img", { name: "Alerts" })).toBeInTheDocument();
    expect(svgOf(container).getAttribute("aria-hidden")).toBeNull();
  });

  test("size sets width and height", () => {
    const { container } = render(<Icon name="sun" size={20} />);
    const svg = svgOf(container);
    expect(svg.getAttribute("width")).toBe("20");
    expect(svg.getAttribute("height")).toBe("20");
  });

  test("defaults to 16px with 1.5 stroke", () => {
    const { container } = render(<Icon name="sun" />);
    const svg = svgOf(container);
    expect(svg.getAttribute("width")).toBe("16");
    expect(svg.getAttribute("stroke-width")).toBe("1.5");
  });

  test("play is filled currentColor", () => {
    const { container } = render(<Icon name="play" />);
    expect(container.querySelector("path")?.getAttribute("fill")).toBe(
      "currentColor",
    );
  });

  test("className passes through", () => {
    const { container } = render(<Icon name="check" className="text-accent" />);
    const svg = svgOf(container);
    expect(svg.getAttribute("class")).toContain("text-accent");
    expect(svg.getAttribute("class")).toContain("shrink-0");
  });
});
