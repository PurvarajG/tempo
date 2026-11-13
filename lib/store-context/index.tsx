"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type {
  Activity,
  Category,
  GeneralNote,
  Project,
  ProjectStage,
  QuickTodo,
  Task,
  TaskInput,
  TimeEntry,
  TrackingSettings,
} from "../types";
import { useNote, type NoteApi } from "./use-note";
import { useDayReviews, type DayReviewsApi } from "./use-day-reviews";
import { useQuickTodos, type QuickTodosApi } from "./use-quick-todos";
import { useSegments, type SegmentsApi } from "./use-segments";
import { useStages, type StagesApi } from "./use-stages";
import { useTasksState, type TasksApi } from "./use-tasks";
import { useTime, type TimeApi } from "./use-time";
import { useTrackingConfig, type TrackingConfigApi } from "./use-tracking-config";
import { useUndo, type UndoAction, type UndoApi } from "./use-undo";
import { request } from "./request";
import { fmtDate, fmtWeekday } from "@/lib/format";

export { RequestFailed } from "./request";
export type { SaveState } from "./use-note";
export type { UndoAction, UndoOffer } from "./use-undo";

type WorkspaceValue = Omit<
  TasksApi,
  "completeTask" | "trashTask" | "patchTask" | "moveTask" | "reopenTask" | "addTasks" | "rescheduleTasks"
> &
  StagesApi &
  NoteApi &
  QuickTodosApi &
  TimeApi &
  SegmentsApi &
  TrackingConfigApi &
  DayReviewsApi &
  UndoApi & {
    restoreTask: (id: string) => Promise<void>;
    completeTask: (id: string) => Promise<void>;
    trashTask: (id: string) => Promise<void>;
    patchTask: (id: string, patch: Partial<TaskInput>) => Promise<void>;
    moveTask: (id: string, stageId: string, index: number) => Promise<void>;
    reopenTask: (id: string) => Promise<void>;
    addTasks: (
      texts: string[],
      opts?: { defaultScheduled?: string | null; projectId?: string },
    ) => Promise<Task[]>;
    rescheduleTasks: (ids: string[], day: string | null) => Promise<Task[]>;
    ready: boolean;
    error: string | null;
    dismissError: () => void;
    /** The task open in the shared detail panel, if any. */
    openTaskId: string | null;
    openTask: (id: string) => void;
    closeTask: () => void;
  };

function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** "today", "tomorrow", otherwise "Thu 12 Nov"; null when the date is unreadable. */
function moveTarget(date: string): string | null {
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (date === ymd(today)) return "today";
  if (date === ymd(tomorrow)) return "tomorrow";
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return null;
  if (y !== today.getFullYear()) return `${fmtWeekday(date, "short")} ${fmtDate(date, ymd(today))}`;
  return fmtDate(date, ymd(today));
}

