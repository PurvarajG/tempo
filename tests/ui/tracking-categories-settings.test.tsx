import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CategoriesSection from "@/components/tracking/settings/CategoriesSection";
import { emptyWorkspace, makeCategory, renderWorkspace } from "./harness";

// SettingRow lands in parallel; stand-in with the agreed export.
vi.mock("@/components/settings/SettingRow", () => ({ SETTING_SELECT: "" }));

function calls(mock: { calls: { url: string; method: string; body: unknown }[] }, method: string) {
  return mock.calls.filter((c) => c.url.includes("/api/categories") && c.method === method);
}

function render() {
  const ws = emptyWorkspace();
  ws.categories = [makeCategory()];
  return renderWorkspace(<CategoriesSection />, ws);
}

describe("CategoriesSection", () => {
  it("rename PATCHes", async () => {
    const { mock } = render();
    const input = await screen.findByLabelText("Rename Focus Work");
    fireEvent.change(input, { target: { value: "Deep Work" } });
    await waitFor(() => expect(calls(mock, "PATCH").some((c) => (c.body as { name?: string }).name === "Deep Work")).toBe(true));
  });

  it("kind change PATCHes", async () => {
    const { mock } = render();
    fireEvent.change(await screen.findByLabelText("Kind for Focus Work"), { target: { value: "rest" } });
    await waitFor(() => expect(calls(mock, "PATCH").some((c) => (c.body as { kind?: string }).kind === "rest")).toBe(true));
  });

  it("archive toggle has a visible label and PATCHes", async () => {
    const { mock } = render();
    expect(await screen.findByText("Archived")).toBeTruthy();
    fireEvent.click(screen.getByRole("switch", { name: "Archive Focus Work" }));
    await waitFor(() => expect(calls(mock, "PATCH").some((c) => (c.body as { archived?: boolean }).archived === true)).toBe(true));
  });

  it("add posts name and kind", async () => {
    const { mock } = render();
    fireEvent.change(await screen.findByLabelText("New category name"), { target: { value: "Reading" } });
    fireEvent.change(screen.getByLabelText("New category kind"), { target: { value: "rest" } });
    fireEvent.click(screen.getByRole("button", { name: "Add category" }));
    await waitFor(() => {
      const post = calls(mock, "POST")[0];
      expect(post).toBeTruthy();
      expect(post.body).toMatchObject({ name: "Reading", kind: "rest" });
    });
  });

  it("empty name is ignored", async () => {
    const { mock } = render();
    await screen.findByLabelText("New category name");
    fireEvent.click(screen.getByRole("button", { name: "Add category" }));
    expect(calls(mock, "POST")).toHaveLength(0);
  });
});
