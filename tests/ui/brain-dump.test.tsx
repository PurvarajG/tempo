import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import BrainDump from "@/components/inbox/BrainDump";
import { useTasks } from "@/lib/store-context";
import { emptyWorkspace, makeProject, makeTask, renderWorkspace } from "./harness";

const N1 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const N2 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const PID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const N3 = "ffffffff-ffff-4fff-8fff-ffffffffffff";

function Offer() {
  const { undoOffer } = useTasks();
  return <span data-testid="offer">{undoOffer?.label ?? "none"}</span>;
}

async function setup() {
  const view = renderWorkspace(
    <>
      <BrainDump />
      <Offer />
    </>,
    emptyWorkspace(),
  );
  await screen.findByLabelText("Brain dump");
  return view;
}

const area = () => screen.getByLabelText("Brain dump") as HTMLTextAreaElement;
const addBtn = () => screen.getByRole("button", { name: /^Add (tasks?|\d+ tasks)$/ });

describe("BrainDump", () => {
  test("the button is disabled on blank text", async () => {
    await setup();
    expect(addBtn()).toBeDisabled();
    await userEvent.type(area(), "  {Enter}  ");
    expect(addBtn()).toBeDisabled();
    await userEvent.type(area(), "x");
    expect(addBtn()).toBeEnabled();
  });

  test("three lines show the preview, Add posts one batch with scheduled null and offers one undo", async () => {
    const { mock } = await setup();
    mock.respondWith("/api/tasks/batch", [N1, N2, N3].map((id) => makeTask({ id, scheduled: null })));
    await userEvent.type(area(), "one{Enter}two 20m{Enter}three");
    await userEvent.click(addBtn());
    expect(await screen.findByText("Add 3 tasks?")).toBeInTheDocument();
    await userEvent.click(
      within(screen.getByRole("region", { name: "Add several tasks" })).getByRole("button", { name: "Add" }),
    );
    await waitFor(() => expect(mock.calls.filter((c) => c.url === "/api/tasks/batch")).toHaveLength(1));
    const body = mock.calls.find((c) => c.url === "/api/tasks/batch")!.body;
    const json = JSON.stringify(body);
    expect(json).toContain("three");
    expect(json).toContain("null");
    await waitFor(() => expect(screen.getByTestId("offer").textContent).toBe("Added 3 tasks"));
    await waitFor(() => expect(area()).toHaveValue(""));
  });

  test("150 lines go out as two batches of 100 and 50", async () => {
    const { mock } = await setup();
    mock.respondWith("/api/tasks/batch", [makeTask({ id: N1, scheduled: null })]);
    const lines = Array.from({ length: 150 }, (_, i) => `task ${i + 1}`);
    fireEvent.change(area(), { target: { value: lines.join("\n") } });
    await userEvent.click(addBtn());
    await screen.findByText("Add 150 tasks?");
    await userEvent.click(
      within(screen.getByRole("region", { name: "Add several tasks" })).getByRole("button", { name: "Add" }),
    );
    await waitFor(() => expect(mock.calls.filter((c) => c.url === "/api/tasks/batch")).toHaveLength(2));
    const sizes = mock.calls
      .filter((c) => c.url === "/api/tasks/batch")
      .map((c) => (c.body as { items: unknown[] }).items.length);
    expect(sizes).toEqual([100, 50]);
    await waitFor(() => expect(area()).toHaveValue(""));
  });

  test("Cancel keeps the text", async () => {
    const { mock } = await setup();
    await userEvent.type(area(), "one{Enter}two");
    await userEvent.click(addBtn());
    await screen.findByText("Add 2 tasks?");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Add 2 tasks?")).not.toBeInTheDocument();
    expect(area()).toHaveValue("one\ntwo");
    expect(mock.calls.some((c) => c.url === "/api/tasks/batch")).toBe(false);
  });

  test("labelledBy uses the caller's heading and draws no label of its own", async () => {
    renderWorkspace(
      <>
        <h2 id="x">Brain dump</h2>
        <BrainDump labelledBy="x" />
      </>,
      emptyWorkspace(),
    );
    expect(await screen.findByRole("textbox", { name: "Brain dump" })).toBeInTheDocument();
    expect(screen.getAllByText("Brain dump")).toHaveLength(1);
    expect(screen.queryByText(/Nothing in the inbox\./)).not.toBeInTheDocument();
  });

  test("the footer text and button label follow the lines", async () => {
    await setup();
    expect(screen.getByText("Nothing yet")).toBeInTheDocument();
    expect(addBtn()).toHaveTextContent("Add tasks");
    await userEvent.type(area(), "one");
    expect(screen.getByText("1 task found")).toBeInTheDocument();
    expect(addBtn()).toHaveTextContent("Add task");
    await userEvent.type(area(), "{Enter}two{Enter}three");
    expect(screen.getByText("3 tasks found")).toBeInTheDocument();
    expect(addBtn()).toHaveTextContent("Add 3 tasks");
  });

  test("the footer counts lines whose #project exists", async () => {
    renderWorkspace(<BrainDump />, emptyWorkspace({ projects: [makeProject({ id: PID, name: "Home" })] }));
    await screen.findByLabelText("Brain dump");
    fireEvent.change(area(), { target: { value: "a #home\nb #nope\nc" } });
    expect(screen.getByText("3 tasks found, 1 with a project")).toBeInTheDocument();
  });
});
