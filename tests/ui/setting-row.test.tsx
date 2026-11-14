import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SettingRow from "@/components/settings/SettingRow";

describe("SettingRow", () => {
  it("shows label and description", () => {
    render(<ul><SettingRow label="Name" description="Helpful text" control={<input />} /></ul>);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Helpful text")).toBeInTheDocument();
  });

  it("links the label to the control with htmlFor", () => {
    render(<ul><SettingRow label="Hour" htmlFor="h" control={<select id="h" />} /></ul>);
    expect(screen.getByLabelText("Hour").tagName).toBe("SELECT");
  });

  it("uses a plain span without htmlFor", () => {
    render(<ul><SettingRow label="Plain" control={<input />} /></ul>);
    expect(screen.getByText("Plain").tagName).toBe("SPAN");
  });

  it("wraps the control below the label when narrow", () => {
    render(
      <ul>
        <SettingRow label="Weekly reset" htmlFor="wr" description="Day the week starts" control={<input id="wr" data-testid="ctl" />} />
      </ul>,
    );
    const li = screen.getByRole("listitem");
    expect(li).toHaveClass("flex", "flex-wrap", "items-center");
    const labelBlock = screen.getByText("Weekly reset").parentElement as HTMLElement;
    expect(labelBlock).toHaveClass("min-w-0", "flex-1");
    expect(screen.getByTestId("ctl").parentElement).toHaveClass("shrink-0", "flex", "items-center");
    expect(screen.getByText("Weekly reset")).toHaveAttribute("for", "wr");
  });
});
