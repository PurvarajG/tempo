"use client";

import { useState } from "react";
import { useTasks } from "@/lib/store-context";
import { suggestedClaudeBlocks, pickClaudeCategory } from "@/lib/claude-sessions";
import { useClaudeSessions } from "@/lib/useClaudeSessions";
import { dayWindow } from "@/lib/tracking-day";
import { projectColorVar, type Gap, type Segment, type TrackingSettings } from "@/lib/types";
import { HourGridBox, HourRail } from "../../time/HourGrid";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import { fmt, fmtClock, fmtTime } from "@/lib/format";
import ClaudeBlock from "../ClaudeBlock";
import CategoryPicker from "../CategoryPicker";
import GapBlock from "../GapBlock";
import GapFillForm from "../GapFillForm";
import { segmentSubject } from "../segment-label";
import TaskPicker from "../TaskPicker";
import TimeBlock from "../TimeBlock";

const PX_PER_HOUR = 48;
const MAX_RIBBON_PX = 560; // scroll inside the card past this, never grow the page

function minutesFromStart(iso: string, dayStart: Date): number {
  return (new Date(iso).getTime() - dayStart.getTime()) / 60_000;
}

/** windowStartHour/windowHours/windowStart/height for either the cropped
 * (waking-hours) or full (24h) ribbon window, anchored off the tracking day's
 * own start. */
function ribbonWindow(kind: "full" | "cropped", settings: TrackingSettings, dayStart: Date) {
  const windowStartHour = kind === "full" ? settings.dayStartHour : settings.wakingStartHour;
  const windowHours =
    kind === "full" ? 24 : (settings.wakingEndHour - settings.wakingStartHour + 24) % 24 || 24;
  const windowStart = new Date(
    dayStart.getTime() + ((windowStartHour - settings.dayStartHour + 24) % 24) * 60 * 60_000,
  );
  return { windowStartHour, windowHours, windowStart, height: windowHours * PX_PER_HOUR };
}

/**
 * The vertical continuous day. Reuses DashboardTimeline's geometry approach
 * (percentage offsets, repeating gridlines) rotated to vertical — an hour
 * rail on the left, blocks proportional to duration, absence rendered dashed
 * rather than left blank so it can't be mistaken for "nothing happened here".
 * Crops to the waking window by default; a toggle expands to the full day,
 * scrolling inside the card rather than growing the page.
 */
