import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SettingsNav from "@/components/settings/SettingsNav";

const SECTIONS = [
  { id: "one", label: "First" },
  { id: "two", label: "Second" },
];

let trigger: (entries: unknown[]) => void = () => {};

beforeEach(() => {
  class IO {
    constructor(cb: (entries: unknown[]) => void) {
      trigger = cb;
    }
    observe() {}
    disconnect() {}
  }
  vi.stubGlobal("IntersectionObserver", IO);
  for (const s of SECTIONS) {
    const el = document.createElement("div");
    el.id = s.id;
    el.scrollIntoView = vi.fn();
    document.body.appendChild(el);
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("SettingsNav", () => {
  it("marks the first section current and scrolls on click", async () => {
    render(<SettingsNav sections={SECTIONS} />);
    expect(screen.getByRole("button", { name: "First" })).toHaveAttribute("aria-current", "true");
    await userEvent.click(screen.getByRole("button", { name: "Second" }));
    expect(document.getElementById("two")!.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
  });

  it("follows the section the observer reports", async () => {
    render(<SettingsNav sections={SECTIONS} />);
    const { act } = await import("@testing-library/react");
    act(() =>
      trigger([{ isIntersecting: true, target: document.getElementById("two"), boundingClientRect: { top: 10 } }]),
    );
    expect(screen.getByRole("button", { name: "Second" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "First" })).not.toHaveAttribute("aria-current");
  });
});
