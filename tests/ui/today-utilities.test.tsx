// The Quick list tests were removed here: Phase 5 drops components/today/QuickTodos.tsx
// from Today (quick list merged into the inbox). The replacement assertion (Today
// renders no Quick list and shows the Inbox line) lives with the Today page tests.
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import GeneralNote from "@/components/today/GeneralNote";
import { emptyWorkspace, renderWorkspace } from "./harness";

describe("general notepad", () => {
  beforeEach(() => vi.useRealTimers());

  test("loads the saved note and autosaves after a pause", async () => {
    const { mock } = renderWorkspace(
      <GeneralNote />,
      emptyWorkspace({ note: { body: "Existing", updatedAt: "2026-03-01T09:00:00.000Z" } }),
    );

    const box = await screen.findByLabelText("General notepad");
    await waitFor(() => expect(box).toHaveValue("Existing"));

    await userEvent.type(box, "!");
    // Debounced: the keystroke alone must not have saved anything yet.
    expect(mock.calls).toHaveLength(0);
    expect(await screen.findByText("Saving")).toBeInTheDocument();

    await waitFor(
      () =>
        expect(mock.calls).toContainEqual({
          url: "/api/note",
          method: "PUT",
          body: { body: "Existing!" },
        }),
      { timeout: 2000 },
    );
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });

  test("a failed save keeps the text and offers a retry that sends it again", async () => {
    const { mock } = renderWorkspace(<GeneralNote />, emptyWorkspace());

    const box = await screen.findByLabelText("General notepad");
    mock.failNext("/api/note", 500, "Something went wrong");
    await userEvent.type(box, "Do not lose me");

    expect(await screen.findByText("Couldn't save")).toBeInTheDocument();
    // The unsaved text is still on screen — a failed save loses nothing.
    expect(box).toHaveValue("Do not lose me");

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() =>
      expect(mock.calls.filter((c) => c.url === "/api/note").length).toBeGreaterThan(1),
    );
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });

  test("shows the Notepad label, and hideLabel omits it", async () => {
    const { unmount } = renderWorkspace(<GeneralNote />, emptyWorkspace());
    expect(await screen.findByText("Notepad")).toBeInTheDocument();
    unmount();

    renderWorkspace(<GeneralNote hideLabel />, emptyWorkspace());
    await screen.findByLabelText("General notepad");
    expect(screen.queryByText("Notepad")).not.toBeInTheDocument();
  });
});
