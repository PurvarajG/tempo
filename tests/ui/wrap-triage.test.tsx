import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BrainDumpCard from "@/components/wrap/BrainDumpCard";
import InboxTriage from "@/components/wrap/InboxTriage";
import { toISODate } from "@/lib/parse";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

vi.mock("next/navigation", () => ({
  usePathname: () => "/wrap",
  useRouter: () => ({ push: vi.fn() }),
}));

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const today = toISODate(new Date());

describe("InboxTriage", () => {
  it("lists only open undated tasks with the count", async () => {
    renderWorkspace(
      <InboxTriage todayISO={today} />,
      emptyWorkspace({
        tasks: [
          makeTask({ id: A, title: "Sort receipts", scheduled: null }),
          makeTask({ id: B, title: "Renew passport", scheduled: null }),
          makeTask({ id: C, title: "Dated thing", scheduled: today }),
        ],
      }),
    );
    expect(await screen.findByText("Sort receipts")).toBeTruthy();
    expect(screen.getByText("Renew passport")).toBeTruthy();
    expect(screen.queryByText("Dated thing")).toBeNull();
    expect(screen.getByRole("heading", { name: "Inbox", level: 2 }).nextElementSibling?.textContent).toBe("2");
    expect(screen.getByText("Give each a day or trash it")).toBeTruthy();
  });

  it("shows the empty line when nothing is undated", async () => {
    renderWorkspace(
      <InboxTriage todayISO={today} />,
      emptyWorkspace({ tasks: [makeTask({ id: C, title: "Dated thing", scheduled: today })] }),
    );
    expect(await screen.findByText("Inbox is empty.")).toBeTruthy();
  });
});

describe("BrainDumpCard", () => {
  it("renders the brain dump textarea under the Brain dump heading", async () => {
    renderWorkspace(<BrainDumpCard />, emptyWorkspace());
    expect(await screen.findByRole("textbox", { name: "Brain dump" })).toBeTruthy();
    expect(screen.getAllByRole("heading", { name: "Brain dump" })).toHaveLength(1);
    expect(screen.getAllByText("Brain dump")).toHaveLength(1);
    expect(screen.queryByText("Nothing in the inbox.")).toBeNull();
  });

  it("shows One task per line in the card header and draws no intro paragraph", async () => {
    const { container } = renderWorkspace(<BrainDumpCard />, emptyWorkspace());
    const area = await screen.findByRole("textbox", { name: "Brain dump" });
    const heading = screen.getByRole("heading", { name: "Brain dump" });
    expect(within(heading.parentElement as HTMLElement).getByText("One task per line")).toBeTruthy();
    expect(screen.getAllByText("One task per line")).toHaveLength(1);
    expect(screen.queryByText(/Write everything on your mind/)).toBeNull();
    const before = Array.from(container.querySelectorAll("p")).filter(
      (p) => p.compareDocumentPosition(area) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(before).toHaveLength(0);
  });
});
