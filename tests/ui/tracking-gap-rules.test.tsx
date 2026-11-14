// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWorkspace, emptyWorkspace } from "./harness";

vi.mock("@/components/settings/SettingRow", () => ({
  SETTING_SELECT: "setting-select",
  default: ({ label, description, control, htmlFor }: {
    label: React.ReactNode;
    description?: React.ReactNode;
    control: React.ReactNode;
    htmlFor?: string;
  }) => (
    <li>
      <label htmlFor={htmlFor}>{label}</label>
      {description ? <p>{description}</p> : null}
      {control}
    </li>
  ),
}));

import GapRulesSection from "@/components/tracking/settings/GapRulesSection";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function setup() {
  const view = renderWorkspace(<GapRulesSection />, emptyWorkspace());
  await screen.findByLabelText("Day starts at");
  return view;
}

const patches = (mock: { calls: { url: string; method: string; body: unknown }[] }) =>
  mock.calls.filter((c) => c.url.includes("/api/tracking-settings") && c.method === "PATCH");

describe("GapRulesSection", () => {
  it("links every label to its control", async () => {
    await setup();
    expect(screen.getByLabelText("Day starts at").tagName).toBe("SELECT");
    expect(screen.getByLabelText("Awake from").tagName).toBe("SELECT");
    expect(screen.getByLabelText("Awake until").tagName).toBe("SELECT");
    expect(screen.getByLabelText("Shortest gap").tagName).toBe("INPUT");
    expect(screen.getByText("min")).toBeTruthy();
  });

  it.each([
    ["Day starts at", "dayStartHour", 5],
    ["Awake from", "wakingStartHour", 7],
    ["Awake until", "wakingEndHour", 22],
  ])("%s patches %s", async (label, field, hour) => {
    const { mock } = await setup();
    fireEvent.change(screen.getByLabelText(label), { target: { value: String(hour) } });
    await waitFor(() => expect(patches(mock).length).toBe(1));
    expect(patches(mock)[0].body).toEqual({ [field]: hour });
  });

  it("patches the shortest gap and ignores zero or negative", async () => {
    const { mock } = await setup();
    const input = screen.getByLabelText("Shortest gap");
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.change(input, { target: { value: "-5" } });
    expect(patches(mock).length).toBe(0);
    fireEvent.change(input, { target: { value: "20" } });
    await waitFor(() => expect(patches(mock).length).toBe(1));
    expect(patches(mock)[0].body).toEqual({ minGapMinutes: 20 });
  });
});
