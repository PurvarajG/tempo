import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import CaptureWindow from "@/components/CaptureWindow";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

const PLACEHOLDER = "Add a task. Try: Call printer 20m tomorrow #MSM26";
const N1 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

let doem: { closeCapture: ReturnType<typeof vi.fn>; captureSaved: ReturnType<typeof vi.fn> };

beforeEach(() => {
  doem = { closeCapture: vi.fn(), captureSaved: vi.fn() };
  (window as unknown as { doem: unknown }).doem = doem;
});
afterEach(() => {
  delete (window as unknown as { doem?: unknown }).doem;
});

async function setup() {
  const view = renderWorkspace(<CaptureWindow />, emptyWorkspace());
  const input = await screen.findByPlaceholderText(PLACEHOLDER);
  view.mock.respondWith("/api/tasks", makeTask({ id: N1, title: "Buy stamps", scheduled: null }));
  return { ...view, input };
}

const posts = (m: { calls: { url: string; body: unknown }[] }) => m.calls.filter((c) => c.url === "/api/tasks");
const bodyOf = (m: { calls: { url: string; body: unknown }[] }) =>
  posts(m)[0].body as { text: string; scheduled?: string | null };

describe("CaptureWindow", () => {
  test("Enter saves to the inbox, reports it and closes", async () => {
    const { mock, input } = await setup();
    expect(input).toHaveAttribute("id", "doem-capture");
    await userEvent.type(input, "Buy stamps{Enter}");
    await waitFor(() => expect(doem.closeCapture).toHaveBeenCalledTimes(1));
    expect(bodyOf(mock).scheduled).toBeNull();
    expect(doem.captureSaved).toHaveBeenCalledTimes(1);
  });

  test("Shift+Enter saves, reports, stays open with an empty focused field", async () => {
    const { mock, input } = await setup();
    await userEvent.type(input, "Buy stamps{Shift>}{Enter}{/Shift}");
    await waitFor(() => expect(doem.captureSaved).toHaveBeenCalledTimes(1));
    expect(posts(mock)).toHaveLength(1);
    expect(doem.closeCapture).not.toHaveBeenCalled();
    expect(input).toHaveValue("");
    await waitFor(() => expect(input).toHaveFocus());
  });

  test("Esc closes and saves nothing", async () => {
    const { mock, input } = await setup();
    await userEvent.type(input, "Buy stamps{Escape}");
    expect(doem.closeCapture).toHaveBeenCalledTimes(1);
    expect(doem.captureSaved).not.toHaveBeenCalled();
    expect(posts(mock)).toHaveLength(0);
  });

  test("losing window focus with text saves then closes", async () => {
    const { mock, input } = await setup();
    await userEvent.type(input, "Buy stamps");
    fireEvent.blur(window);
    await waitFor(() => expect(doem.closeCapture).toHaveBeenCalledTimes(1));
    expect(posts(mock)).toHaveLength(1);
    expect(doem.captureSaved).toHaveBeenCalledTimes(1);
  });

  test("losing window focus with an empty field closes and saves nothing", async () => {
    const { mock } = await setup();
    fireEvent.blur(window);
    expect(doem.closeCapture).toHaveBeenCalledTimes(1);
    expect(doem.captureSaved).not.toHaveBeenCalled();
    expect(posts(mock)).toHaveLength(0);
  });

  test("a date token is kept, not forced to the inbox", async () => {
    const { mock, input } = await setup();
    await userEvent.type(input, "Buy stamps tomorrow{Enter}");
    await waitFor(() => expect(posts(mock)).toHaveLength(1));
    expect(bodyOf(mock).text).toBe("Buy stamps tomorrow");
    expect(bodyOf(mock).scheduled).toBeUndefined();
  });

  test("regaining window focus focuses the field", async () => {
    const { input } = await setup();
    input.blur();
    fireEvent.focus(window);
    expect(input).toHaveFocus();
  });
});
