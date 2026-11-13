import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import SavedCue from "@/components/ui/SavedCue";

describe("SavedCue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("idle renders an empty status region", () => {
    render(<SavedCue state="idle" />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toBeEmptyDOMElement();
  });

  test("saving shows Saving", () => {
    render(<SavedCue state="saving" />);
    expect(screen.getByRole("status")).toHaveTextContent("Saving");
  });

  test("saved shows Saved with a hidden check icon", () => {
    render(<SavedCue state="saved" />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Saved");
    expect(status.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  test("saved fades out after about 2s", () => {
    render(<SavedCue state="saved" />);
    const status = screen.getByRole("status");
    expect(status).toHaveClass("opacity-100");
    act(() => {
      vi.advanceTimersByTime(2100);
    });
    expect(status).toHaveClass("opacity-0");
  });

  test("changing state cancels the pending clear", () => {
    const { rerender } = render(<SavedCue state="saved" />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    rerender(<SavedCue state="saving" />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Saving");
    expect(status).toHaveClass("opacity-100");
  });

  test("error with onRetry shows a Retry button that calls it", () => {
    const onRetry = vi.fn();
    render(<SavedCue state="error" onRetry={onRetry} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Couldn't save");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test("error without onRetry shows no button", () => {
    render(<SavedCue state="error" />);
    expect(screen.getByRole("status")).toHaveTextContent("Couldn't save");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
