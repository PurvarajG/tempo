import { act, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { TasksProvider, useTasks } from "@/lib/store-context";
import { useRangeSegments } from "@/components/tracking/useRangeSegments";
import type { Segment } from "@/lib/types";

function seg(id: string, over: Partial<Segment> = {}): Segment {
  return {
    id,
    categoryId: "c1",
    startedAt: "2026-11-10T09:00:00.000Z",
    endedAt: "2026-11-10T10:00:00.000Z",
    ...over,
  } as Segment;
}

type Handler = (url: string) => Promise<unknown> | unknown;

function stubFetch(handler: Handler) {
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (!url.startsWith("/api/segments")) {
        const empty: Record<string, unknown> = { "/api/time-entries": { entries: [], running: null } };
        return Response.json(empty[url] ?? []);
      }
      urls.push(url);
      return Response.json(await handler(url));
    }),
  );
  return urls;
}

const storeRef = { current: null as unknown as ReturnType<typeof useTasks> };
const latest = { current: { segments: [], loading: false } as { segments: Segment[]; loading: boolean } };

function Probe({ start, end }: { start: string | null; end: string | null }) {
  const s = useTasks();
  const r = useRangeSegments(start, end);
  useEffect(() => {
    storeRef.current = s;
    latest.current = r;
  });
  return null;
}

function mount(start: string | null, end: string | null) {
  const ui = (s: string | null, e: string | null) => (
    <TasksProvider>
      <Probe start={s} end={e} />
    </TasksProvider>
  );
  const view = render(ui(start, end));
  return { rerender: (s: string | null, e: string | null) => view.rerender(ui(s, e)) };
}

afterEach(() => vi.unstubAllGlobals());

describe("useRangeSegments", () => {
  it("queries from local midnight of start to local midnight after end", async () => {
    const urls = stubFetch(() => ({ segments: [seg("a")], running: null }));
    mount("2026-11-07", "2026-11-13");
    await waitFor(() => expect(latest.current.segments).toHaveLength(1));
    const q = new URL(urls[0], "http://x").searchParams;
    expect(q.get("from")).toBe(new Date(2026, 10, 7).toISOString());
    expect(q.get("to")).toBe(new Date(2026, 10, 14).toISOString());
  });

  it("returns [] and does not fetch for null dates", async () => {
    const urls = stubFetch(() => ({ segments: [seg("a")], running: null }));
    mount(null, "2026-11-13");
    await new Promise((r) => setTimeout(r, 20));
    expect(latest.current.segments).toEqual([]);
    expect(urls).toHaveLength(0);
  });

  it("appends the running segment once", async () => {
    const running = seg("run", { endedAt: undefined });
    stubFetch(() => ({ segments: [seg("a"), running], running }));
    mount("2026-11-07", "2026-11-13");
    await waitFor(() => expect(latest.current.segments).toHaveLength(2));
    stubFetch(() => ({ segments: [seg("a")], running }));
    mount("2026-11-07", "2026-11-13");
    await waitFor(() => expect(latest.current.segments.map((s) => s.id)).toEqual(["a", "run"]));
  });

  it("refetches when the store's segments change", async () => {
    const urls = stubFetch(() => ({ segments: [seg("a")], running: null }));
    mount("2026-11-07", "2026-11-13");
    await waitFor(() => expect(latest.current.segments).toHaveLength(1));
    const before = urls.length;
    act(() => storeRef.current.setSegments([seg("z")]));
    await waitFor(() => expect(urls.length).toBeGreaterThan(before));
  });

  it("ignores a stale response that arrives after a newer one", async () => {
    let releaseFirst: (v: unknown) => void = () => {};
    let n = 0;
    stubFetch(() => {
      n += 1;
      if (n === 1) return new Promise((r) => (releaseFirst = r));
      return { segments: [seg("new")], running: null };
    });
    const m = mount("2026-11-07", "2026-11-13");
    m.rerender("2026-11-01", "2026-11-13");
    await waitFor(() => expect(latest.current.segments.map((s) => s.id)).toEqual(["new"]));
    await act(async () => {
      releaseFirst({ segments: [seg("old")], running: null });
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(latest.current.segments.map((s) => s.id)).toEqual(["new"]);
  });
});
