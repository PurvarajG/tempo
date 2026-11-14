import type { ReactNode } from "react";

/** A native select in the v2 sunk-field form. */
export const SETTING_SELECT = "h-9 rounded-row bg-sunk px-3 text-secondary text-ink";

export default function SettingRow({
  label,
  description,
  control,
  htmlFor,
}: {
  label: ReactNode;
  description?: ReactNode;
  control: ReactNode;
  htmlFor?: string;
}) {
  const labelClass = "text-body font-medium text-ink";
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-3">
      <div className="flex min-w-0 flex-1 basis-48 flex-col justify-center">
        {htmlFor ? (
          <label htmlFor={htmlFor} className={labelClass}>
            {label}
          </label>
        ) : (
          <span className={labelClass}>{label}</span>
        )}
        {description ? <p className="mt-1 text-meta text-ink-3">{description}</p> : null}
      </div>
      <div className="flex shrink-0 items-center">{control}</div>
    </li>
  );
}
