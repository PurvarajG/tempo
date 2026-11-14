import type { ButtonHTMLAttributes, Ref } from "react";
import Icon, { type IconName } from "./Icon";

export type ButtonVariant = "primary" | "ghost" | "chip";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "md" | "sm";
  icon?: IconName;
  iconAfter?: IconName;
  loading?: boolean;
  tone?: "default" | "danger";
  ref?: Ref<HTMLButtonElement>;
}

const BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[background-color,color,transform] duration-150 ease-out disabled:cursor-not-allowed";

const SIZE = {
  md: { primary: "h-9 px-4 text-secondary", ghost: "h-9 px-4 text-secondary", chip: "h-9 px-3.5 text-secondary" },
  sm: { primary: "h-[30px] px-3 text-meta", ghost: "h-[30px] px-3 text-meta", chip: "h-[30px] px-3 text-meta" },
} as const;

function colours(
  variant: ButtonVariant,
  tone: "default" | "danger",
  pressed: boolean,
  size: "md" | "sm",
): string {
  const danger = tone === "danger";
  if (variant === "primary") {
    const live = danger
      ? "bg-hi text-accent-ink"
      : "bg-accent text-accent-ink";
    return `${live} shadow-primary active:scale-[.97] disabled:bg-sunk disabled:text-ink-3 disabled:shadow-none disabled:active:scale-100`;
  }
  const text = danger ? "text-hi" : variant === "chip" && size === "sm" ? "text-ink" : "text-ink-2";
  const pressedCls = pressed ? "bg-sunk text-ink" : "";
  const ring = variant === "chip" ? "inset-ring inset-ring-line-2" : "";
  return `${pressed && !danger ? "" : text} ${pressedCls} ${ring} hover:bg-sunk disabled:text-ink-3 disabled:hover:bg-transparent`;
}

export default function Button({
  variant = "ghost",
  size = "md",
  icon,
  iconAfter,
  loading = false,
  tone = "default",
  type = "button",
  disabled,
  className,
  children,
  ref,
  ...rest
}: ButtonProps) {
  const pressed = rest["aria-pressed"] === true || rest["aria-pressed"] === "true";
  const iconSize = size === "sm" ? 14 : 16;
  const cls = [BASE, SIZE[size][variant], colours(variant, tone, pressed, size), className]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      data-part="btn"
      data-variant={variant}
      disabled={disabled || loading}
      aria-busy={loading ? true : undefined}
      className={cls}
    >
      {icon ? <Icon name={icon} size={iconSize} /> : null}
      {children}
      {iconAfter ? <Icon name={iconAfter} size={iconSize} /> : null}
    </button>
  );
}
