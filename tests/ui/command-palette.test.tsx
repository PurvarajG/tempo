import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CommandPalette, { openCommandPalette } from "@/components/CommandPalette";
import { todayTasksPrompt } from "@/lib/claude-prompt";
import { layoutToday } from "@/lib/today";
import { toISODate } from "@/lib/parse";
import { useTasks } from "@/lib/store-context";
import { emptyWorkspace, makeProject, makeTask, renderWorkspace } from "./harness";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push }),
}));

const P1 = "22222222-2222-4222-8222-222222222222";
const T1 = "11111111-1111-4111-8111-111111111111";
const T2 = "11111111-1111-4111-8111-111111111112";

function Probe() {
  const { openTaskId } = useTasks();
  return <span data-testid="open">{openTaskId ?? "none"}</span>;
}

function setup() {
  return renderWorkspace(
    <>
      <CommandPalette />
      <Probe />
    </>,
    emptyWorkspace({
      projects: [makeProject({ id: P1, name: "Garden" })],
      tasks: [
        makeTask({ id: T1, title: "Water the plants", projectId: P1 }),
        makeTask({ id: T2, title: "Pay rent", sortOrder: 1 }),
      ],
    }),
  );
}

function cmdK() {
  fireEvent.keyDown(document, { key: "k", metaKey: true });
}

beforeEach(() => push.mockClear());

describe("CommandPalette", () => {
  it("opens on Cmd+K and closes on Escape", async () => {
    setup();
    expect(screen.queryByRole("combobox")).toBeNull();
    cmdK();
    expect(await screen.findByRole("combobox")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("opens through openCommandPalette and closes on a backdrop click", async () => {
    setup();
    act(() => openCommandPalette());
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(dialog.parentElement!);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("filters tasks and projects as you type", async () => {
    setup();
    cmdK();
    const input = await screen.findByRole("combobox");
    fireEvent.change(input, { target: { value: "gard" } });
    expect(screen.getAllByRole("option", { name: /Garden/ }).length).toBeGreaterThan(0);
    expect(screen.queryByText("Pay rent")).toBeNull();
    fireEvent.change(input, { target: { value: "zzzz" } });
    expect(screen.getByText("Nothing matches.")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "New task" })).toBeInTheDocument();
  });

  it("arrows then Enter on a task opens it", async () => {
    setup();
    cmdK();
    const input = await screen.findByRole("combobox");
    fireEvent.change(input, { target: { value: "rent" } });
    expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByTestId("open")).toHaveTextContent(T2);
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("pushes the route for a Go to row", async () => {
    setup();
    cmdK();
    const input = await screen.findByRole("combobox");
    fireEvent.change(input, { target: { value: "calendar" } });
    fireEvent.click(screen.getByRole("option", { name: "Calendar" }));
    expect(push).toHaveBeenCalledWith("/calendar");
  });

  it("New task pushes the root", async () => {
    setup();
    cmdK();
    fireEvent.click(await screen.findByRole("option", { name: "New task" }));
    expect(push).toHaveBeenCalledWith("/");
  });

  it("See all results pushes the search URL", async () => {
    setup();
    cmdK();
    const input = await screen.findByRole("combobox");
    fireEvent.change(input, { target: { value: "a b" } });
    fireEvent.click(screen.getByRole("option", { name: "See all results" }));
    expect(push).toHaveBeenCalledWith("/search?q=a%20b");
  });

  describe("copy today's tasks as a prompt", () => {
    const LABEL = "Copy today's tasks as a prompt";
    afterEach(() => vi.unstubAllGlobals());

    it("is listed on open and when typing 'prompt'", async () => {
      setup();
      cmdK();
      expect(await screen.findByRole("option", { name: LABEL })).toBeInTheDocument();
      fireEvent.change(screen.getByRole("combobox"), { target: { value: "prompt" } });
      expect(screen.getByRole("option", { name: LABEL })).toBeInTheDocument();
    });

    it("writes the prompt to the clipboard and shows Copied", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
      setup();
      cmdK();
      fireEvent.click(await screen.findByRole("option", { name: LABEL }));
      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Copied"));
      const now = new Date();
      const todayISO = toISODate(now);
      const tasks = [
        makeTask({ id: T1, title: "Water the plants", projectId: P1 }),
        makeTask({ id: T2, title: "Pay rent", sortOrder: 1 }),
      ];
      const layout = layoutToday(tasks, todayISO, now, null, new Set());
      const open = [
        ...(layout.upNext ? [layout.upNext.task] : []),
        ...layout.committed,
        ...layout.couldAlso,
        ...layout.carried,
      ];
      const expected = todayTasksPrompt({
        open,
        projects: [makeProject({ id: P1, name: "Garden" })],
        todayISO,
      });
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(writeText.mock.calls[0][0]).toBe(expected);
    });

    it("shows Could not copy when the clipboard rejects", async () => {
      const writeText = vi.fn().mockRejectedValue(new Error("denied"));
      vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
      setup();
      cmdK();
      fireEvent.click(await screen.findByRole("option", { name: LABEL }));
      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Could not copy"));
    });
  });
});
