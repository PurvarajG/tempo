"use client";

import { useId, useState } from "react";
import Card, { CardHeader } from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";

/**
 * The disclosure panel shared across the app, drawn as the v2 card: the shared
 * card header (label left, optional action and a ghost chevron right) over a
 * padded body. `tracking/ModuleCard` and `ui/RailPanel` wrap it so existing call
 * sites keep their prop shapes. The `empty` state is a quiet one-line row.
 */
export default function Panel({
  title,
  action,
  collapsible = true,
  defaultCollapsed = false,
  collapsed: collapsedProp,
  onToggleCollapse,
  empty = false,
  emptyText,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  /** Controlled collapse state — when paired with `onToggleCollapse`, the caller
   *  owns persistence. Omit both to fall back to local state. */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  /** When true, renders the quiet empty-state line instead of the full card. */
  empty?: boolean;
  emptyText?: string;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const [localCollapsed, setLocalCollapsed] = useState(defaultCollapsed);
  const collapsed = onToggleCollapse ? (collapsedProp ?? false) : localCollapsed;
  const toggle = onToggleCollapse ?? (() => setLocalCollapsed((v) => !v));

  if (empty) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-row px-4 py-2 ring-1 ring-line">
        <span className="text-body font-medium text-ink-2">{title}</span>
        <span className="truncate text-meta text-ink-3">{emptyText}</span>
      </div>
    );
  }

  const controls =
    action != null || collapsible ? (
      <>
        {action}
        {collapsible && (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
            className="grid size-7 place-items-center rounded-tile text-ink-3 transition-colors duration-150 ease-out hover:bg-sunk hover:text-ink"
          >
            <Icon name="chev" size={16} className={collapsed ? "" : "rotate-90"} />
          </button>
        )}
      </>
    ) : undefined;

  return (
    <Card aria-labelledby={titleId}>
      <CardHeader
        titleId={titleId}
        title={title}
        className={collapsed ? "pb-4" : undefined}
        action={controls}
      />
      {!collapsed && <div className="px-4 pb-4">{children}</div>}
    </Card>
  );
}
