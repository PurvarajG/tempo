"use client";

import { Fragment, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Card, { CardHeader } from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import Input from "@/components/ui/Input";
import Menu from "@/components/ui/Menu";
import { fmt, fmtClock, fmtDate } from "@/lib/format";
import { addDays, toISODate } from "@/lib/parse";
import { useTasks } from "@/lib/store-context";
import type { Segment } from "@/lib/types";
import CategoryPicker from "../CategoryPicker";
import { segmentLabel, segmentSubject } from "../segment-label";
import TaskPicker from "../TaskPicker";

const TH = "bg-sunk px-3 py-2.5 text-left font-mono text-caption font-normal uppercase tracking-caption text-ink-3";
const TD = "border-b border-line px-3 py-3 group-last:border-b-0";

function startedLabel(iso: string, todayISO: string): string {
  const d = new Date(iso);
  const day = toISODate(d);
  const time = fmtClock(d);
  if (day === todayISO) return `Today ${time}`;
  if (day === addDays(todayISO, -1)) return `Yesterday ${time}`;
  return `${fmtDate(day, todayISO)} ${time}`;
}

function source(segment: Segment): { label: string; dot: string } {
  if (!segment.endedAt) return { label: "Running", dot: "bg-ok" };
  if (segment.source === "manual") return { label: "Manual", dot: "bg-accent" };
  if (segment.source === "backfill") return { label: "Gap fill", dot: "bg-ink-3" };
  return { label: "Timer", dot: "bg-ink-3" };
}

/** The Recent entries card (soft.html 697-708): the day's segments, every one editable. */
export default function RecordsModule({ now, dayISO, todayISO }: { now: Date; dayISO: string; todayISO: string }) {
  const { segments, categories, activities, tasks, projects, patchSegment, deleteSegment, openTask } = useTasks();
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [newestFirst, setNewestFirst] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const filtered = filterCategory === "all" ? segments : segments.filter((s) => s.categoryId === filterCategory);
    return [...filtered].sort((a, b) =>
      newestFirst ? b.startedAt.localeCompare(a.startedAt) : a.startedAt.localeCompare(b.startedAt),
    );
  }, [segments, filterCategory, newestFirst]);

  const dayLabel = dayISO === todayISO ? "Today" : fmtDate(dayISO, todayISO);

  const right = (
    <span className="flex items-center gap-2">
      {segments.length > 0 && (
        <>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            aria-label="Filter by category"
            className="h-[30px] rounded-full bg-transparent px-3 text-meta text-ink inset-ring-1 inset-ring-line-2"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={() => setNewestFirst((v) => !v)}>
            {newestFirst ? "Newest first" : "Oldest first"}
          </Button>
        </>
      )}
      <span>{dayLabel}</span>
    </span>
  );

  return (
    <Card>
      <CardHeader title="Recent entries" icon={<Icon name="clock" size={16} />} right={right} />
      <div className="px-3 pb-3">
        {segments.length === 0 ? (
          <p className="px-4 py-3 text-body text-ink-3">Nothing tracked on this day.</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-3 text-body text-ink-3">No entries in this category.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-secondary">
              <thead>
                <tr>
                  <th className={`${TH} rounded-l-tab`}>Task</th>
                  <th className={TH}>Project</th>
                  <th className={TH}>Started</th>
                  <th className={TH}>Source</th>
                  <th className={`${TH} text-right`}>Duration</th>
                  <th className={`${TH} w-12 rounded-r-tab`}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((segment) => {
                  const subject = segmentSubject(segment, categories, activities, tasks, projects);
                  const src = source(segment);
                  const minutes = Math.max(
                    0,
                    Math.round(
                      (new Date(segment.endedAt ?? now.toISOString()).getTime() - new Date(segment.startedAt).getTime()) /
                        60_000,
                    ),
                  );
                  const editing = editingId === segment.id;
                  return (
                    <Fragment key={segment.id}>
                      <tr className="group">
                        <td className={`${TD} text-ink`}>
                          {subject.task ? (
                            <button
                              type="button"
                              onClick={() => openTask(subject.task!.id)}
                              className="text-left hover:underline"
                            >
                              {subject.label}
                            </button>
                          ) : (
                            subject.label
                          )}
                        </td>
                        <td className={`${TD} text-ink`}>
                          {subject.project ? subject.project.name : null}
                        </td>
                        <td className={`${TD} whitespace-nowrap font-mono text-ink-2`}>
                          {startedLabel(segment.startedAt, todayISO)}
                        </td>
                        <td className={TD}>
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-meta text-ink-2 inset-ring-1 inset-ring-line-2">
                            <i aria-hidden className={`size-1.5 rounded-full ${src.dot}`} />
                            {src.label}
                          </span>
                        </td>
                        <td className={`${TD} whitespace-nowrap text-right font-mono text-ink-2`}>{fmt(minutes)}</td>
                        <td className={`${TD} text-right`}>
                          <Menu
                            variant="icon"
                            ariaLabel="Edit entry"
                            label={<Icon name="more" size={16} />}
                            minWidth={140}
                            items={[
                              { id: "edit", label: "Edit", onSelect: () => setEditingId(editing ? null : segment.id) },
                              {
                                id: "delete",
                                label: "Delete",
                                danger: true,
                                onSelect: () => {
                                  if (editing) setEditingId(null);
                                  deleteSegment(segment.id);
                                },
                              },
                            ]}
                          />
                        </td>
                      </tr>
                      {editing && (
                        <tr>
                          <td colSpan={6} className="border-b border-line px-3 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <CategoryPicker
                                categories={categories}
                                value={segment.categoryId}
                                onChange={(categoryId) => patchSegment(segment.id, { categoryId })}
                              />
                              <TaskPicker
                                tasks={tasks}
                                projects={projects}
                                value={segment.taskId}
                                clearable
                                placeholder="Link a task"
                                onChange={(taskId) =>
                                  patchSegment(segment.id, { taskId, activityId: taskId ? "" : undefined })
                                }
                              />
                              <Input
                                wrapperClassName="min-w-48 flex-1"
                                defaultValue={segment.note ?? ""}
                                placeholder="Note"
                                aria-label={`Note for ${segmentLabel(segment, categories, activities, tasks)}`}
                                onBlur={(e) => {
                                  if (e.target.value !== (segment.note ?? "")) {
                                    patchSegment(segment.id, { note: e.target.value });
                                  }
                                }}
                              />
                              <Button variant="chip" onClick={() => setEditingId(null)}>
                                Done
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}
