"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTasks } from "@/lib/store-context";
import { PROJECT_COLORS, projectColorVar, type Project } from "@/lib/types";
import SidePanel from "./ui/SidePanel";
import { Field, SavingInput } from "./ui/Field";
import Toggle from "./ui/Toggle";
import Dialog from "./ui/Dialog";
import Button from "./ui/Button";
import Caption from "./ui/Caption";
import CategoryPicker from "./tracking/CategoryPicker";

/**
 * Reached from an explicit Settings action in the project header, rather than
 * by discovering that the title happens to be clickable.
 */
export default function ProjectSettings({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const router = useRouter();
  const { tasks, categories, updateProject, deleteProject } = useTasks();
  const [confirming, setConfirming] = useState(false);

  const affected = tasks.filter((t) => t.projectId === project.id).length;

  const consequence =
    affected === 0
      ? "This project has no tasks."
      : `${affected} ${affected === 1 ? "task keeps" : "tasks keep"} existing, but ${
          affected === 1 ? "it moves" : "they move"
        } to no project and lose their column.`;

  return (
    <SidePanel open onClose={onClose} title="Project settings">
      <div className="space-y-5">
        <SavingInput
          id="project-name"
          label="Name"
          value={project.name}
          onSave={(name) => name.trim() && updateProject(project.id, { name: name.trim() })}
        />

        <Field label="Colour">
          <div className="flex flex-wrap items-center gap-2">
            {PROJECT_COLORS.map((c) => {
              const preview = projectColorVar(c);
              return (
              <button
                key={c}
                onClick={() => updateProject(project.id, { color: c })}
                aria-label={`Use colour ${c}`}
                aria-pressed={project.color === c}
                className="flex size-8 items-center justify-center rounded-full"
              >
                <span
                  className="size-5 rounded-full"
                  style={{
                    background: preview,
                    boxShadow: project.color === c ? `0 0 0 2px var(--color-surface), 0 0 0 4px ${preview}` : undefined,
                  }}
                />
                {/* Colour alone never carries the choice. */}
                {project.color === c && <span className="sr-only">Selected</span>}
              </button>
              );
            })}
          </div>
        </Field>

        <Field label="Timer category">
          <CategoryPicker
            categories={categories}
            value={project.defaultCategoryId}
            onChange={(categoryId) => updateProject(project.id, { defaultCategoryId: categoryId })}
          />
          <p className="mt-1 text-meta text-ink-3">
            Starting a timer on one of this project&apos;s tasks lands here instead of Focus Work.
          </p>
        </Field>

        <div className="flex items-center justify-between gap-4 rounded-row px-4 py-3 inset-ring-1 inset-ring-line">
          <div>
            <p className="text-body font-medium text-ink">Archived</p>
            <p className="text-meta text-ink-3">
              Hides the project from the sidebar. Its tasks stay where they are.
            </p>
          </div>
          <Toggle
            on={project.archived}
            label="Archived"
            onChange={() => updateProject(project.id, { archived: !project.archived })}
          />
        </div>

        <section className="space-y-2">
          <Caption as="h3">Delete permanently</Caption>
          <p className="text-meta text-ink-3">{consequence}</p>
          <Button onClick={() => setConfirming(true)}>Delete this project</Button>
        </section>
      </div>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        role="alertdialog"
        title={`Delete ${project.name}?`}
        description={consequence}
        actions={
          <>
            <Button onClick={() => setConfirming(false)}>Cancel</Button>
            <Button
              variant="primary"
              tone="danger"
              onClick={async () => {
                setConfirming(false);
                await deleteProject(project.id);
                onClose();
                router.push("/all");
              }}
            >
              Yes, delete {project.name}
            </Button>
          </>
        }
      />
    </SidePanel>
  );
}
