import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import WeekGrid from "@/components/calendar/WeekGrid";
import { weekGrid } from "@/lib/calendar";
import { toISODate } from "@/lib/parse";
import { emptyWorkspace, makeProject, makeTask, renderWorkspace } from "./harness";

const TODAY = "2026-03-10";
const project = makeProject();
const planned = makeTask({ scheduled: TODAY, dueTime: "09:00", minutes: 60, title: "Ship the board", projectId: project.id });

function renderWeek(opts: { entries?: object[]; running?: object | null; announce?: string[] } = {}) {
  const tasks = [planned];
  return renderWorkspace(
    <WeekGrid
      days={weekGrid(TODAY)}
      todayISO={TODAY}
      tasksByDate={new Map([[TODAY, tasks]])}
      onSelectDay={() => {}}
      onAnnounce={(m) => opts.announce?.push(m)}
    />,
    emptyWorkspace({ tasks, projects: [project], timeEntries: (opts.entries ?? []) as never, running: (opts.running ?? null) as never }),
  );
}

describe("week calendar", () => {
  afterEach(() => vi.useRealTimers());

  test("head is Monday-first with readable labels", async () => {
    renderWeek();
    const heads = await screen.findAllByRole("button", { name: /, \d+ tasks?$/ });
    expect(heads).toHaveLength(7);
    expect(heads[0].getAttribute("aria-label")).toBe("Mon 9 Mar, 0 tasks");
    expect(heads[1].getAttribute("aria-label")).toBe("Tue 10 Mar, 1 task");
    expect(heads[0].textContent).toContain("Mon");
  });

  test("a timed task is a solid block with a time line", async () => {
    renderWeek();
    const block = await screen.findByRole("button", { name: /^Ship the board/ });
    expect(block.className).toContain("cal-ev");
    expect(block.className).not.toContain("is-tracked");
    expect(block.textContent).toContain("09:00 to 10:00");
  });

  test("weekend columns carry is-weekend", async () => {
    renderWeek();
    const groups = await screen.findAllByRole("group");
    expect(groups).toHaveLength(7);
    expect(groups.map((g) => g.classList.contains("is-weekend"))).toEqual([false, false, false, false, false, true, true]);
  });

  test("a time entry renders a striped, non-draggable block", async () => {
    const start = new Date(2026, 2, 11, 14, 0).toISOString();
    const end = new Date(2026, 2, 11, 15, 0).toISOString();
    const t = makeTask({ id: "44444444-4444-4444-8444-444444444444", title: "Tracked thing", scheduled: null });
    const entry = { id: "e1", taskId: t.id, categoryId: "c", startedAt: start, endedAt: end, minutes: 60, createdAt: start, updatedAt: end };
    renderWorkspace(
      <WeekGrid days={weekGrid(TODAY)} todayISO={TODAY} tasksByDate={new Map()} onSelectDay={() => {}} onAnnounce={() => {}} />,
      emptyWorkspace({ tasks: [t], timeEntries: [entry] as never }),
    );
    const block = await screen.findByRole("button", { name: /^Tracked thing/ });
    expect(block.className).toContain("is-tracked");
    expect(block.getAttribute("draggable")).toBeNull();
  });

  test("today numeral is a filled accent circle and others use the cal-day numeral token", async () => {
    renderWeek();
    const heads = await screen.findAllByRole("button", { name: /, \d+ tasks?$/ });
    const numerals = heads.map((h) => h.querySelectorAll("span")[1] as HTMLElement);
    const filled = numerals.filter((n) => n.className.includes("bg-accent"));
    expect(filled.length).toBeLessThanOrEqual(1);
    for (const n of numerals) {
      if (n.className.includes("bg-accent")) expect(n.className).toContain("rounded-full");
      else expect(n.className).toContain("text-cal-day");
    }
  });

  test("a running entry ends in now", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 2, 10, 15, 0) });
    const today = toISODate(new Date());
    const t = makeTask({ id: "55555555-5555-4555-8555-555555555555", title: "Running thing", scheduled: null });
    const start = new Date();
    start.setHours(13, 0, 0, 0);
    const entry = { id: "e2", taskId: t.id, categoryId: "c", startedAt: start.toISOString(), createdAt: start.toISOString(), updatedAt: start.toISOString() };
    renderWorkspace(
      <WeekGrid days={weekGrid(today)} todayISO={today} tasksByDate={new Map()} onSelectDay={() => {}} onAnnounce={() => {}} />,
      emptyWorkspace({ tasks: [t], running: entry as never }),
    );
    const block = await screen.findByRole("button", { name: /^Running thing/ });
    expect(block.textContent).toMatch(/13:00 to now$/);
  });

  test("dropping a planned block on another column reschedules it", async () => {
    const announce: string[] = [];
    const { mock } = renderWeek({ announce });
    const block = await screen.findByRole("button", { name: /^Ship the board/ });
    const target = screen.getAllByRole("group")[3];
    const dataTransfer = { effectAllowed: "", setData: () => {}, getData: () => planned.id };
    const fire = async (node: HTMLElement, type: string) => {
      node.dispatchEvent(Object.assign(new Event(type, { bubbles: true, cancelable: true }), { dataTransfer }));
      await waitFor(() => {});
    };
    await fire(block, "dragstart");
    await fire(target, "dragover");
    await fire(target, "drop");
    await waitFor(() =>
      expect(mock.calls).toContainEqual({ url: `/api/tasks/${planned.id}`, method: "PATCH", body: { scheduled: "2026-03-12" } }),
    );
    expect(announce).toContain("Ship the board moved to Thu 12 Mar.");
  });

  test("the body opens scrolled to the waking hour", async () => {
    renderWeek();
    const group = (await screen.findAllByRole("group"))[0];
    const body = group.parentElement!.parentElement as HTMLElement;
    // A quarter hour of lead so the first hour label is not cut off.
    await waitFor(() => expect(body.scrollTop).toBe(6.75 * 56));
  });

  test("the body hides its scrollbar so day columns line up with the head", async () => {
    renderWeek();
    const group = (await screen.findAllByRole("group"))[0];
    const body = group.parentElement!.parentElement as HTMLElement;
    expect(body.className).toContain("[scrollbar-width:none]");
  });
});
