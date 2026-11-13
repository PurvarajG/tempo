"use client";

/**
 * The single on/off switch control for the app — previously hand-rolled
 * inline inside `components/settings/NavVisibility.tsx`. Any page adding a
 * boolean setting (Settings' sidebar visibility today, tracking or other
 * settings later) should reach for this instead of a second bespoke toggle.
 *
 * Renders as an ARIA switch: `role="switch"` + `aria-checked`, driven purely
 * by props — the caller owns state and persistence (e.g. via `patchSettings`).
 */
export default function Toggle({
  on,
  onChange,
  label,
  disabled = false,
}: {
  on: boolean;
  onChange: () => void;
  /** Accessible name, e.g. "Hide Trash" — announced by role="switch". */
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
        on ? "bg-accent" : "bg-line-strong"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <span
        aria-hidden
        className={`absolute top-0.5 size-4 rounded-full bg-surface shadow-sm transition-[left] duration-150 ease-out ${
          on ? "left-4.5" : "left-0.5"
        }`}
      />
    </button>
  );
}
