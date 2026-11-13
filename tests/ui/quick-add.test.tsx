import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { describe, expect, test, vi } from "vitest";
import QuickAdd from "@/components/QuickAdd";
import { toISODate, addDays } from "@/lib/parse";
import { useTasks } from "@/lib/store-context";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

const PLACEHOLDER = "Add a task. Try: Call printer 20m tomorrow #MSM26";
const N1 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const N2 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const N3 = "ffffffff-ffff-4fff-8fff-ffffffffffff";

function Offer() {
  const { undoOffer } = useTasks();
  useEffect(() => {});
  return <span data-testid="offer">{undoOffer?.label ?? "none"}</span>;
}

async function setup() {
  const view = renderWorkspace(
    <>
      <QuickAdd />
      <Offer />
    </>,
    emptyWorkspace(),
  );
  await screen.findByPlaceholderText(PLACEHOLDER);
  await waitFor(() => expect(view.mock).toBeDefined());
  return view;
}

describe("QuickAdd composer", () => {
  test("hint chips stay visible while typing, with parsed chips beside them", async () => {
    await setup();
    expect(screen.getByText("20m")).toBeInTheDocument();
    expect(screen.getByText("p1")).toBeInTheDocument();
    expect(screen.getByText("#project")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add" })).not.toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText(PLACEHOLDER), "Call 20m");
    expect(screen.getAllByText("20m")).toHaveLength(2);
    const hints = within(document.querySelector('[data-part="hint-chips"]') as HTMLElement);
    const live = within(document.querySelector('[data-part="live-chips"]') as HTMLElement);
    expect(hints.getByText("20m")).toBeInTheDocument();
    expect(hints.getByText("p1")).toBeInTheDocument();
    expect(hints.getByText("#project")).toBeInTheDocument();
    expect(live.getByText("20m")).toBeInTheDocument();
  });

  test("shows parsed chips as you type", async () => {
    await setup();
    await userEvent.type(screen.getByPlaceholderText(PLACEHOLDER), "Call 20m p1 tomorrow weekly");
    expect(within(document.querySelector('[data-part="live-chips"]') as HTMLElement).getByText("20m")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Weekly")).toBeInTheDocument();
    expect(screen.getByText(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/)).toBeInTheDocument();
  });

  test("an unknown #name offers a new project chip that can be dropped", async () => {
    const { mock } = await setup();
    const input = screen.getByPlaceholderText(PLACEHOLDER);
    await userEvent.type(input, "Plan trip #holiday");
    expect(screen.getByText("New project: holiday")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Remove new project name" }));
    expect(screen.queryByText("New project: holiday")).not.toBeInTheDocument();

    mock.respondNext("/api/tasks", makeTask({ id: N1, title: "Plan trip" }), "POST");
    await userEvent.type(input, "{Enter}");
    await waitFor(() => expect(mock.calls.some((c) => c.url === "/api/tasks")).toBe(true));
    const body = mock.calls.find((c) => c.url === "/api/tasks")!.body as { text: string };
    expect(body.text).toBe("Plan trip");
  });

  test("pasting three lines asks, then adds one batch", async () => {
    const { mock } = await setup();
    mock.respondWith("/api/tasks/batch", [N1, N2, N3].map((id) => makeTask({ id })));
    fireEvent.paste(screen.getByPlaceholderText(PLACEHOLDER), {
      clipboardData: { getData: () => "one\ntwo 20m\nthree" },
    });
    expect(await screen.findByText("Add 3 tasks?")).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole("region", { name: "Add several tasks" })).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(mock.calls.filter((c) => c.url === "/api/tasks/batch")).toHaveLength(1));
    const body = mock.calls.find((c) => c.url === "/api/tasks/batch")!.body as { items?: unknown; texts?: string[] };
    expect(JSON.stringify(body)).toContain("three");
    await waitFor(() => expect(screen.getByTestId("offer").textContent).toBe("Added 3 tasks"));
  });

  test("a task for another day offers an undo naming the day, and keeps focus", async () => {
    const { mock } = await setup();
    const day = addDays(toISODate(new Date()), 3);
    mock.respondNext("/api/tasks", makeTask({ id: N1, scheduled: day }), "POST");
    const input = screen.getByPlaceholderText(PLACEHOLDER);
    await userEvent.type(input, "Call printer +3d{Enter}");
    await waitFor(() => expect(screen.getByTestId("offer").textContent).toMatch(/^Added to (Mon|Tue|Wed|Thu|Fri|Sat|Sun)/));
    expect(input).toHaveFocus();
    expect(input).toHaveValue("");
  });

  test("defaultScheduled null files the task in the Inbox with an undo", async () => {
    const view = renderWorkspace(
      <>
        <QuickAdd defaultScheduled={null} />
        <Offer />
      </>,
      emptyWorkspace(),
    );
    await screen.findByPlaceholderText(PLACEHOLDER);
    view.mock.respondNext("/api/tasks", makeTask({ id: N1, title: "Buy stamps", scheduled: null }), "POST");
    await userEvent.type(screen.getByPlaceholderText(PLACEHOLDER), "Buy stamps{Enter}");
    await waitFor(() => expect(view.mock.calls.some((c) => c.url === "/api/tasks")).toBe(true));
    const body = view.mock.calls.find((c) => c.url === "/api/tasks")!.body as { scheduled?: string | null };
    expect(body.scheduled).toBeNull();
    await waitFor(() => expect(screen.getByTestId("offer").textContent).toBe("Added to Inbox"));
  });

  test("without defaultScheduled the task is scheduled today and offers no undo", async () => {
    const { mock } = await setup();
    const today = toISODate(new Date());
    mock.respondNext("/api/tasks", makeTask({ id: N1, title: "Buy stamps", scheduled: today }), "POST");
    await userEvent.type(screen.getByPlaceholderText(PLACEHOLDER), "Buy stamps{Enter}");
    await waitFor(() => expect(mock.calls.some((c) => c.url === "/api/tasks")).toBe(true));
    const body = mock.calls.find((c) => c.url === "/api/tasks")!.body as { scheduled?: string | null };
    expect(body.scheduled).toBe(today);
    await waitFor(() => expect(screen.getByPlaceholderText(PLACEHOLDER)).toHaveValue(""));
    expect(screen.getByTestId("offer").textContent).toBe("none");
  });
});

describe("QuickAdd placeholder prop", () => {
  test("a placeholder prop replaces the default text, and the default stays without it", async () => {
    const view = renderWorkspace(
      <>
        <QuickAdd placeholder="Add to the inbox. No day needed." />
        <Offer />
      </>,
      emptyWorkspace(),
    );
    expect(await screen.findByPlaceholderText("Add to the inbox. No day needed.")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(PLACEHOLDER)).not.toBeInTheDocument();
    view.unmount();

    renderWorkspace(<QuickAdd />, emptyWorkspace());
    expect(await screen.findByPlaceholderText(PLACEHOLDER)).toBeInTheDocument();
  });
});

describe("QuickAdd capture props", () => {
  const mount = async (props: React.ComponentProps<typeof QuickAdd>) => {
    const view = renderWorkspace(<QuickAdd {...props} />, emptyWorkspace());
    const input = await screen.findByPlaceholderText(PLACEHOLDER);
    view.mock.respondWith("/api/tasks", makeTask({ id: N1, title: "x", scheduled: null }));
    return { ...view, input };
  };

  test("onSaved gets stay false for Enter and true for Shift+Enter", async () => {
    const onSaved = vi.fn();
    const { input } = await mount({ onSaved });
    await userEvent.type(input, "one{Enter}");
    await waitFor(() => expect(onSaved).toHaveBeenLastCalledWith({ stay: false }));
    await userEvent.type(input, "two{Shift>}{Enter}{/Shift}");
    await waitFor(() => expect(onSaved).toHaveBeenLastCalledWith({ stay: true }));
    expect(input).toHaveValue("");
  });

  test("onEscape fires on Esc", async () => {
    const onEscape = vi.fn();
    const { input } = await mount({ onEscape });
    await userEvent.type(input, "{Escape}");
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  test("saveOnWindowBlur saves text, or escapes when empty", async () => {
    const onSaved = vi.fn();
    const onEscape = vi.fn();
    const { input, mock } = await mount({ saveOnWindowBlur: true, onSaved, onEscape });
    fireEvent.blur(window);
    expect(onEscape).toHaveBeenCalledTimes(1);
    await userEvent.type(input, "one");
    fireEvent.blur(window);
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ stay: false }));
    expect(mock.calls.filter((c) => c.url === "/api/tasks")).toHaveLength(1);
  });

  test("dumpPreview false keeps a multi-line paste out of the preview", async () => {
    const { input } = await mount({ dumpPreview: false });
    fireEvent.paste(input, { clipboardData: { getData: () => "one\ntwo" } });
    expect(screen.queryByText("Add 2 tasks?")).not.toBeInTheDocument();
  });
});
