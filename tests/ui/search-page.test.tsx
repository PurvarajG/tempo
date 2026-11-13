import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SearchPage from "@/app/search/page";
import { emptyWorkspace, makeProject, makeTask, renderWorkspace } from "./harness";

let query = "";
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(query ? `q=${query}` : ""),
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => "/search",
}));

const PID = "22222222-2222-4222-8222-222222222222";
const ws = () =>
  emptyWorkspace({
    tasks: [
      makeTask({ id: "a1111111-1111-4111-8111-111111111111", title: "Write the plan", projectId: PID }),
      makeTask({ id: "b1111111-1111-4111-8111-111111111111", title: "Buy milk" }),
    ],
    projects: [makeProject({ id: PID, name: "Planning hub" })],
  });

beforeEach(() => {
  query = "";
  replace.mockClear();
});

describe("Search page", () => {
  it("shows results and the count from ?q=", async () => {
    query = "plan";
    renderWorkspace(<SearchPage />, ws());
    expect(await screen.findByText("Write the plan")).toBeInTheDocument();
    expect(screen.queryByText("Buy milk")).toBeNull();
    expect(screen.getByText("2 results for “plan”.")).toBeInTheDocument();
  });

  it("updates results and the URL as you type", async () => {
    renderWorkspace(<SearchPage />, ws());
    const field = await screen.findByRole("textbox", { name: "Search" });
    fireEvent.change(field, { target: { value: "milk" } });
    expect(await screen.findByText("Buy milk")).toBeInTheDocument();
    expect(replace).toHaveBeenLastCalledWith("/search?q=milk");
    fireEvent.change(field, { target: { value: "" } });
    expect(replace).toHaveBeenLastCalledWith("/search");
  });

  it("shows the blank empty state", async () => {
    renderWorkspace(<SearchPage />, ws());
    expect(await screen.findByText("Search your tasks and projects")).toBeInTheDocument();
    expect(screen.getByText(/Press ⌘K/)).toBeInTheDocument();
  });

  it("shows the no-match empty state", async () => {
    query = "zzz";
    renderWorkspace(<SearchPage />, ws());
    expect(await screen.findByText("Nothing matches “zzz”.")).toBeInTheDocument();
    expect(screen.getByText("Try fewer words, or part of a project name.")).toBeInTheDocument();
  });

  it("links project results to the project page", async () => {
    query = "hub";
    renderWorkspace(<SearchPage />, ws());
    const link = await screen.findByRole("link", { name: /Planning hub/ });
    expect(link).toHaveAttribute("href", `/projects/${PID}`);
    expect(link).toHaveTextContent("1 open");
  });
});
