import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MomentumCard from "@/components/today/MomentumCard";
import type { Momentum } from "@/lib/momentum";

const data: Momentum = {
  sentence: "You have cleared the small things.",
  done: 3,
  total: 8,
  percent: 38,
  foot: "Most of today went to MSM26 backdrops.",
};

describe("MomentumCard", () => {
  it("renders heading, sentence, counts, percent and meter", () => {
    render(<MomentumCard data={data} todayISO="2026-11-12" />);
    expect(screen.getByRole("heading", { name: "Momentum" })).toBeTruthy();
    expect(screen.getByText(data.sentence)).toBeTruthy();
    expect(screen.getByText("3 of 8 tasks done")).toBeTruthy();
    expect(screen.getByText("38%")).toBeTruthy();
    expect(screen.getByText("Thu 12 Nov")).toBeTruthy();
    const meter = screen.getByRole("meter", { name: "Day progress" });
    expect(meter.getAttribute("aria-valuenow")).toBe("38");
    expect(screen.getByText(data.foot as string)).toBeTruthy();
  });

  it("uses the glow section and a filled tile", () => {
    const { container } = render(<MomentumCard data={data} todayISO="2026-11-12" />);
    expect(container.querySelector(".mom-glow")).toBeTruthy();
    expect(container.querySelector(".bg-mom-tile")).toBeTruthy();
  });

  it("shows the fallback footer when foot is null", () => {
    render(<MomentumCard data={{ ...data, foot: null }} todayISO="2026-11-12" />);
    expect(screen.queryByText(/backdrops/)).toBeNull();
    const foot = screen.getByText("Nothing tracked yet today.");
    expect(foot.className).toContain("shadow-hairline-top");
    expect(foot.className).not.toContain("border-t");
    expect(foot.className).toContain("px-4");
    expect(foot.className).toContain("py-3");
  });

  it("draws the footer hairline when data.foot is present", () => {
    render(<MomentumCard data={data} todayISO="2026-11-12" />);
    const foot = screen.getByText(data.foot as string);
    expect(foot.className).toContain("shadow-hairline-top");
    expect(foot.className).toContain("text-secondary");
  });
});
