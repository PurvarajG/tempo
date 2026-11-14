"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  size?: "md" | "sm";
  className?: string;
}

const TRACK: Record<"md" | "sm", string> = {
  md: "gap-[2px] p-1 rounded-composer",
  sm: "gap-[2px] p-[3px] rounded-tab",
};

const BUTTON: Record<"md" | "sm", string> = {
  md: "h-[34px] px-[14px] rounded-tab text-body",
  sm: "h-[28px] px-[10px] rounded-tile text-meta",
};

export default function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = "md",
  className,
}: SegmentedProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function move(from: number, step: 1 | -1) {
    const n = options.length;
    for (let i = 1; i <= n; i++) {
      const idx = (from + step * i + n * i) % n;
      if (!options[idx].disabled) return idx;
    }
    return -1;
  }

  function select(idx: number) {
    if (idx < 0) return;
    onChange(options[idx].value);
    refs.current[idx]?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const current = options.findIndex((o) => o.value === value);
    let target: number | null = null;
    if (e.key === "ArrowRight") target = move(current < 0 ? -1 : current, 1);
    else if (e.key === "ArrowLeft") target = move(current < 0 ? 0 : current, -1);
    else if (e.key === "Home") target = options.findIndex((o) => !o.disabled);
    else if (e.key === "End") {
      for (let i = options.length - 1; i >= 0; i--) {
        if (!options[i].disabled) {
          target = i;
          break;
        }
      }
      if (target === null) target = -1;
    }
    if (target === null) return;
    e.preventDefault();
    select(target);
  }

  const tabbable = options.some((o) => o.value === value && !o.disabled)
    ? value
    : options.find((o) => !o.disabled)?.value;

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      data-part="seg"
      onKeyDown={onKeyDown}
      className={`inline-flex bg-sunk ${TRACK[size]}${className ? ` ${className}` : ""}`}
    >
      {options.map((opt, i) => {
        const checked = opt.value === value;
        const state = opt.disabled
          ? "text-ink-3"
          : checked
            ? "bg-raised text-ink font-medium shadow-sm ring-1 ring-line"
            : "text-ink-3 hover:text-ink-2";
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={opt.disabled}
            tabIndex={opt.value === tabbable ? 0 : -1}
            onClick={() => onChange(opt.value)}
            className={`flex items-center gap-2 transition-[background-color,box-shadow,color] duration-200 ease-out ${BUTTON[size]} ${state}`}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
