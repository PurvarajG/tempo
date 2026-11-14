"use client";

import { useState } from "react";
import { useTasks } from "@/lib/store-context";
import type { Activity, Category } from "@/lib/types";
import { useDragReorder } from "@/lib/useDragReorder";
import { SETTING_SELECT } from "@/components/settings/SettingRow";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Toggle from "@/components/ui/Toggle";
import CategoryDot from "../CategoryDot";

/** Add, rename, assign category, set typical duration, toggle preset — grouped by category. */
export default function ActivitiesSection() {
  const { categories } = useTasks();
  const visibleCategories = [...categories].filter((c) => !c.archived).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div>
      {visibleCategories.map((category) => (
        <ActivityGroup key={category.id} category={category} categories={categories} />
      ))}
    </div>
  );
}

function ActivityGroup({ category, categories }: { category: Category; categories: Category[] }) {
  const { activities, addActivity, patchActivity, deleteActivity, reorderActivities } = useTasks();
  const [name, setName] = useState("");
  const [typicalMinutes, setTypicalMinutes] = useState("");

  const ownActivities = activities
    .filter((a) => a.categoryId === category.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const { list, dragHandleProps } = useDragReorder(ownActivities, (ids) => reorderActivities(category.id, ids));

  return (
    <section>
      <div className="flex items-center gap-2 px-3 pb-1 pt-4 text-meta text-ink-3">
        <CategoryDot color={category.color} />
        <h3 className="font-normal">{category.name}</h3>
      </div>

      <ul className="task-list px-2 pb-2">
        {list.map((activity) => (
          <ActivityRow
            key={activity.id}
            activity={activity}
            categories={categories}
            dragHandleProps={dragHandleProps(activity.id)}
            onPatch={(patch) => patchActivity(activity.id, patch)}
            onDelete={() => deleteActivity(activity.id)}
          />
        ))}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) return;
          const minutes = Number(typicalMinutes);
          addActivity({
            categoryId: category.id,
            name: trimmed,
            typicalMinutes: minutes > 0 ? minutes : undefined,
          });
          setName("");
          setTypicalMinutes("");
        }}
        className="flex flex-wrap items-center gap-2 px-3 pb-2"
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Add an activity in ${category.name}`}
          aria-label={`New activity name in ${category.name}`}
          wrapperClassName="min-w-0 flex-1"
        />
        <Input
          type="number"
          min={1}
          value={typicalMinutes}
          onChange={(e) => setTypicalMinutes(e.target.value)}
          placeholder="Typical"
          aria-label={`Typical minutes for new activity in ${category.name}`}
          className="font-mono"
          trailing={<span className="text-meta">min</span>}
          wrapperClassName="w-32"
        />
        <Button type="submit" variant="chip" size="sm">
          Add activity
        </Button>
      </form>
    </section>
  );
}

function Labelled({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-meta text-ink-2">
      {children}
      {text}
    </span>
  );
}

function ActivityRow({
  activity,
  categories,
  dragHandleProps,
  onPatch,
  onDelete,
}: {
  activity: Activity;
  categories: Category[];
  dragHandleProps: React.HTMLAttributes<HTMLLIElement> & { draggable: boolean };
  onPatch: (patch: {
    name?: string;
    categoryId?: string;
    typicalMinutes?: number;
    isPreset?: boolean;
    pinned?: boolean;
    archived?: boolean;
  }) => void;
  onDelete: () => void;
}) {
  return (
    <li
      {...dragHandleProps}
      className={`flex cursor-grab flex-wrap items-center gap-x-4 gap-y-2 rounded-row px-3 py-3 transition-colors duration-150 ease-out hover:bg-row-hover active:cursor-grabbing ${
        activity.archived ? "opacity-50" : ""
      }`}
    >
      <span className="shrink-0 text-ink-dim" aria-hidden>
        <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
          <circle cx="3" cy="3" r="1.3" />
          <circle cx="9" cy="3" r="1.3" />
          <circle cx="3" cy="8" r="1.3" />
          <circle cx="9" cy="8" r="1.3" />
          <circle cx="3" cy="13" r="1.3" />
          <circle cx="9" cy="13" r="1.3" />
        </svg>
      </span>

      <input
        value={activity.name}
        aria-label={`Rename ${activity.name}`}
        onChange={(e) => onPatch({ name: e.target.value })}
        className="min-w-40 flex-1 border-0 bg-transparent p-0 text-body font-medium text-ink"
      />

      <select
        value={activity.categoryId}
        aria-label={`Category for ${activity.name}`}
        onChange={(e) => onPatch({ categoryId: e.target.value })}
        className={SETTING_SELECT}
      >
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <Input
        type="number"
        min={1}
        value={activity.typicalMinutes ?? ""}
        aria-label={`Typical minutes for ${activity.name}`}
        placeholder="0"
        onChange={(e) => {
          const n = Number(e.target.value);
          onPatch({ typicalMinutes: n > 0 ? n : 0 });
        }}
        className="font-mono"
        trailing={<span className="text-meta">min</span>}
        wrapperClassName="w-28"
      />

      <Labelled text="Quick start">
        <Toggle
          on={activity.isPreset}
          label={activity.isPreset ? `Remove ${activity.name} from quick start` : `Add ${activity.name} to quick start`}
          onChange={() => onPatch({ isPreset: !activity.isPreset })}
        />
      </Labelled>

      <Labelled text="Pin to Now">
        <Toggle
          on={activity.pinned}
          label={activity.pinned ? `Unpin ${activity.name}` : `Pin ${activity.name}`}
          disabled={!activity.isPreset}
          onChange={() => onPatch({ pinned: !activity.pinned })}
        />
      </Labelled>

      <Labelled text="Archived">
        <Toggle
          on={activity.archived}
          label={activity.archived ? `Unarchive ${activity.name}` : `Archive ${activity.name}`}
          onChange={() => onPatch({ archived: !activity.archived })}
        />
      </Labelled>

      <Button size="sm" onClick={onDelete} aria-label={`Delete ${activity.name}`}>
        Delete
      </Button>
    </li>
  );
}
