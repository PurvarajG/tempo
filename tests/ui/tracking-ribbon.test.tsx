import { useEffect } from "react";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import ClaudeBlock from "@/components/tracking/ClaudeBlock";
import RibbonModule from "@/components/tracking/modules/RibbonModule";
import { useTasks } from "@/lib/store-context";
import type { ClaudeSession } from "@/lib/desktop-bridge";
import type { Gap, Segment } from "@/lib/types";
import { emptyWorkspace, makeCategory, makeTask, renderWorkspace } from "./harness";

const claude = vi.hoisted(() => ({ sessions: [] as unknown[] }));
vi.mock("@/lib/useClaudeSessions", () => ({ useClaudeSessions: () => claude.sessions }));

const DAY = "2026-03-01";
const at = (h: number, m = 0) => new Date(2026, 2, 1, h, m).toISOString();

const SEGMENTS: Segment[] = [
  {
    id: "seg-1",
    startedAt: at(9),
    endedAt: at(10),
    categoryId: makeCategory().id,
    taskId: "11111111-1111-4111-8111-111111111111",
    note: "first",
    source: "manual",
    createdAt: at(9),
    updatedAt: at(9),
  },
];
const GAPS: Gap[] = [{ startedAt: at(10), endedAt: at(11), minutes: 60 }];

function Loader({ segments, gaps }: { segments: Segment[]; gaps: Gap[] }) {
  const { setSegments, setGaps } = useTasks();
  useEffect(() => {
    setSegments(segments);
    setGaps(gaps);
  }, [setSegments, setGaps, segments, gaps]);
  return null;
}

function setup(segments = SEGMENTS, gaps = GAPS) {
  return renderWorkspace(
    <>
      <Loader segments={segments} gaps={gaps} />
      <RibbonModule dayISO={DAY} isToday={false} />
    </>,
    emptyWorkspace({ tasks: [makeTask()] }),
  );
}

beforeEach(() => {
  claude.sessions = [];
});
afterEach(cleanup);

describe("RibbonModule", () => {
  test("renders a calendar-form block per segment and a gap block, never 'untracked'", async () => {
    const { container } = setup();
    const block = await screen.findByTitle("Write the plan");
    expect(block).toHaveClass("cal-ev");
    expect(block.style.getPropertyValue("--c")).toBe("var(--color-cat-indigo)");
    expect(await screen.findByText("1h gap")).toBeInTheDocument();
    expect(container.textContent?.toLowerCase()).not.toContain("untracked");
  });

  test("clicking a gap opens the fill form", async () => {
    setup();
    fireEvent.click(await screen.findByText("1h gap"));
    expect(await screen.findByRole("button", { name: /fill/i })).toBeInTheDocument();
  });

  test("clicking a segment opens the editor; Save patches only a changed task", async () => {
    const { mock } = setup();
    fireEvent.click(await screen.findByTitle("Write the plan"));
    const note = await screen.findByLabelText("Note");
    fireEvent.change(note, { target: { value: "edited" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mock.calls.some((c) => c.method === "PATCH")).toBe(true));
    const patch = mock.calls.find((c) => c.method === "PATCH")!;
    expect(patch.url).toContain("/api/segments/seg-1");
    expect(patch.body).toMatchObject({ note: "edited" });
    expect(patch.body).not.toHaveProperty("taskId");
  });

  test("Delete calls deleteSegment", async () => {
    const { mock } = setup();
    fireEvent.click(await screen.findByTitle("Write the plan"));
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(mock.calls.some((c) => c.method === "DELETE" && c.url.includes("/api/segments/seg-1"))).toBe(true),
    );
  });

  test("toggle label has no dash and toggles the full day", async () => {
    // A segment at 05:00 sits outside 07:00 to 23:00 and is hidden by the crop.
    const early: Segment = { ...SEGMENTS[0], id: "seg-2", startedAt: at(5), endedAt: at(6), taskId: undefined };
    setup([...SEGMENTS, early], []);
    const toggle = await screen.findByRole("button", { name: /outside 07:00 to 23:00\. Show full day/ });
    expect(toggle.textContent).toBe("1h outside 07:00 to 23:00. Show full day");
    expect(toggle.textContent).not.toMatch(/[–—]/);
    fireEvent.click(toggle);
    const back = await screen.findByRole("button", { name: "Show waking hours" });
    expect(back).toBeInTheDocument();
    fireEvent.click(back);
    expect(await screen.findByRole("button", { name: /Show full day/ })).toBeInTheDocument();
  });

  describe("suggested Claude blocks", () => {
    // 14:00 to 14:45, clear of the 09:00 segment and the 10:00 gap.
    const SESSION: ClaudeSession = {
      id: "sess-1",
      projectPath: "/work/doem",
      projectName: "doem",
      branch: "main",
      lastPrompt: "Fix the ribbon",
      firstMessageAt: at(14),
      lastMessageAt: at(14, 45),
      waiting: false,
      active: false,
    };

    test("renders one outlined, non-dashed block; clicking it adds the segment once", async () => {
      claude.sessions = [SESSION];
      const { mock } = setup();
      const block = await screen.findByRole("button", { name: /Accept suggested block: Claude Code: / });
      expect(block).toHaveAccessibleName("Accept suggested block: Claude Code: doem, 14:00 to 14:45");
      expect(block.className).not.toContain("border-dashed");
      expect(block.textContent).toContain("14:00 to 14:45");
      expect(mock.calls.some((c) => c.method === "POST" && c.url.includes("/api/segments"))).toBe(false);
      fireEvent.click(block);
      await waitFor(() => expect(mock.calls.some((c) => c.method === "POST")).toBe(true));
      const posts = mock.calls.filter((c) => c.method === "POST" && c.url.includes("/api/segments"));
      expect(posts).toHaveLength(1);
      expect(posts[0].body).toMatchObject({ startedAt: at(14), endedAt: at(14, 45) });
    });

    test("no sessions, no suggestion", async () => {
      setup();
      await screen.findByText("1h gap");
      expect(screen.queryByRole("button", { name: /Accept suggested block/ })).toBeNull();
    });
  });
});

describe("ClaudeBlock", () => {
  test("draws a plus icon and the range with 'to'", () => {
    const { container } = renderWorkspace(
      <ClaudeBlock label="Claude Code: doem" timeLabel="14:00 to 14:45" onAccept={() => {}} />,
      emptyWorkspace(),
    );
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.textContent).toContain("14:00 to 14:45");
    expect(container.textContent).not.toMatch(/[–—-]/);
  });
});
