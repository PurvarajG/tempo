"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useTasks } from "@/lib/store-context";
import { PROJECT_COLORS, projectColorVar } from "@/lib/types";
import { readStoredKey } from "@/lib/storage-key";
import Button from "../ui/Button";
import Dialog from "../ui/Dialog";
import Icon from "../ui/Icon";
import {
  GROUP_LABEL,
  NAV_COUNT,
  NAV_ROW,
  NAV_ROW_ON,
  NAV_ROW_REST,
} from "./nav-styles";

const KEY = "doem.projectsCollapsed";
const listeners = new Set<() => void>();

function subscribe(notify: () => void) {
  listeners.add(notify);
  window.addEventListener("storage", notify);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", notify);
  };
}

function readCollapsed(): boolean {
  try {
    return readStoredKey(KEY) === "1";
  } catch {
    return false;
  }
}

/** Projects group collapse state, remembered in localStorage. Falls back to expanded. */
function useProjectsCollapsed(): [boolean, (next: boolean) => void] {
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);
  const setCollapsed = useCallback((next: boolean) => {
    try {
      localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      // Storage unavailable: the change simply isn't remembered.
    }
    for (const notify of listeners) notify();
  }, []);
  return [collapsed, setCollapsed];
}

const OPEN_KEY = "doem.sidebarOpenProject";

function readOpenProject(): string | null {
  try {
    return readStoredKey(OPEN_KEY);
  } catch {
    return null;
  }
}

/** Last opened project id, remembered in localStorage. Null when empty or storage throws. */
function useRememberedProject(): [string | null, (id: string) => void] {
  const id = useSyncExternalStore(subscribe, readOpenProject, () => null);
  const remember = useCallback((next: string) => {
    try {
      localStorage.setItem(OPEN_KEY, next);
    } catch {
      // Storage unavailable: the change simply isn't remembered.
    }
    for (const notify of listeners) notify();
  }, []);
  return [id, remember];
}

/** Rows the open tree may draw before folding the rest into "N more". */
const TREE_CAP = 3;

const MUTED_ROW = `${NAV_ROW} ${NAV_ROW_REST} w-full text-left text-ink-3`;
const FIELD =
  "no-drag h-10 w-full rounded-row bg-raised px-3 text-nav-row text-ink ring-1 ring-line placeholder:text-ink-3";

