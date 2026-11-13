"use client";

import { useCallback, useRef, useState } from "react";
import type { Project, ProjectStage, Task, TaskInput } from "../types";
import { request, RequestFailed } from "./request";

type AddOptions = { projectId?: string; stageId?: string; scheduled?: string | null };

export type TasksApi = {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  /** The latest tasks, updated synchronously by every setTasks (no render needed). */
  getTasks: () => Task[];
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  addTask: (text: string, opts?: AddOptions) => Promise<Task | null>;
  patchTask: (id: string, patch: Partial<TaskInput>) => Promise<boolean>;
  moveTask: (id: string, stageId: string, index: number) => Promise<boolean>;
  completeTask: (id: string) => Promise<{ ok: boolean; next: Task | null }>;
  reopenTask: (id: string) => Promise<boolean>;
  trashTask: (id: string) => Promise<boolean>;
  reorderTasks: (ids: string[]) => Promise<void>;
  addTasks: (
    texts: string[],
    opts?: { defaultScheduled?: string | null; projectId?: string },
  ) => Promise<Task[]>;
  rescheduleTasks: (ids: string[], day: string | null) => Promise<Task[]>;
  commitTask: (
    id: string,
    day: string,
  ) => Promise<{ ok: true; task: Task } | { ok: false; committed: Task[] } | null>;
  uncommitTask: (id: string) => Promise<Task | null>;
  linkBlocker: (taskId: string, blockerId: string) => Promise<Task | null>;
  unlinkBlocker: (taskId: string, blockerId: string) => Promise<Task | null>;
  expireDueTasks: (today: string) => Promise<Task[]>;
  addSubtask: (taskId: string, title: string) => Promise<void>;
  toggleSubtask: (taskId: string, subtaskId: string, done: boolean) => Promise<void>;
  deleteSubtask: (taskId: string, subtaskId: string) => Promise<void>;
  addProject: (name: string, color?: string) => Promise<Project>;
  updateProject: (id: string, patch: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
};

export function useTasksState(
  onError: (message: string) => void,
  onStagesCreated: (stages: ProjectStage[]) => void,
): TasksApi {
  const [tasks, setTasksState] = useState<Task[]>([]);
  const latest = useRef<Task[]>(tasks);
  const setTasks = useCallback<React.Dispatch<React.SetStateAction<Task[]>>>((action) => {
    latest.current = typeof action === "function" ? action(latest.current) : action;
    setTasksState(latest.current);
  }, []);
  const getTasks = useCallback(() => latest.current, []);
  const [projects, setProjects] = useState<Project[]>([]);

  const addTask = useCallback(
    async (text: string, opts?: AddOptions) => {
      const raw = text.trim();
      if (!raw) return null;
      try {
        const created = await request<Task>("/api/tasks", {
          method: "POST",
          body: JSON.stringify({ text: raw, ...opts }),
        });
        setTasks((prev) => [...prev, created]);

        // Quick-add can create a brand-new #project server-side. If so, our
        // `projects` state has never heard of it, so refresh it (and its
        // stages) or the new task has no lane to render in until reload.
        // A failed refresh must not fail task creation itself.
        if (created.projectId && !projects.some((p) => p.id === created.projectId)) {
          try {
            const [freshProjects, freshStages] = await Promise.all([
              request<Project[]>("/api/projects"),
              request<ProjectStage[]>("/api/stages"),
            ]);
            setProjects(freshProjects);
            onStagesCreated(freshStages.filter((stage) => stage.projectId === created.projectId));
          } catch (error) {
            onError((error as Error).message);
          }
        }

        return created;
      } catch (error) {
        onError((error as Error).message);
        throw error;
      }
    },
    [onError, onStagesCreated, projects, setTasks],
  );

  const patchTask = useCallback(
    async (id: string, patch: Partial<TaskInput>) => {
      let before: Task[] = [];
      setTasks((prev) => {
        before = prev;
        return prev.map((t) => (t.id === id ? ({ ...t, ...patch } as Task) : t));
      });
      try {
        const saved = await request<Task>(`/api/tasks/${id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
        setTasks((prev) => prev.map((t) => (t.id === id ? saved : t)));
        return true;
      } catch (error) {
        setTasks(before);
        onError((error as Error).message);
        return false;
      }
    },
    [onError, setTasks],
  );

  /**
   * A board drop. Optimism here is deterministic — the card is already where
   * the user dropped it — so the whole list is restored on failure and the
   * card visibly returns to its old column.
   */
  const moveTask = useCallback(
    async (id: string, stageId: string, index: number) => {
      let before: Task[] = [];
      setTasks((prev) => {
        before = prev;
        return prev.map((t) => (t.id === id ? { ...t, stageId, boardOrder: index } : t));
      });
      try {
        const saved = await request<Task>(`/api/tasks/${id}/move`, {
          method: "POST",
          body: JSON.stringify({ stageId, index }),
        });
        // The server renumbers both columns, so take its ordering wholesale.
        const fresh = await request<Task[]>("/api/tasks");
        setTasks(fresh);
        void saved;
        return true;
      } catch (error) {
        setTasks(before);
        onError((error as Error).message);
        return false;
      }
    },
    [onError, setTasks],
  );

  const completeTask = useCallback(
    async (id: string) => {
      let before: Task[] = [];
      setTasks((prev) => {
        before = prev;
        return prev.map((t) =>
          t.id === id ? { ...t, status: "done" as const, completedAt: new Date().toISOString() } : t,
        );
      });
      try {
        const saved = await request<{ task: Task; next: Task | null }>(
          `/api/tasks/${id}/complete`,
          { method: "POST" },
        );
        setTasks((prev) => {
          const next = prev.map((t) => (t.id === id ? saved.task : t));
          return saved.next ? [...next, saved.next] : next;
        });
        return { ok: true, next: saved.next ?? null };
      } catch (error) {
        setTasks(before);
        onError((error as Error).message);
        return { ok: false, next: null };
      }
    },
    [onError, setTasks],
  );

  const reopenTask = useCallback(
    async (id: string) => {
      let before: Task[] = [];
      setTasks((prev) => {
        before = prev;
        return prev.map((t) =>
          t.id === id ? { ...t, status: "open" as const, completedAt: undefined } : t,
        );
      });
      try {
        const saved = await request<Task>(`/api/tasks/${id}/reopen`, { method: "POST" });
        setTasks((prev) => prev.map((t) => (t.id === id ? saved : t)));
        return true;
      } catch (error) {
        setTasks(before);
        onError((error as Error).message);
        return false;
      }
    },
    [onError, setTasks],
  );

  const trashTask = useCallback(
    async (id: string) => {
      let before: Task[] = [];
      setTasks((prev) => {
        before = prev;
        return prev.filter((t) => t.id !== id);
      });
      try {
        await request(`/api/tasks/${id}`, { method: "DELETE" });
        return true;
      } catch (error) {
        setTasks(before);
        onError((error as Error).message);
        return false;
      }
    },
    [onError, setTasks],
  );

  const reorderTasks = useCallback(
    async (ids: string[]) => {
      let before: Task[] = [];
      const order = new Map(ids.map((id, i) => [id, i]));
      setTasks((prev) => {
        before = prev;
        return prev.map((t) => (order.has(t.id) ? { ...t, sortOrder: order.get(t.id)! } : t));
      });
      try {
        await request("/api/tasks/reorder", { method: "POST", body: JSON.stringify({ ids }) });
      } catch (error) {
        setTasks(before);
        onError((error as Error).message);
      }
    },
    [onError, setTasks],
  );

  const replaceTasks = useCallback(
    (saved: Task[]) => {
      const byId = new Map(saved.map((t) => [t.id, t]));
      setTasks((prev) => prev.map((t) => byId.get(t.id) ?? t));
    },
    [setTasks],
  );

  const addTasks = useCallback(
    async (texts: string[], opts?: { defaultScheduled?: string | null; projectId?: string }) => {
      const items = texts.map((t) => t.trim()).filter(Boolean).map((text) => ({ text }));
      if (items.length === 0) return [];
      try {
        const created = await request<Task[]>("/api/tasks/batch", {
          method: "POST",
          body: JSON.stringify({ items, ...opts }),
        });
        setTasks((prev) => [...prev, ...created]);
        return created;
      } catch (error) {
        onError((error as Error).message);
        throw error;
      }
    },
    [onError, setTasks],
  );

  const rescheduleTasks = useCallback(
    async (ids: string[], day: string | null) => {
      if (ids.length === 0) return [];
      try {
        const saved = await request<Task[]>("/api/tasks/reschedule", {
          method: "POST",
          body: JSON.stringify({ ids, day }),
        });
        replaceTasks(saved);
        return saved;
      } catch (error) {
        onError((error as Error).message);
        return [];
      }
    },
    [onError, replaceTasks],
  );

  const commitTask = useCallback(
    async (id: string, day: string) => {
      // request() drops the 409 body, so call fetch directly to keep `committed`.
      try {
        let res: Response;
        try {
          res = await fetch(`/api/tasks/${id}/commit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ day }),
          });
        } catch {
          throw new RequestFailed(0, "You appear to be offline");
        }
        if (res.status === 409) {
          const body = (await res.json().catch(() => null)) as { committed?: Task[] } | null;
          return { ok: false as const, committed: body?.committed ?? [] };
        }
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new RequestFailed(res.status, body?.error ?? "That didn't save");
        }
        const task = (await res.json()) as Task;
        setTasks((prev) => prev.map((t) => (t.id === id ? task : t)));
        return { ok: true as const, task };
      } catch (error) {
        onError((error as Error).message);
        return null;
      }
    },
    [onError, setTasks],
  );

  const saveOne = useCallback(
    async (url: string, init: RequestInit) => {
      try {
        const saved = await request<Task>(url, init);
        setTasks((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
        return saved;
      } catch (error) {
        onError((error as Error).message);
        return null;
      }
    },
    [onError, setTasks],
  );

  const uncommitTask = useCallback(
    (id: string) => saveOne(`/api/tasks/${id}/commit`, { method: "DELETE" }),
    [saveOne],
  );

  const linkBlocker = useCallback(
    (taskId: string, blockerId: string) =>
      saveOne(`/api/tasks/${taskId}/links`, {
        method: "POST",
        body: JSON.stringify({ blockerId }),
      }),
    [saveOne],
  );

  const unlinkBlocker = useCallback(
    (taskId: string, blockerId: string) =>
      saveOne(`/api/tasks/${taskId}/links?blockerId=${encodeURIComponent(blockerId)}`, {
        method: "DELETE",
      }),
    [saveOne],
  );

  const expireDueTasks = useCallback(
    async (today: string) => {
      try {
        const expired = await request<Task[]>("/api/tasks/expire", {
          method: "POST",
          body: JSON.stringify({ today }),
        });
        if (expired.length > 0) {
          const gone = new Set(expired.map((t) => t.id));
          setTasks((prev) => prev.filter((t) => !gone.has(t.id)));
        }
        return expired;
      } catch (error) {
        onError((error as Error).message);
        return [];
      }
    },
    [onError, setTasks],
  );

  const addSubtask = useCallback(
    async (taskId: string, title: string) => {
      try {
        const sub = await request(`/api/tasks/${taskId}/subtasks`, {
          method: "POST",
          body: JSON.stringify({ title }),
        });
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, subtasks: [...t.subtasks, sub as never] } : t,
          ),
        );
      } catch (error) {
        onError((error as Error).message);
      }
    },
    [onError, setTasks],
  );

  const toggleSubtask = useCallback(
    async (taskId: string, subtaskId: string, done: boolean) => {
      let before: Task[] = [];
      setTasks((prev) => {
        before = prev;
        return prev.map((t) =>
          t.id === taskId
            ? { ...t, subtasks: t.subtasks.map((s) => (s.id === subtaskId ? { ...s, done } : s)) }
            : t,
        );
      });
      try {
        await request(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
          method: "PATCH",
          body: JSON.stringify({ done }),
        });
      } catch (error) {
        setTasks(before);
        onError((error as Error).message);
      }
    },
    [onError, setTasks],
  );

  const deleteSubtask = useCallback(
    async (taskId: string, subtaskId: string) => {
      let before: Task[] = [];
      setTasks((prev) => {
        before = prev;
        return prev.map((t) =>
          t.id === taskId
            ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) }
            : t,
        );
      });
      try {
        await request(`/api/tasks/${taskId}/subtasks/${subtaskId}`, { method: "DELETE" });
      } catch (error) {
        setTasks(before);
        onError((error as Error).message);
      }
    },
    [onError, setTasks],
  );

  const addProject = useCallback(
    async (name: string, color?: string) => {
      const { project, stages } = await request<{ project: Project; stages: ProjectStage[] }>(
        "/api/projects",
        { method: "POST", body: JSON.stringify({ name, color }) },
      );
      setProjects((prev) => [...prev, project]);
      onStagesCreated(stages);
      return project;
    },
    [onStagesCreated],
  );

  const updateProject = useCallback(
    async (id: string, patch: Partial<Project>) => {
      let before: Project[] = [];
      setProjects((prev) => {
        before = prev;
        return prev.map((p) => (p.id === id ? { ...p, ...patch } : p));
      });
      try {
        await request(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      } catch (error) {
        setProjects(before);
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const deleteProject = useCallback(
    async (id: string) => {
      let beforeProjects: Project[] = [];
      let beforeTasks: Task[] = [];
      setProjects((prev) => {
        beforeProjects = prev;
        return prev.filter((p) => p.id !== id);
      });
      setTasks((prev) => {
        beforeTasks = prev;
        return prev.map((t) =>
          t.projectId === id ? { ...t, projectId: undefined, stageId: undefined } : t,
        );
      });
      try {
        await request(`/api/projects/${id}`, { method: "DELETE" });
      } catch (error) {
        setProjects(beforeProjects);
        setTasks(beforeTasks);
        onError((error as Error).message);
      }
    },
    [onError, setTasks],
  );

  return {
    tasks,
    setTasks,
    getTasks,
    projects,
    setProjects,
    addTask,
    patchTask,
    moveTask,
    completeTask,
    reopenTask,
    trashTask,
    reorderTasks,
    addTasks,
    rescheduleTasks,
    commitTask,
    uncommitTask,
    linkBlocker,
    unlinkBlocker,
    expireDueTasks,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    addProject,
    updateProject,
    deleteProject,
  };
}
