"use client";

import Card, { CardHeader } from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import Panel from "@/components/ui/Panel";

/**
 * A disclosure card for a page's side rail. Drawn as a v2 card with the shared
 * card header; the chevron at the right toggles it. The `empty` state still
 * uses the quiet dashed line from `Panel`.
 */
export default function RailPanel({
  title,
  collapsed,
  onToggleCollapse,
  empty = false,
  emptyText,
  children,
}: {
  title: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** When true, renders the quiet empty-state line instead of the card. */
  empty?: boolean;
  emptyText?: string;
  children: React.ReactNode;
}) {
  if (empty) {
    return (
      <Panel title={title} collapsed={collapsed} onToggleCollapse={onToggleCollapse} empty emptyText={emptyText}>
        {children}
      </Panel>
    );
  }
  return (
    <Card aria-labelledby={`rail-panel-${title}`}>
      <CardHeader
        titleId={`rail-panel-${title}`}
        title={title}
        icon={<Icon name="paper" size={16} />}
        className={collapsed ? "pb-4" : undefined}
        action={
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-expanded={!collapsed}
            aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
            className="grid size-7 place-items-center rounded-tile text-ink-3 transition-colors duration-150 ease-out hover:bg-sunk hover:text-ink"
          >
            <Icon name="chev" size={16} className={collapsed ? "" : "rotate-90"} />
          </button>
        }
      />
      {!collapsed && <div className="px-4 pb-4">{children}</div>}
    </Card>
  );
}