export default function ProjectTree() {
  const pathname = usePathname();
  const router = useRouter();
  const { tasks, projects, addProject, deleteProject, stagesFor, addStage } =
    useTasks();
  const [collapsed, setCollapsed] = useProjectsCollapsed();
  const [remembered, remember] = useRememberedProject();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [addingStageFor, setAddingStageFor] = useState<string | null>(null);
  const [stageName, setStageName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const openCounts = new Map<string, number>();
  for (const t of tasks) {
    if (t.status !== "open" || !t.projectId) continue;
    openCounts.set(t.projectId, (openCounts.get(t.projectId) ?? 0) + 1);
  }

  async function createProject() {
    const trimmed = name.trim();
    if (!trimmed) {
      setAdding(false);
      return;
    }
    const color = PROJECT_COLORS[projects.length % PROJECT_COLORS.length];
    const project = await addProject(trimmed, color);
    setName("");
    setAdding(false);
    remember(project.id);
    router.push(`/projects/${project.id}`);
  }

  function createStage(projectId: string) {
    const trimmed = stageName.trim();
    setStageName("");
    setAddingStageFor(null);
    if (trimmed) void addStage(projectId, { name: trimmed, kind: "backlog" });
  }

  const visible = projects.filter((p) => !p.archived);
  // One open tree: the route's project, else the remembered one, else the first.
  const routeId = /^\/projects\/([^/]+)/.exec(pathname)?.[1];
  const openId =
    [routeId, remembered].find(
      (id) => id && visible.some((p) => p.id === id),
    ) ?? visible[0]?.id;

  return (
    <div>
      <div data-part="lbl-s" className={GROUP_LABEL}>
        Projects
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand projects" : "Collapse projects"}
          onClick={() => setCollapsed(!collapsed)}
          className={`-my-1 grid size-6 place-items-center rounded-tile text-ink-3 hover:text-ink ${collapsed ? "rotate-180" : ""}`}
        >
          <Icon name="chevup" size={14} />
        </button>
      </div>
      {!collapsed && (
        <nav aria-label="Projects" className="flex flex-col gap-0.5">
          {visible.map((p) => {
            const href = `/projects/${p.id}`;
            const active = pathname === href;
            const open = openCounts.get(p.id) ?? 0;
            const stages = p.id === openId ? stagesFor(p.id) : [];
            return (
              <div key={p.id} className="flex flex-col gap-0.5">
                <div className="no-drag group relative flex items-center">
                  <Link
                    href={href}
                    onClick={() => remember(p.id)}
                    data-part="nav-row"
                    aria-current={active ? "page" : undefined}
                    className={`${NAV_ROW} flex-1 ${active ? NAV_ROW_ON : NAV_ROW_REST}`}
                  >
                    <span
                      data-part="logo"
                      aria-hidden="true"
                      className="grid size-5.5 shrink-0 place-items-center rounded-logo text-logo-tile text-logo-ink shadow-logo"
                      style={{ background: projectColorVar(p.color) }}
                    >
                      {p.name.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="select-text truncate">{p.name}</span>
                    {open > 0 && (
                      <span
                        data-part="nav-count"
                        aria-hidden="true"
                        className={`${NAV_COUNT} group-focus-within:invisible group-hover:invisible`}
                      >
                        {open}
                      </span>
                    )}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setPendingDelete({ id: p.id, name: p.name })}
                    aria-label={`Delete ${p.name}`}
                    className="absolute right-2 grid size-6 place-items-center rounded-tile text-ink-3 opacity-0 hover:bg-sunk hover:text-ink focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
                  >
                    <Icon name="x" size={14} />
                  </button>
                </div>
                {p.id === openId && (
                  <div
                    data-part="tree"
                    className="relative ml-5.5 flex flex-col gap-0.5 pl-3 before:absolute before:inset-y-1 before:left-0 before:w-px before:bg-line-2 before:content-['']"
                  >
                    {(stages.length > TREE_CAP
                      ? stages.slice(0, TREE_CAP - 1)
                      : stages
                    ).map((s) => (
                      <Link
                        key={s.id}
                        href={href}
                        onClick={() => remember(p.id)}
                        data-part="tree-row"
                        className={`${NAV_ROW} ${NAV_ROW_REST} h-9 text-body font-normal`}
                      >
                        <Icon name="folder" size={16} />
                        <span className="select-text truncate">{s.name}</span>
                      </Link>
                    ))}
                    {stages.length > TREE_CAP && (
                      <Link
                        href={href}
                        onClick={() => remember(p.id)}
                        data-part="tree-more"
                        className={`${NAV_ROW} ${NAV_ROW_REST} h-9 text-body font-normal text-ink-3`}
                      >
                        <Icon name="more" size={16} />
                        <span className="truncate">
                          {stages.length - (TREE_CAP - 1)} more
                        </span>
                      </Link>
                    )}
                    {addingStageFor === p.id ? (
                      <input
                        autoFocus
                        value={stageName}
                        onChange={(e) => setStageName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") createStage(p.id);
                          if (e.key === "Escape") {
                            setAddingStageFor(null);
                            setStageName("");
                          }
                        }}
                        onBlur={() => createStage(p.id)}
                        placeholder="List name"
                        aria-label="List name"
                        className={`${FIELD} h-9 text-body`}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAddingStageFor(p.id)}
                        className={`${MUTED_ROW} h-9 text-body`}
                      >
                        <Icon name="plus" size={16} />
                        <span>Add list</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {adding ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void createProject();
                if (e.key === "Escape") {
                  setAdding(false);
                  setName("");
                }
              }}
              onBlur={() => void createProject()}
              placeholder="Project name"
              aria-label="Project name"
              className={FIELD}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className={MUTED_ROW}
            >
              <Icon name="plus" size={16} />
              <span>New project</span>
            </button>
          )}
        </nav>
      )}

      <Dialog
        role="alertdialog"
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={`Delete "${pendingDelete?.name ?? ""}"?`}
        description="Its tasks move to No project."
        initialFocusRef={cancelRef}
        actions={
          <>
            <Button
              ref={cancelRef}
              variant="ghost"
              onClick={() => setPendingDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              tone="danger"
              onClick={() => {
                if (pendingDelete) void deleteProject(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Delete
            </Button>
          </>
        }
      />
    </div>
  );
}