export default function RibbonModule({ dayISO, isToday }: { dayISO: string; isToday: boolean }) {
  const { segments, gaps, categories, activities, tasks, projects, settings, deleteSegment, patchSegment, addManualSegment } =
    useTasks();
  const sessions = useClaudeSessions();
  const [selected, setSelected] = useState<{ kind: "segment"; segment: Segment } | { kind: "gap"; gap: Gap } | null>(
    null,
  );
  const dayStart = settings ? dayWindow(dayISO, settings).start : null;

  // Auto-expand when a segment is currently running and started outside the
  // cropped window — otherwise a night-shift day opens looking empty.
  const [full, setFull] = useState(() => {
    if (!settings || !dayStart) return false;
    const running = segments.find((s) => !s.endedAt);
    if (!running) return false;
    const cropped = ribbonWindow("cropped", settings, dayStart);
    const startMin = minutesFromStart(running.startedAt, cropped.windowStart);
    return startMin < 0 || startMin >= cropped.windowHours * 60;
  });

  if (!settings || !dayStart) return null;
  const { end: dayEnd } = dayWindow(dayISO, settings);
  const now = new Date();

  const suggestions = suggestedClaudeBlocks(sessions, { start: dayStart, end: dayEnd }, segments, now);
  const claudeCategoryId = pickClaudeCategory(categories);

  const cropped = ribbonWindow("cropped", settings, dayStart);
  const { windowStartHour, windowHours, windowStart, height } = full
    ? ribbonWindow("full", settings, dayStart)
    : cropped;
  const y = (iso: string) => (minutesFromStart(iso, windowStart) / (windowHours * 60)) * height;

  const nowOffset = isToday ? y(now.toISOString()) : null;

  // Minutes hidden by the crop — always measured against the cropped window,
  // regardless of which mode is currently rendered.
  const isOutsideCropped = (startISO: string, endISO: string) => {
    const top = minutesFromStart(startISO, cropped.windowStart);
    const bottom = minutesFromStart(endISO, cropped.windowStart);
    return bottom <= 0 || top >= cropped.windowHours * 60;
  };
  let outsideMinutes = 0;
  for (const segment of segments) {
    const endISO = segment.endedAt ?? (isToday ? now.toISOString() : dayEnd.toISOString());
    if (isOutsideCropped(segment.startedAt, endISO)) {
      outsideMinutes += (new Date(endISO).getTime() - new Date(segment.startedAt).getTime()) / 60_000;
    }
  }
  for (const gap of gaps) {
    if (isOutsideCropped(gap.startedAt, gap.endedAt)) outsideMinutes += gap.minutes;
  }
  for (const s of suggestions) {
    if (isOutsideCropped(s.startedAt, s.endedAt)) {
      outsideMinutes += (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60_000;
    }
  }

  return (
    <div className="space-y-3">
      <div className="overflow-y-auto" style={{ maxHeight: MAX_RIBBON_PX }}>
        <div className="flex">
          <HourRail
            variant="calendar"
            windowStartHour={windowStartHour}
            windowHours={windowHours}
            height={height}
            className="w-14 shrink-0"
          />
          <HourGridBox windowHours={windowHours} height={height} nowOffset={nowOffset}>
          {segments.map((segment) => {
            const top = Math.max(0, y(segment.startedAt));
            const endISO = segment.endedAt ?? (isToday ? now.toISOString() : dayEnd.toISOString());
            const bottom = Math.min(height, y(endISO));
            if (bottom <= 0 || top >= height || bottom <= top) return null;
            const category = categories.find((c) => c.id === segment.categoryId);
            const subject = segmentSubject(segment, categories, activities, tasks, projects);
            return (
              <TimeBlock
                key={segment.id}
                color={category?.color ?? "cat-neutral"}
                label={subject.label}
                projectColor={subject.project?.color ? projectColorVar(subject.project.color) : undefined}
                short={bottom - top < 24}
                onClick={() => setSelected({ kind: "segment", segment })}
                style={{ position: "absolute", top, height: Math.max(bottom - top, 4), left: 4, right: 4 }}
              />
            );
          })}

          {gaps.map((gap) => {
            const top = Math.max(0, y(gap.startedAt));
            const bottom = Math.min(height, y(gap.endedAt));
            if (bottom <= 0 || top >= height || bottom <= top) return null;
            return (
              <GapBlock
                key={`${gap.startedAt}-${gap.endedAt}`}
                label={`${fmt(Math.round(gap.minutes))} gap`}
                onClick={() => setSelected({ kind: "gap", gap })}
                style={{ position: "absolute", top, height: Math.max(bottom - top, 4), left: 4, right: 4 }}
              />
            );
          })}

          {suggestions.map((s) => {
            const top = Math.max(0, y(s.startedAt));
            const bottom = Math.min(height, y(s.endedAt));
            if (bottom <= 0 || top >= height || bottom <= top) return null;
            return (
              <ClaudeBlock
                key={s.key}
                label={s.label}
                timeLabel={`${fmtClock(new Date(s.startedAt))} to ${fmtClock(new Date(s.endedAt))}`}
                short={bottom - top < 24}
                disabled={claudeCategoryId === undefined}
                onAccept={() => {
                  if (claudeCategoryId === undefined) return;
                  void addManualSegment({
                    startedAt: s.startedAt,
                    endedAt: s.endedAt,
                    categoryId: claudeCategoryId,
                    note: s.note,
                  });
                }}
                style={{ position: "absolute", top, height: Math.max(bottom - top, 4), left: 4, right: 4 }}
              />
            );
          })}
          </HourGridBox>
        </div>
      </div>

      {(full || outsideMinutes > 0) && (
        <Button variant="ghost" size="sm" icon="chev" onClick={() => setFull((v) => !v)}>
          {full
            ? "Show waking hours"
            : `${fmt(Math.round(outsideMinutes))} outside ${fmtTime(`${settings.wakingStartHour}:00`)} to ${fmtTime(`${settings.wakingEndHour}:00`)}. Show full day`}
        </Button>
      )}

      {selected && (
        <div className="flex flex-wrap items-center gap-2 rounded-row bg-sunk p-3">
          {selected.kind === "gap" ? (
            <GapFillForm gap={selected.gap} onFilled={() => setSelected(null)} />
          ) : (
            <SegmentEditor
              segment={selected.segment}
              onSave={(patch) => {
                patchSegment(selected.segment.id, patch);
                setSelected(null);
              }}
              onDelete={() => {
                deleteSegment(selected.segment.id);
                setSelected(null);
              }}
              onCancel={() => setSelected(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function SegmentEditor({
  segment,
  onSave,
  onDelete,
  onCancel,
}: {
  segment: Segment;
  onSave: (patch: { categoryId?: string; note?: string; taskId?: string; activityId?: string }) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const { categories, tasks, projects } = useTasks();
  const [categoryId, setCategoryId] = useState(segment.categoryId);
  const [note, setNote] = useState(segment.note ?? "");
  const [taskId, setTaskId] = useState(segment.taskId ?? "");

  return (
    <>
      <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />
      <TaskPicker tasks={tasks} projects={projects} value={taskId || undefined} onChange={setTaskId} clearable />
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
        aria-label="Note"
        wrapperClassName="min-w-0 flex-1"
      />
      <Button
        variant="primary"
        size="sm"
        onClick={() =>
          onSave({
            categoryId,
            note,
            ...(taskId !== (segment.taskId ?? "") ? { taskId, activityId: taskId ? "" : undefined } : {}),
          })
        }
      >
        Save
      </Button>
      <Button variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
      <Button variant="ghost" size="sm" onClick={onDelete}>
        Delete
      </Button>
    </>
  );
}
