import { fireEvent, screen, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import { describe, expect, it } from "vitest";
import DayCheck from "@/components/wrap/DayCheck";
import { renderWorkspace } from "./harness";

const DAY = "2026-03-01";

/** Mounts DayCheck a tick late so a test can set its canned reply after render returns. */
function Late() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setOn(true), 0);
    return () => clearTimeout(id);
  }, []);
  return on ? <DayCheck dayISO={DAY} /> : null;
}

const puts = (mock: { calls: { url: string; method: string; body: unknown }[] }) =>
  mock.calls.filter((c) => c.url.includes("/api/day-reviews") && c.method === "PUT");

function review(energy: number | null, note: string | null) {
  return { day: DAY, energy, note, updatedAt: "2026-03-01T20:00:00.000Z" };
}

describe("DayCheck", () => {
  it("starts with nothing pressed for an unsaved day and saves energy on click", async () => {
    const { mock } = renderWorkspace(<DayCheck dayISO={DAY} />);
    mock.failNext("/api/day-reviews", 404, "Not found");
    const good = await screen.findByRole("button", { name: "Good" });
    for (const name of ["Low", "Okay", "Good"]) {
      expect(screen.getByRole("button", { name }).getAttribute("aria-pressed")).toBe("false");
    }
    fireEvent.click(good);
    await waitFor(() => expect(puts(mock)).toHaveLength(1));
    expect(puts(mock)[0].body).toEqual({ day: DAY, energy: 3, note: null });
    expect(good.getAttribute("aria-pressed")).toBe("true");
  });

  it("saves the trimmed line on blur", async () => {
    const { mock } = renderWorkspace(<DayCheck dayISO={DAY} />);
    mock.respondWith("/api/day-reviews", review(null, null));
    const field = await screen.findByLabelText("Note about today");
    fireEvent.change(field, { target: { value: "  Slow start  " } });
    fireEvent.blur(field);
    await waitFor(() => expect(puts(mock)).toHaveLength(1));
    expect(puts(mock)[0].body).toEqual({ day: DAY, energy: null, note: "Slow start" });
  });

  it("pre-selects an existing review and clears energy on a second click", async () => {
    const { mock } = renderWorkspace(<Late />);
    mock.respondWith("/api/day-reviews", review(2, "Steady"));
    const okay = await screen.findByRole("button", { name: "Okay" });
    await waitFor(() => expect(okay.getAttribute("aria-pressed")).toBe("true"));
    expect((screen.getByLabelText("Note about today") as HTMLInputElement).value).toBe("Steady");
    fireEvent.click(okay);
    await waitFor(() => expect(puts(mock)).toHaveLength(1));
    expect(puts(mock)[0].body).toEqual({ day: DAY, energy: null, note: "Steady" });
    expect(okay.getAttribute("aria-pressed")).toBe("false");
  });
});
