import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import Segmented from "@/components/ui/Segmented";

const OPTIONS = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

function setup(
  props: Partial<React.ComponentProps<typeof Segmented<string>>> = {},
) {
  const onChange = vi.fn();
  render(
    <Segmented
      options={OPTIONS}
      value="week"
      onChange={onChange}
      ariaLabel="Range"
      {...props}
    />,
  );
  return onChange;
}

describe("Segmented", () => {
  test("renders a named radiogroup", () => {
    setup();
    expect(screen.getByRole("radiogroup", { name: "Range" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  test("checked option is tabbable, others are not", () => {
    setup();
    const week = screen.getByRole("radio", { name: "Week" });
    expect(week).toHaveAttribute("aria-checked", "true");
    expect(week).toHaveAttribute("tabindex", "0");
    for (const name of ["Day", "Month"]) {
      const r = screen.getByRole("radio", { name });
      expect(r).toHaveAttribute("aria-checked", "false");
      expect(r).toHaveAttribute("tabindex", "-1");
    }
  });

  test("click calls onChange", () => {
    const onChange = setup();
    fireEvent.click(screen.getByRole("radio", { name: "Month" }));
    expect(onChange).toHaveBeenCalledWith("month");
  });

  test("arrow keys move and wrap at the ends", () => {
    const onChange = setup();
    const week = screen.getByRole("radio", { name: "Week" });
    fireEvent.keyDown(week, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("month");
    fireEvent.keyDown(week, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith("day");
  });

  test("ArrowRight wraps from last to first, ArrowLeft from first to last", () => {
    const onChange = setup({ value: "month" });
    fireEvent.keyDown(screen.getByRole("radio", { name: "Month" }), {
      key: "ArrowRight",
    });
    expect(onChange).toHaveBeenLastCalledWith("day");
  });

  test("ArrowLeft wraps from first to last", () => {
    const onChange = setup({ value: "day" });
    fireEvent.keyDown(screen.getByRole("radio", { name: "Day" }), {
      key: "ArrowLeft",
    });
    expect(onChange).toHaveBeenLastCalledWith("month");
  });

  test("Home and End jump to the first and last option", () => {
    const onChange = setup();
    const week = screen.getByRole("radio", { name: "Week" });
    fireEvent.keyDown(week, { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith("day");
    fireEvent.keyDown(week, { key: "End" });
    expect(onChange).toHaveBeenLastCalledWith("month");
  });

  test("disabled options are skipped and not clickable", () => {
    const onChange = setup({
      options: [
        { value: "day", label: "Day" },
        { value: "week", label: "Week" },
        { value: "month", label: "Month", disabled: true },
      ],
      value: "week",
    });
    const month = screen.getByRole("radio", { name: "Month" });
    expect(month).toBeDisabled();
    expect(month.className).toContain("text-ink-3");
    fireEvent.click(month);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("radio", { name: "Week" }), {
      key: "ArrowRight",
    });
    expect(onChange).toHaveBeenLastCalledWith("day");
    fireEvent.keyDown(screen.getByRole("radio", { name: "Week" }), {
      key: "End",
    });
    expect(onChange).toHaveBeenLastCalledWith("week");
  });

  test("sm size changes the height class", () => {
    const { unmount } = render(
      <Segmented options={OPTIONS} value="day" onChange={() => {}} ariaLabel="A" />,
    );
    expect(screen.getByRole("radio", { name: "Day" }).className).toContain("h-[34px]");
    unmount();
    render(
      <Segmented
        options={OPTIONS}
        value="day"
        onChange={() => {}}
        ariaLabel="A"
        size="sm"
      />,
    );
    expect(screen.getByRole("radio", { name: "Day" }).className).toContain("h-[28px]");
  });

  test("renders an icon beside the label", () => {
    render(
      <Segmented
        options={[{ value: "a", label: "Alpha", icon: <svg data-testid="ic" /> }]}
        value="a"
        onChange={() => {}}
        ariaLabel="A"
      />,
    );
    expect(screen.getByTestId("ic")).toBeInTheDocument();
  });

  test("track carries data-part seg; selected is raised with shadow and ring", () => {
    setup();
    expect(screen.getByRole("radiogroup")).toHaveAttribute("data-part", "seg");
    const on = screen.getByRole("radio", { name: "Week" });
    expect(on).toHaveAttribute("aria-checked", "true");
    expect(on).toHaveClass("bg-raised", "text-ink", "font-medium", "shadow-sm", "ring-1", "ring-line");
    const off = screen.getByRole("radio", { name: "Day" });
    expect(off).toHaveClass("text-ink-3");
    expect(off).not.toHaveClass("bg-raised");
  });

  test("md and sm track and button sizes", () => {
    const { unmount } = render(
      <Segmented options={OPTIONS} value="day" onChange={() => {}} ariaLabel="A" />,
    );
    expect(screen.getByRole("radiogroup")).toHaveClass("bg-sunk", "p-1", "rounded-composer");
    expect(screen.getByRole("radio", { name: "Day" })).toHaveClass("rounded-tab", "text-body");
    unmount();
    render(
      <Segmented options={OPTIONS} value="day" onChange={() => {}} ariaLabel="A" size="sm" />,
    );
    expect(screen.getByRole("radiogroup")).toHaveClass("rounded-tab");
    expect(screen.getByRole("radio", { name: "Day" })).toHaveClass("text-meta", "rounded-tile");
  });
});
