import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppearanceSection from "@/components/settings/AppearanceSection";

vi.mock("@/components/settings/SettingRow", () => ({
  default: ({ label, control }: { label: React.ReactNode; control: React.ReactNode }) => (
    <li>
      <span>{label}</span>
      {control}
    </li>
  ),
}));

let store: Map<string, string>;

beforeEach(() => {
  store = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
  delete document.documentElement.dataset.theme;
});

describe("AppearanceSection", () => {
  it("shows a Theme row with Auto selected by default", () => {
    render(<AppearanceSection />);
    expect(screen.getByText("Theme")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Auto" })).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it("choosing Dark saves the theme and sets data-theme", () => {
    render(<AppearanceSection />);
    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(store.get("theme")).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
  });

  it("choosing Auto again clears data-theme", () => {
    render(<AppearanceSection />);
    fireEvent.click(screen.getByRole("radio", { name: "Light" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    fireEvent.click(screen.getByRole("radio", { name: "Auto" }));
    expect(store.get("theme")).toBe("system");
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});
