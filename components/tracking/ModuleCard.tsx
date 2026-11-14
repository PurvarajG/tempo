"use client";

import { useId, useState } from "react";
import Card, { CardHeader } from "@/components/ui/Card";
import Icon, { type IconName } from "@/components/ui/Icon";
import IconButton from "@/components/ui/IconButton";

/**
 * The shell every tracking module uses: a v2 Card with an icon tile,
 * sentence-case title, optional count / quiet right text, and a chevron
 * collapse button at the far right. Collapsed shows the header only.
 */
export default function ModuleCard({
  title,
  icon,
  count,
  right,
  action,
  collapsible = true,
  defaultCollapsed = false,
  collapsed,
  onToggleCollapse,
  children,
}: {
  title: string;
  icon: IconName;
  count?: React.ReactNode;
  right?: React.ReactNode;
  /** Extra header control shown before the collapse button. */
  action?: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  /** Controlled collapse state: when paired with `onToggleCollapse`, the caller
   *  owns persistence. Omit both to fall back to local state. */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const [localCollapsed, setLocalCollapsed] = useState(defaultCollapsed);
  const controlled = collapsed !== undefined && onToggleCollapse !== undefined;
  const isCollapsed = collapsible && (controlled ? collapsed : localCollapsed);
  const toggle = () => {
    if (controlled) onToggleCollapse();
    else setLocalCollapsed((v) => !v);
  };

  const headerAction = (
    <>
      {action}
      {collapsible ? (
        <IconButton
          icon="chev"
          label={`${isCollapsed ? "Expand" : "Collapse"} ${title}`}
          shape="tile"
          aria-expanded={!isCollapsed}
          onClick={toggle}
          className={`transition-transform duration-150 ${isCollapsed ? "" : "rotate-90"}`}
        />
      ) : null}
    </>
  );

  return (
    <Card aria-labelledby={titleId}>
      <CardHeader
        titleId={titleId}
        icon={<Icon name={icon} size={16} />}
        title={title}
        count={count}
        right={right}
        action={collapsible || action ? headerAction : undefined}
      />
      {isCollapsed ? <div className="pb-2" /> : <div className="px-4 pt-1 pb-4">{children}</div>}
    </Card>
  );
}
