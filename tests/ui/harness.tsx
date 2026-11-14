import { render } from "@testing-library/react";
import { vi } from "vitest";
import { TasksProvider } from "@/lib/store-context";
import { FOCUS_WORK_CATEGORY_ID } from "@/lib/types";
import type {
  Activity,
  Category,
  GeneralNote,
  Project,
  ProjectStage,
  QuickTodo,
  Segment,
  Task,
  TimeEntry,
  TrackingSettings,
} from "@/lib/types";

export type Workspace = {
  tasks: Task[];
  projects: Project[];
  stages: ProjectStage[];
  note: GeneralNote;
  quickTodos: QuickTodo[];
  timeEntries: TimeEntry[];
  running: TimeEntry | null;
  categories: Category[];
  activities: Activity[];
  trackingSettings: TrackingSettings;
  /** Served by GET /api/segments?from=…; absent means nothing is running. */
  runningSegment?: Segment | null;
};

export function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: FOCUS_WORK_CATEGORY_ID,
    name: "Focus Work",
    color: "cat-indigo",
    kind: "work",
    sortOrder: 0,
    archived: false,
    createdAt: "2026-03-01T09:00:00.000Z",
    ...overrides,
  };
}

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Write the plan",
    tags: [],
    scheduled: "2026-03-01",
    minutes: 30,
    priority: 0,
    status: "open",
    isComplex: false,
    sortOrder: 0,
    boardOrder: 0,
    createdAt: "2026-03-01T09:00:00.000Z",
    subtasks: [],
    ...overrides,
  };
}

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Website",
    color: "#0052ff",
    archived: false,
    sortOrder: 0,
    createdAt: "2026-03-01T09:00:00.000Z",
    ...overrides,
  };
}

export function makeStages(projectId: string): ProjectStage[] {
  return (["backlog", "active", "blocked", "done"] as const).map((kind, i) => ({
    id: `3333333${i}-3333-4333-8333-333333333333`,
    projectId,
    name: ["Backlog", "In Progress", "Blocked", "Done"][i],
    kind,
    sortOrder: i,
    createdAt: "2026-03-01T09:00:00.000Z",
  }));
}

export function emptyWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    tasks: [],
    projects: [],
    stages: [],
    note: { body: "", updatedAt: "2026-03-01T09:00:00.000Z" },
    quickTodos: [],
    timeEntries: [],
    running: null,
    categories: [makeCategory()],
    activities: [],
    trackingSettings: {
      dayStartHour: 4,
      wakingStartHour: 7,
      wakingEndHour: 23,
      minGapMinutes: 10,
      moduleOrder: [],
      hiddenModules: [],
      collapsedModules: [],
      hiddenNavItems: [],
      updatedAt: "2026-03-01T09:00:00.000Z",
    },
    ...overrides,
  };
}

export type MockFetch = {
  /** Every mutating call the component made, in order. */
  calls: { url: string; method: string; body: unknown }[];
  /** Force the next matching request to fail, to exercise rollback paths. */
  failNext: (urlFragment: string, status?: number, error?: string, extra?: object) => void;
  respondWith: (urlFragment: string, value: unknown) => void;
  /** Serve `value` for the next single request matching `fragment`, then fall through. */
  respondNext: (urlFragment: string, value: unknown, method?: string) => void;
};

/**
 * Renders inside a real TasksProvider with `fetch` stubbed, so the tests
 * exercise the actual optimistic-update and rollback code rather than a mock
 * of it.
 */
export function renderWorkspace(ui: React.ReactNode, workspace: Workspace = emptyWorkspace()) {
  const calls: MockFetch['calls'] = [];
  const failures = new Map<string, { status: number; error: string; extra: object }>();
  const canned = new Map<string, unknown>();
  const oneShots: { fragment: string; value: unknown; method?: string }[] = [];

  const initial: Record<string, unknown> = {
    "/api/tasks": workspace.tasks,
    "/api/projects": workspace.projects,
    "/api/stages": workspace.stages,
    "/api/note": workspace.note,
    "/api/quick-todos": workspace.quickTodos,
    "/api/time-entries": { entries: workspace.timeEntries, running: workspace.running },
    "/api/categories": workspace.categories,
    "/api/activities": workspace.activities,
    "/api/tracking-settings": workspace.trackingSettings,
  };

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      if (method !== "GET") calls.push({ url, method, body });

      for (let i = 0; i < oneShots.length; i++) {
        const shot = oneShots[i];
        if (url.includes(shot.fragment) && (shot.method === undefined || shot.method === method)) {
          oneShots.splice(i, 1);
          return Response.json(shot.value);
        }
      }

      for (const [fragment, failure] of failures) {
        if (url.includes(fragment)) {
          failures.delete(fragment);
          return new Response(JSON.stringify({ error: failure.error, ...failure.extra }), {
            status: failure.status,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      for (const [fragment, value] of canned) {
        if (url.includes(fragment)) {
          return Response.json(value);
        }
      }

      if (method === "GET" && url in initial) return Response.json(initial[url]);
      if (method === "GET" && url.startsWith("/api/segments?")) {
        return Response.json({ segments: [], running: workspace.runningSegment ?? null });
      }
      // Default: echo the patch back merged over the matching task.
      const id = url.split("/api/tasks/")[1]?.split("/")[0];
      const task = workspace.tasks.find((t) => t.id === id);
      return Response.json(task ? { ...task, ...body } : { ok: true });
    }),
  );

  const mock: MockFetch = {
    calls,
    failNext: (fragment, status = 500, error = "That didn't save", extra = {}) =>
      failures.set(fragment, { status, error, extra }),
    respondWith: (fragment, value) => canned.set(fragment, value),
    respondNext: (fragment, value, method) => oneShots.push({ fragment, value, method }),
  };

  return { ...render(<TasksProvider>{ui}</TasksProvider>), mock };
}
