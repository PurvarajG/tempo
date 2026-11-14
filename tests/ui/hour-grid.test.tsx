import { useRef } from "react";
import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { CAL_PX_PER_HOUR, HourRail, useScrollToHour } from "@/components/time/HourGrid";

function Probe({ hour, resetKey }: { hour: number | null; resetKey?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollToHour(ref, hour, CAL_PX_PER_HOUR, resetKey);
  return <div ref={ref} data-testid="body" />;
}

describe("HourRail", () => {
  test("default variant renders 24 HH:00 labels", () => {
    const { container } = render(<HourRail windowStartHour={0} windowHours={24} height={1344} />);
    const labels = Array.from(container.querySelectorAll("span")).map((e) => e.textContent);
    expect(labels).toHaveLength(24);
    expect(labels[0]).toBe("00:00");
    expect(labels[23]).toBe("23:00");
    expect(container.querySelector(".uppercase")).not.toBeNull();
  });

  test("calendar variant renders plain mono labels, no uppercase", () => {
    const { container } = render(
      <HourRail variant="calendar" windowStartHour={0} windowHours={24} height={24 * CAL_PX_PER_HOUR} className="w-16 shrink-0" />,
    );
    const rows = Array.from((container.firstElementChild as HTMLElement).children);
    expect(rows).toHaveLength(24);
    expect(rows[8].textContent).toBe("08:00");
    expect(container.querySelector(".uppercase")).toBeNull();
    expect(container.querySelector("span")).toBeNull();
    expect((rows[3] as HTMLElement).style.height).toBe("56px");
    expect(rows[0].className).not.toContain("translate");
    expect(rows[1].className).toContain("-translate-y-1.75");
    for (const c of ["font-mono", "text-caption", "text-ink-3", "text-right", "pr-3"]) {
      expect(rows[1]).toHaveClass(c);
    }
  });
});

describe("useScrollToHour", () => {
  test("sets scrollTop to hour * 56", () => {
    const { getByTestId } = render(<Probe hour={7} />);
    expect(getByTestId("body").scrollTop).toBe(7 * 56);
  });

  test("does nothing while hour is null, then scrolls once it arrives", () => {
    const { getByTestId, rerender } = render(<Probe hour={null} />);
    expect(getByTestId("body").scrollTop).toBe(0);
    rerender(<Probe hour={6} />);
    expect(getByTestId("body").scrollTop).toBe(6 * 56);
  });

  test("rescrolls on resetKey change, not on plain re-render", () => {
    const { getByTestId, rerender } = render(<Probe hour={7} resetKey="a" />);
    const el = getByTestId("body");
    el.scrollTop = 10;
    rerender(<Probe hour={7} resetKey="a" />);
    expect(el.scrollTop).toBe(10);
    rerender(<Probe hour={7} resetKey="b" />);
    expect(el.scrollTop).toBe(7 * 56);
  });
});
