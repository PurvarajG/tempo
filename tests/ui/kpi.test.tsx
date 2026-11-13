import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import Kpi from "@/components/ui/Kpi";

describe("Kpi", () => {
  test("renders label, value and unit", () => {
    render(<Kpi label="Tracked" value="6h 30m" unit="today" />);

    expect(screen.getByText("Tracked")).toBeInTheDocument();
    expect(screen.getByText(/6h 30m/)).toBeInTheDocument();
    expect(screen.getByText("today")).toBeInTheDocument();
  });

  test("value is reachable by its label", () => {
    render(<Kpi label="Tracked" value="1h 30m" />);

    expect(screen.getByRole("term")).toHaveTextContent("Tracked");
    expect(screen.getByRole("definition")).toHaveTextContent("1h 30m");
  });

  test("renders the visual slot", () => {
    render(<Kpi label="Done" value="4" visual={<svg data-testid="vis" />} />);
    expect(screen.getByTestId("vis")).toBeInTheDocument();
  });

  test("renders both foot parts and the up tone", () => {
    render(
      <Kpi
        label="Done"
        value="4"
        foot={{ label: "vs last week", value: "+2", tone: "up" }}
      />,
    );

    expect(screen.getByText("vs last week")).toBeInTheDocument();
    expect(screen.getByText("+2")).toHaveClass("text-ok");
  });

  test("neutral foot does not use text-ok", () => {
    render(<Kpi label="Done" value="4" foot={{ label: "Plan", value: "5" }} />);
    expect(screen.getByText("5")).not.toHaveClass("text-ok");
  });

  test("no foot renders no footer element", () => {
    render(<Kpi label="Done" value="4" />);
    expect(screen.queryByTestId("kpi-foot")).not.toBeInTheDocument();
  });
});

describe("Kpi mockup form", () => {
  test("root carries data-part kpi: hairline ring, no shadow, clipped", () => {
    const { container } = render(<Kpi label="Done" value="4" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("data-part", "kpi");
    for (const c of ["rounded-kpi", "bg-surface", "ring-1", "ring-line", "overflow-hidden"]) {
      expect(root).toHaveClass(c);
    }
    expect(root.className).not.toMatch(/shadow/);
  });

  test("value, unit and footer use the mockup tokens", () => {
    render(
      <Kpi label="Done" value="4" unit="h" foot={{ label: "Plan", value: "5" }} />,
    );
    expect(screen.getByRole("definition")).toHaveClass("font-mono", "text-kpi", "leading-none", "mt-2");
    expect(screen.getByText("h")).toHaveClass("text-secondary", "tracking-normal", "ml-1", "text-ink-3");
    expect(screen.getByTestId("kpi-foot")).toHaveClass("bg-sunk", "px-4", "py-2", "text-meta", "text-ink-3");
    expect(screen.getByText("5")).toHaveClass("font-medium", "text-ink-2");
  });
});
