"use client";

import { useState } from "react";
import { useTasks } from "@/lib/store-context";
import { CATEGORY_COLOR_TOKENS, CATEGORY_KINDS, type CategoryKind } from "@/lib/types";
import { useDragReorder } from "@/lib/useDragReorder";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Toggle from "@/components/ui/Toggle";
import { SETTING_SELECT } from "@/components/settings/SettingRow";
import { categoryColorVar } from "../colors";

const KIND_LABEL: Record<CategoryKind, string> = {
  work: "Work",
  rest: "Rest",
  upkeep: "Upkeep",
  unclassified: "Unclassified",
};

/** Add, rename, recolour, reorder, archive. The category list lives here, never hardcoded in a module. */
export default function CategoriesSection() {
  const { categories, addCategory, patchCategory, deleteCategory, reorderCategories } = useTasks();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<CategoryKind>("work");
  const [pickingColor, setPickingColor] = useState<string | null>(null);

  const visible = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const { list, dragHandleProps } = useDragReorder(visible, reorderCategories);

  return (
    <div>
      <ul className="task-list px-2 pb-2">
        {list.map((category) => (
          <li
            key={category.id}
            {...dragHandleProps(category.id)}
            className="group grid cursor-grab grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-row px-3 py-3 transition-colors duration-150 ease-out hover:bg-row-hover active:cursor-grabbing"
          >
            <div className={`flex min-w-0 items-center gap-3 transition-opacity duration-150 ${category.archived ? "opacity-50" : ""}`}>
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

              <button
                type="button"
                onClick={() => setPickingColor(pickingColor === category.id ? null : category.id)}
                aria-label={`Change colour for ${category.name}`}
                aria-expanded={pickingColor === category.id}
                className="size-3 shrink-0 rounded-sm"
                style={{ background: categoryColorVar(category.color) }}
              />

              <input
                value={category.name}
                aria-label={`Rename ${category.name}`}
                onChange={(e) => patchCategory(category.id, { name: e.target.value })}
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-body font-medium text-ink"
              />
            </div>

            <div className="flex items-center gap-3">
              <select
                value={category.kind}
                aria-label={`Kind for ${category.name}`}
                onChange={(e) => patchCategory(category.id, { kind: e.target.value as CategoryKind })}
                className={SETTING_SELECT}
              >
                {CATEGORY_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>

              <span className="flex items-center gap-2 text-meta text-ink-3">
                <Toggle
                  on={category.archived}
                  onChange={() => patchCategory(category.id, { archived: !category.archived })}
                  label={category.archived ? `Unarchive ${category.name}` : `Archive ${category.name}`}
                />
                Archived
              </span>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteCategory(category.id)}
                aria-label={`Delete ${category.name}`}
              >
                Delete
              </Button>
            </div>

            {pickingColor === category.id && (
              <div className="col-span-full mt-3 flex flex-wrap gap-2 pl-6">
                {CATEGORY_COLOR_TOKENS.map((token) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => {
                      patchCategory(category.id, { color: token });
                      setPickingColor(null);
                    }}
                    aria-label={`Use ${token}`}
                    aria-pressed={category.color === token}
                    className={`size-5 rounded-sm ${
                      category.color === token ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""
                    }`}
                    style={{ background: categoryColorVar(token) }}
                  />
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) return;
          addCategory({ name: trimmed, color: CATEGORY_COLOR_TOKENS[categories.length % CATEGORY_COLOR_TOKENS.length], kind });
          setName("");
        }}
        className="flex flex-wrap items-center gap-3 px-5 pb-5 pt-2"
      >
        <Input
          variant="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category"
          aria-label="New category name"
          wrapperClassName="min-w-0 flex-1"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as CategoryKind)}
          aria-label="New category kind"
          className={SETTING_SELECT}
        >
          {CATEGORY_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
        <Button type="submit" variant="chip" size="sm">
          Add category
        </Button>
      </form>
    </div>
  );
}
