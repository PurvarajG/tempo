import type { ButtonHTMLAttributes, Ref } from "react";
import Icon, { type IconName } from "./Icon";

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: IconName;
  /** Required: becomes aria-label and title. */
  label: string;
  shape?: "round" | "tile";
  /** Icon size in px. */
  size?: number;
  /** Tile on a sunk lane: hover uses the surface colour. */
  onLane?: boolean;
  /** Round only: a 32px circle (inline row actions) instead of 36px. */
  compact?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export default function IconButton({
  icon,
  label,
  shape = "round",
  size = 16,
  onLane = false,
  compact = false,
  type = "button",
  className,
  ref,
  ...rest
}: IconButtonProps) {
  const disabled = rest.disabled === true;
  const pressed = rest["aria-pressed"] === true || rest["aria-pressed"] === "true";

  const classes = [
    "grid shrink-0 place-items-center transition-colors duration-150 ease-out",
  ];
  if (shape === "round") classes.push(`${compact ? "size-8" : "size-9"} rounded-full ring-1 ring-line`);
  else classes.push("size-8 rounded-tile");

  if (disabled) {
    classes.push("text-ink-3 cursor-not-allowed");
  } else {
    const hover = shape === "tile" && onLane ? "hover:bg-surface" : "hover:bg-sunk";
    classes.push(shape === "round" && !compact ? "text-ink-2" : "text-ink-3", hover);
  }
  if (pressed && !disabled) classes.push("bg-sunk text-ink");
  if (className) classes.push(className);

  return (
    <button
      ref={ref}
      type={type}
      data-part={shape === "tile" ? "icon-tile" : "icon-btn"}
      aria-label={label}
      title={label}
      className={classes.join(" ")}
      {...rest}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}
