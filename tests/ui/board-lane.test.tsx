import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import Lane from "@/components/board/Lane";

describe("board Lane", () => {
  test("header shows the title and count, and the section is labelled", () => {
    render(<Lane title="Morning" count={2} glyph="cal"><li>a</li><li>b</li></Lane>);
    const region = screen.getByRole("region", { name: "Morning, 2 tasks" });
    expect(region.querySelector("h2")?.textContent).toBe("Morning2");
    expect(region.querySelector("h2 svg")).not.toBeNull();
  });

  test("singular label and custom aria label", () => {
    const { unmount } = render(<Lane title="A" count={1} glyph="cal" />);
    expect(screen.getByRole("region", { name: "A, 1 task" })).toBeInTheDocument();
    unmount();
    render(<Lane title="A" count={1} glyph="cal" ariaLabel="Custom" />);
    expect(screen.getByRole("region", { name: "Custom" })).toBeInTheDocument();
  });

  test("the live glyph draws a dot, not an icon", () => {
    const { container } = render(<Lane title="Now" count={1} glyph="live" />);
    expect(container.querySelector("h2 svg")).toBeNull();
    expect(container.querySelector("h2 .bg-ok")).not.toBeNull();
  });

  test("empty lane shows the default and a custom empty text", () => {
    const { unmount } = render(<Lane title="A" count={0} glyph="cal" />);
    expect(screen.getByText("Nothing here yet.")).toBeInTheDocument();
    unmount();
    render(<Lane title="A" count={0} glyph="cal" emptyText="Clear day." />);
    expect(screen.getByText("Clear day.")).toBeInTheDocument();
  });

  test("a lane with cards shows no empty text", () => {
    render(<Lane title="A" count={1} glyph="cal"><li>card</li></Lane>);
    expect(screen.queryByText("Nothing here yet.")).toBeNull();
  });

  test("no lane options menu", () => {
    render(<Lane title="A" count={1} glyph="cal" />);
    expect(screen.queryByRole("button", { name: /lane options/i })).toBeNull();
  });

  test("footer and header-right slots render", () => {
    render(
      <Lane title="A" count={1} glyph="cal" footer={<div>cap footer</div>} headerRight={<span>quiet</span>} />,
    );
    expect(screen.getByText("cap footer")).toBeInTheDocument();
    expect(screen.getByText("quiet")).toBeInTheDocument();
  });
});
