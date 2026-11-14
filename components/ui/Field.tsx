"use client";

import { useState } from "react";

export const labelClass =
  "font-mono text-caption font-normal uppercase tracking-caption text-ink-3";

// Resting hairline is line-strong (3:1 control rule). Focus is the single
// global :focus-visible ring in globals.css; nothing here removes it.
const controlClass =
  "w-full rounded-row bg-surface px-3 text-body text-ink inset-ring-1 inset-ring-line-strong transition-[background-color,box-shadow] duration-150 ease-out placeholder:text-ink-3";

export const inputClass = `${controlClass} py-2`;

export const selectClass = `${controlClass} h-10`;

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * A text input that saves on blur (and on Enter for single-line fields) rather
 * than on every keystroke, so a slow network never fights the cursor. Local
 * state is authoritative while focused; the saved value takes over after.
 */
export function SavingInput({
  id,
  label,
  value,
  onSave,
  multiline = false,
  placeholder,
  rows = 4,
}: {
  id: string;
  label: string;
  value: string;
  onSave: (next: string) => void;
  multiline?: boolean;
  placeholder?: string;
  rows?: number;
}) {
  const [draft, setDraft] = useState(value);
  const [adopted, setAdopted] = useState(value);
  const [focused, setFocused] = useState(false);

  // Adopt outside changes (another surface edited the same task), but never
  // yank the text out from under someone who is mid-sentence. Adjusting during
  // render rather than in an effect avoids a second pass with stale text.
  if (!focused && value !== adopted) {
    setAdopted(value);
    setDraft(value);
  }

  const shared = {
    id,
    value: draft,
    placeholder,
    onFocus: () => setFocused(true),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(e.target.value),
    onBlur: () => {
      setFocused(false);
      if (draft !== value) onSave(draft);
    },
    className: inputClass,
  };

  return (
    <Field label={label} htmlFor={id}>
      {multiline ? (
        <textarea {...shared} rows={rows} className={`${inputClass} resize-y`} />
      ) : (
        <input
          {...shared}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
      )}
    </Field>
  );
}