/** "Moved to tomorrow", "Moved to today", otherwise "Moved to Thu 12 Nov". */
function moveLabel(date: string): string {
  const target = moveTarget(date);
  return target ? `Moved to ${target}` : "Moved";
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const onError = useCallback((message: string) => setError(message), []);

  const stages = useStages(onError);
  const { setStages } = stages;
  const onStagesCreated = useCallback(
    (created: ProjectStage[]) => setStages((prev) => [...prev, ...created]),
    [setStages],
  );

  const tasks = useTasksState(onError, onStagesCreated);
  const note = useNote();
  const time = useTime(onError);
  const segments = useSegments(onError);
  const trackingConfig = useTrackingConfig(onError);
  const dayReviews = useDayReviews(onError);

  const { setTasks, getTasks } = tasks;
  const undoApi = useUndo();
  const { offerUndo } = undoApi;
  const { startTimer, stopTimer } = time;

  const stagesRef = useRef(stages.stages);
  useEffect(() => {
    stagesRef.current = stages.stages;
  }, [stages.stages]);

  const runningRef = useRef(time.running);
  useEffect(() => {
    runningRef.current = time.running;
  }, [time.running]);

  const {
    completeTask: rawComplete,
    reopenTask,
    trashTask: rawTrash,
    patchTask: rawPatch,
    moveTask: rawMove,
    addTasks: rawAddTasks,
    rescheduleTasks: rawReschedule,
  } = tasks;

  const reopenPublic = useCallback(async (id: string) => void (await reopenTask(id)), [reopenTask]);

  const upsertTask = useCallback(
    (task: Task) =>
      setTasks((prev) =>
        prev.some((t) => t.id === task.id)
          ? prev.map((t) => (t.id === task.id ? task : t))
          : [...prev, task],
      ),
    [setTasks],
  );

  const completeTask = useCallback(
    async (id: string) => {
      const prior = getTasks().find((t) => t.id === id);
      const { ok, next } = await rawComplete(id);
      if (!ok) return;
      offerUndo("Marked done", async () => {
        await reopenTask(id);
        if (next) {
          try {
            await request(`/api/tasks/${next.id}/forever`, { method: "DELETE" });
            setTasks((prev) => prev.filter((t) => t.id !== next.id));
          } catch (error) {
            onError((error as Error).message);
          }
        }
        if (prior?.stageId) {
          const current = getTasks().find((t) => t.id === id);
          if (current && (current.stageId !== prior.stageId || current.boardOrder !== prior.boardOrder)) {
            await rawMove(id, prior.stageId, prior.boardOrder ?? 0);
          }
        }
      });
    },
    [rawComplete, reopenTask, rawMove, offerUndo, setTasks, getTasks, onError],
  );

  const trashTask = useCallback(
    async (id: string) => {
      const ok = await rawTrash(id);
      if (!ok) return;
      offerUndo("Moved to trash", async () => {
        try {
          const restored = await request<Task>(`/api/tasks/${id}/restore`, { method: "POST" });
          upsertTask(restored);
        } catch (error) {
          onError((error as Error).message);
        }
      });
    },
    [rawTrash, offerUndo, upsertTask, onError],
  );

  const restoreTask = useCallback(
    async (id: string) => {
      try {
        const restored = await request<Task>(`/api/tasks/${id}/restore`, { method: "POST" });
        upsertTask(restored);
        offerUndo("Restored", async () => {
          await rawTrash(id);
        });
      } catch (error) {
        onError((error as Error).message);
      }
    },
    [upsertTask, offerUndo, rawTrash, onError],
  );

  const patchTask = useCallback(
    async (id: string, patch: Partial<TaskInput>) => {
      const prior = getTasks().find((t) => t.id === id);
      const ok = await rawPatch(id, patch);
      if (!ok || !prior) return;
      const keys: ("scheduled" | "finishDate")[] = [];
      if ("scheduled" in patch && patch.scheduled !== undefined && patch.scheduled !== prior.scheduled)
        keys.push("scheduled");
      if ("finishDate" in patch && patch.finishDate !== prior.finishDate) keys.push("finishDate");
      if (keys.length === 0) return;
      const target = patch.scheduled ?? patch.finishDate;
      const label = target ? moveLabel(target) : "Inbox";
      const back: Partial<TaskInput> = {};
      for (const k of keys) (back as Record<string, unknown>)[k] = prior[k];
      offerUndo(label, async () => {
        await rawPatch(id, back);
      });
    },
    [rawPatch, offerUndo, getTasks],
  );

  const moveTask = useCallback(
    async (id: string, stageId: string, index: number) => {
      const prior = getTasks().find((t) => t.id === id);
      const ok = await rawMove(id, stageId, index);
      if (!ok || !prior || prior.stageId === stageId) return;
      const target = stagesRef.current.find((s) => s.id === stageId);
      const runningHere = runningRef.current?.taskId === id;
      // Feature 4.6: done/blocked lanes end the clock; active lanes offer to start it.
      if (runningHere && (target?.kind === "done" || target?.kind === "blocked")) await stopTimer();
      const action: UndoAction | undefined =
        target?.kind === "active" && !runningHere && prior.status === "open"
          ? { label: "Start timer?", run: () => startTimer(id) }
          : undefined;
      offerUndo(
        target?.name ? `Moved to ${target.name}` : "Moved",
        async () => {
          if (prior.stageId) await rawMove(id, prior.stageId, prior.boardOrder ?? 0);
        },
        action,
      );
    },
    [rawMove, offerUndo, getTasks, startTimer, stopTimer],
  );

  const rescheduleTasks = useCallback(
    async (ids: string[], day: string | null) => {
      const snapshot = getTasks();
      const priorById = new Map(snapshot.map((t) => [t.id, t.scheduled ?? null]));
      const saved = await rawReschedule(ids, day);
      if (saved.length === 0) return saved;
      const groups = new Map<string | null, string[]>();
      for (const t of saved) {
        if (!priorById.has(t.id)) continue;
        const prior = priorById.get(t.id) ?? null;
        groups.set(prior, [...(groups.get(prior) ?? []), t.id]);
      }
      const n = saved.length;
      const noun = n === 1 ? "task" : "tasks";
      const target = day ? moveTarget(day) : null;
      offerUndo(`Moved ${n} ${noun} to ${day ? (target ?? "a new day") : "Inbox"}`, async () => {
        for (const [prior, groupIds] of groups) await rawReschedule(groupIds, prior);
      });
      return saved;
    },
    [rawReschedule, offerUndo, getTasks],
  );

  const addTasks = useCallback(
    async (texts: string[], opts?: { defaultScheduled?: string | null; projectId?: string }) => {
      const created = await rawAddTasks(texts, opts);
      if (created.length === 0) return created;
      offerUndo(`Added ${created.length} ${created.length === 1 ? "task" : "tasks"}`, async () => {
        for (const t of created) await rawTrash(t.id);
      });
      return created;
    },
    [rawAddTasks, rawTrash, offerUndo],
  );

  const onTaskCreated = useCallback(
    (task: Task) => {
      setTasks((prev) => [...prev, task]);
      setOpenTaskId(task.id);
    },
    [setTasks],
  );
  const quickTodos = useQuickTodos(onError, onTaskCreated);

  const { setProjects } = tasks;
  const { loadNote } = note;
  const { setQuickTodos } = quickTodos;
  const { setTimeEntries, setRunning } = time;
  const { setCategories, setActivities } = segments;
  const { setSettings } = trackingConfig;

  useEffect(() => {
    Promise.all([
      fetch("/api/tasks").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/stages").then((r) => r.json()),
      fetch("/api/note").then((r) => r.json()),
      fetch("/api/quick-todos").then((r) => r.json()),
      fetch("/api/time-entries").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
      fetch("/api/activities").then((r) => r.json()),
      fetch("/api/tracking-settings").then((r) => r.json()),
    ])
      .then(
        ([t, p, s, n, q, time, cats, acts, settings]: [
          Task[],
          Project[],
          ProjectStage[],
          GeneralNote,
          QuickTodo[],
          { entries: TimeEntry[]; running: TimeEntry | null },
          Category[],
          Activity[],
          TrackingSettings,
        ]) => {
          setTasks(t);
          setProjects(p);
          setStages(s);
          loadNote(n);
          setQuickTodos(q);
          setTimeEntries(time.entries);
          setRunning(time.running);
          setCategories(cats);
          setActivities(acts);
          setSettings(settings);
        },
      )
      .catch(() => setError("Couldn't load your workspace"))
      .finally(() => setReady(true));
  }, [
    setTasks,
    setProjects,
    setStages,
    loadNote,
    setQuickTodos,
    setTimeEntries,
    setRunning,
    setCategories,
    setActivities,
    setSettings,
  ]);

  const dismissError = useCallback(() => setError(null), []);
  const openTask = useCallback((id: string) => setOpenTaskId(id), []);
  const closeTask = useCallback(() => setOpenTaskId(null), []);

  const value = useMemo(
    () => ({
      ...tasks,
      reopenTask: reopenPublic,
      completeTask,
      trashTask,
      patchTask,
      moveTask,
      restoreTask,
      addTasks,
      rescheduleTasks,
      ...undoApi,
      ...stages,
      ...note,
      ...quickTodos,
      ...time,
      ...segments,
      ...trackingConfig,
      ...dayReviews,
      ready,
      error,
      dismissError,
      openTaskId,
      openTask,
      closeTask,
    }),
    [
      tasks,
      reopenPublic,
      completeTask,
      trashTask,
      patchTask,
      moveTask,
      restoreTask,
      addTasks,
      rescheduleTasks,
      undoApi,
      stages,
      note,
      quickTodos,
      time,
      segments,
      trackingConfig,
      dayReviews,
      ready,
      error,
      dismissError,
      openTaskId,
      openTask,
      closeTask,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

/** Named for history: every surface reads the whole workspace from here. */
export function useTasks(): WorkspaceValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useTasks must be used within TasksProvider");
  return ctx;
}

export const useWorkspace = useTasks;
