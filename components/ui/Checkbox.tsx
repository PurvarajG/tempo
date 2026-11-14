import type { Ref } from "react";
import Icon from "@/components/ui/Icon";

export interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  /** Required accessible name, e.g. the task title. The caller supplies the copy. */
  label: string;
  size?: "md" | "sm";
  disabled?: boolean;
  className?: string;
  id?: string;
  ref?: Ref<HTMLButtonElement>;
}

const BOX = {
  md: "size-[18px] rounded-check before:-inset-[3px]",
  sm: "size-4 rounded-check before:-inset-1",
} as const;

export default function Checkbox({
  checked,
  onCheckedChange,
  label,
  size = "md",
  disabled = false,
  className,
  id,
  ref,
}: CheckboxProps) {
  const state = checked
    ? "bg-ink inset-ring-0"
    : disabled
      ? "bg-surface inset-ring-[1.5px] inset-ring-line-2"
      : "bg-surface inset-ring-[1.5px] inset-ring-line-strong hover:inset-ring-ink-3";

  return (
    <button
      ref={ref}
      id={id}
      type="button"
      data-part="chk"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        // The checkbox usually lives inside a clickable row. Toggling must not
        // also fire the row's onClick (which opens the task), so stop here.
        e.stopPropagation();
        onCheckedChange(!checked);
      }}
      className={[
        // The ::before overlay grows the hit area to 24px without moving the visual box.
        "relative inline-grid flex-none place-items-center transition-[background-color,box-shadow] duration-150 ease-out before:absolute before:content-['']",
        BOX[size],
        state,
        disabled ? "cursor-not-allowed" : "cursor-pointer",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {checked ? <Icon name="check" size={12} className="text-surface" /> : null}
    </button>
  );
}
