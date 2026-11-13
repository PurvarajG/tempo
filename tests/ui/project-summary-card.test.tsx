import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import ProjectSummaryCard, { GoneQuietLine } from "@/components/kanban/ProjectSummaryCard";
import type { ProjectSummary } from "@/lib/summary";
import { useTasks } from "@/lib/store-context";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

const summary: ProjectSummary = {
  open: 9,
  completed: 19,
  total: 28,
  percentComplete: 68,
  byStage: [],
  overdue: 0,
  blocked: 0,
  estimatedMinutes: 870,
  recordedMinutes: 2295,
  recordedTodayMinutes: 0,
  recordedWeekMinutes: 380,
};

describe("ProjectSummaryCard", () => {
  test("momentum cell: percent, completed, ticks, note", () => {
    render(<ProjectSummaryCard summary={summary} leftToPlan={870} carriedOver={2} />);
    expect(screen.getByText("Project momentum")).toBeInTheDocument();
    expect(screen.getByText(/68%/)).toBeInTheDocument();
    expect(screen.getByText("completed")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "68% of tasks done" })).toBeInTheDocument();
    expect(screen.getByText("19 of 28 tasks finished.")).toBeInTheDocument();
  });

  test("stat cells with captions, fmt values and notes", () => {
    render(<ProjectSummaryCard summary={summary} leftToPlan={870} carriedOver={2} />);
    expect(screen.getByText("Tracked")).toBeInTheDocument();
    expect(screen.getByText("38h 15m")).toHaveClass("text-pm-value");
    expect(screen.getByText("+6h 20m this week")).toBeInTheDocument();
    expect(screen.getByText("Left to plan")).toBeInTheDocument();
    expect(screen.getByText("14h 30m")).toHaveClass("text-pm-value");
    expect(screen.getByText("Across 9 open tasks")).toBeInTheDocument();
    expect(screen.getByText("Open tasks")).toBeInTheDocument();
    expect(screen.getByText("9")).toHaveClass("text-pm-value");
    expect(screen.getByText("2 carried over")).toBeInTheDocument();
  });

  test("empty notes", () => {
    render(
      <ProjectSummaryCard
        summary={{ ...summary, open: 1, recordedWeekMinutes: 0 }}
        leftToPlan={30}
        carriedOver={0}
      />,
    );
    expect(screen.getByText("Nothing this week")).toBeInTheDocument();
    expect(screen.getByText("Across 1 open task")).toBeInTheDocument();
    expect(screen.getByText("None carried over")).toBeInTheDocument();
  });
});

function Probe() {
  const { openTaskId } = useTasks();
  return <output data-testid="open">{openTaskId ?? "none"}</output>;
}

describe("GoneQuietLine", () => {
  test("renders nothing for no tasks", () => {
    const { container } = renderWorkspace(<GoneQuietLine tasks={[]} />, emptyWorkspace());
    expect(container).toBeEmptyDOMElement();
  });

  test("lists titles, opens the task on click, caps at five", async () => {
    const tasks = Array.from({ length: 7 }, (_, i) =>
      makeTask({ id: `aaaaaaa${i}-1111-4111-8111-111111111111`, title: `Task ${i + 1}` }),
    );
    renderWorkspace(
      <>
        <GoneQuietLine tasks={tasks} />
        <Probe />
      </>,
      emptyWorkspace({ tasks }),
    );
    expect(screen.getByText(/Gone quiet:/)).toBeInTheDocument();
    expect(screen.getByText(/and 2 more\./)).toBeInTheDocument();
    expect(screen.queryByText("Task 6")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Task 2" }));
    expect(screen.getByTestId("open")).toHaveTextContent(tasks[1].id);
  });
});
