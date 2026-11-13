import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { TasksProvider } from "@/lib/store-context";
import Today from "@/components/Today";
import { makeTask } from "./harness";

vi.mock("@/lib/useNow", () => ({
  useNow: () => new Date("2026-08-14T12:00:00"),
}));

/**
 * Regression test for the data-loss defect: Today renders as soon as
 * useNow() resolves, which is before tracking settings has loaded. The
 * collapse toggle must not fire patchSettings while `settings` is still
 * null — patchSettings replaces the WHOLE collapsedModules array
 * (lib/store/tracking-settings.ts), so a click that lands before settings
 * arrives would persist a single-entry array and destroy every other
 * collapsed module (including Tracking's backfilled default).
 */
describe("Today's rail collapse toggle is guarded until settings has loaded", () => {
  test("clicking a rail disclosure before /api/tracking-settings resolves issues no PATCH", async () => {
    const task = makeTask({ scheduled: "2026-08-14", title: "Ship the report" });

    // Every endpoint resolves immediately except tracking-settings, which
    // hangs forever — modelling the real async gap between Today mounting
    // and settings arriving.
    let settingsResolve: (() => void) | null = null;
    const calls: { url: string; method: string }[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        if (method !== "GET") calls.push({ url, method });

        if (url === "/api/tracking-settings") {
          await new Promise<void>((resolve) => {
            settingsResolve = resolve;
          });
          return Response.json({
            dayStartHour: 4,
            wakingStartHour: 7,
            wakingEndHour: 23,
            minGapMinutes: 10,
            moduleOrder: [],
            hiddenModules: [],
            collapsedModules: ["records", "rollups", "signals"],
            hiddenNavItems: [],
            updatedAt: "2026-03-01T09:00:00.000Z",
          });
        }

        const table: Record<string, unknown> = {
          "/api/tasks": [task],
          "/api/projects": [],
          "/api/stages": [],
          "/api/note": { body: "", updatedAt: "2026-03-01T09:00:00.000Z" },
          "/api/quick-todos": [],
          "/api/time-entries": { entries: [], running: null },
          "/api/categories": [],
          "/api/activities": [],
        };
        return Response.json(table[url] ?? { ok: true });
      }),
    );

    render(
      <TasksProvider>
        <Today />
      </TasksProvider>,
    );

    // The Notepad card is never gated on data having loaded, so its
    // disclosure button exists the instant the rail renders, well before
    // settings resolves.
    const collapseButton = await screen.findByRole("button", { name: /Notepad/ });
    fireEvent.click(collapseButton);

    expect(calls).toHaveLength(0);

    // Let tracking-settings resolve and clean up.
    settingsResolve!();
  });
});
