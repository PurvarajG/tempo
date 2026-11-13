import type { InputHTMLAttributes, ReactNode, Ref } from "react";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  variant?: "field" | "composer" | "search";
  leading?: ReactNode;
  trailing?: ReactNode;
  invalid?: boolean;
  ref?: Ref<HTMLInputElement>;
  wrapperClassName?: string;
}

const BASE =
  "flex items-center transition-[background-color,box-shadow] duration-150 ease-out";

const VARIANT: Record<NonNullable<InputProps["variant"]>, string> = {
  field: "h-10 gap-2 rounded-row bg-sunk px-3 text-body text-ink",
  composer:
    "h-[52px] gap-3 rounded-composer bg-surface pl-4 pr-2 text-body text-ink shadow-sm",
  search:
    "h-9 gap-2 rounded-full bg-sunk pl-3.5 pr-1.5 text-secondary text-ink",
};

function outline(variant: NonNullable<InputProps["variant"]>, invalid: boolean) {
  if (invalid) return "inset-ring-1 inset-ring-hi";
  if (variant === "field") return "inset-ring-1 inset-ring-line-strong";
  if (variant === "composer") return "inset-ring-1 inset-ring-line-2";
  return "hover:inset-ring-1 hover:inset-ring-line-2";
}

export default function Input({
  variant = "field",
  leading,
  trailing,
  invalid,
  disabled,
  ref,
  wrapperClassName,
  className,
  ...rest
}: InputProps) {
  const wrapper = [
    BASE,
    VARIANT[variant],
    outline(variant, Boolean(invalid)),
    disabled ? "cursor-not-allowed bg-sunk text-ink-3" : "",
    wrapperClassName ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const slot = "flex shrink-0 items-center text-ink-3";
  const input = [
    "min-w-0 flex-1 border-0 bg-transparent p-0 text-inherit placeholder:text-ink-3 disabled:cursor-not-allowed",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapper} data-variant={variant}>
      {leading ? <span className={slot}>{leading}</span> : null}
      <input
        {...rest}
        ref={ref}
        disabled={disabled}
        aria-invalid={invalid ? true : rest["aria-invalid"]}
        className={input}
      />
      {trailing ? <span className={slot}>{trailing}</span> : null}
    </div>
  );
}
