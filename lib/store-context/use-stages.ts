"use client";

import { useCallback, useState } from "react";
import type { ProjectStage, StageInput } from "../types";
import { request } from "./request";

export type StagesApi = {
  stages: ProjectStage[];
  setStages: React.Dispatch<React.SetStateAction<ProjectStage[]>>;
  stagesFor: (projectId: string) => ProjectStage[];
  addStage: (projectId: string, input: StageInput) => Promise<void>;
  renameStage: (id: string, name: string) => Promise<void>;
  reorderStages: (projectId: string, ids: string[]) => Promise<void>;
  removeStage: (id: string, moveTo: string) => Promise<void>;
  /** Patches a stage; `wipLimit: null` clears the limit. */
  updateStage: (id: string, patch: { name?: string; wipLimit?: number | null }) => Promise<void>;
};

export function useStages(onError: (message: string) => void): StagesApi {
  const [stages, setStages] = useState<ProjectStage[]>([]);

  const stagesFor = useCallback(
    (projectId: string) =>
      stages
        .filter((s) => s.projectId === projectId)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)),
    [stages],
  );

  // Adding and removing wait for the server: an optimistic column would either
  // duplicate on retry or strand the tasks it was supposed to carry.
  const addStage = useCallback(
    async (projectId: string, input: StageInput) => {
      try {
        const created = await request<ProjectStage>(`/api/projects/${projectId}/stages`, {
          method: "POST",
          body: JSON.stringify(input),
        });
        setStages((prev) => [...prev, created]);
      } catch (error) {
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const renameStage = useCallback(
    async (id: string, name: string) => {
      let before: ProjectStage[] = [];
      setStages((prev) => {
        before = prev;
        return prev.map((s) => (s.id === id ? { ...s, name } : s));
      });
      try {
        await request(`/api/stages/${id}`, { method: "PATCH", body: JSON.stringify({ name }) });
      } catch (error) {
        setStages(before);
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const updateStage = useCallback<StagesApi["updateStage"]>(
    async (id, patch) => {
      let before: ProjectStage[] = [];
      setStages((prev) => {
        before = prev;
        return prev.map((s) => (s.id === id ? { ...s, ...patch } : s));
      });
      try {
        const saved = await request<ProjectStage | undefined>(`/api/stages/${id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
        if (saved && typeof saved === "object" && "id" in saved) {
          setStages((prev) => prev.map((s) => (s.id === id ? { ...s, ...saved } : s)));
        }
      } catch (error) {
        setStages(before);
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const reorderStages = useCallback(
    async (projectId: string, ids: string[]) => {
      let before: ProjectStage[] = [];
      const order = new Map(ids.map((id, i) => [id, i]));
      setStages((prev) => {
        before = prev;
        return prev.map((s) => (order.has(s.id) ? { ...s, sortOrder: order.get(s.id)! } : s));
      });
      try {
        await request(`/api/stages/reorder`, {
          method: "POST",
          body: JSON.stringify({ projectId, ids }),
        });
      } catch (error) {
        setStages(before);
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const removeStage = useCallback(
    async (id: string, moveTo: string) => {
      try {
        await request(`/api/stages/${id}?moveTo=${moveTo}`, { method: "DELETE" });
        setStages((prev) => prev.filter((s) => s.id !== id));
      } catch (error) {
        onError((error as Error).message);
        throw error;
      }
    },
    [onError],
  );

  return { stages, setStages, stagesFor, addStage, renameStage, updateStage, reorderStages, removeStage };
}
