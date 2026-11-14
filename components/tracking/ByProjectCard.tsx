import Card, { CardHeader } from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import { fmtHours, type ProjectMinutes } from "@/lib/tracking-stats";
import { projectColorVar } from "@/lib/types";

export type ByProjectCardProps = {
  rows: ProjectMinutes[];
  rightLabel: string;
  insight: { projectName: string; tracked: number; planned: number } | null;
};

const MAX_ROWS = 5;

export default function ByProjectCard({ rows, rightLabel, insight }: ByProjectCardProps) {
  const shown = rows.slice(0, MAX_ROWS);
  const more = rows.length - shown.length;
  const largest = Math.max(1, ...shown.map((r) => r.minutes));

  return (
    <Card className="h-full">
      <CardHeader
        title="By project"
        icon={<Icon name="folder" size={16} />}
        right={rightLabel}
      />
      {rows.length === 0 ? (
        <p className="px-5 pt-1 pb-5 text-body text-ink-3">No time on projects yet.</p>
      ) : (
        <div className="flex flex-col gap-4 px-5 pt-1 pb-5">
          {shown.map(({ project, minutes }) => {
            const color = project ? projectColorVar(project.color) : "var(--color-ink-3)";
            return (
              <div
                key={project?.id ?? "none"}
                data-testid="by-project-row"
                className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-body"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-4.5 shrink-0 rounded-check"
                    style={{ background: color }}
                  />
                  <span className="truncate">{project?.name ?? "No project"}</span>
                </span>
                <b className="font-mono text-secondary font-medium">{fmtHours(minutes)}</b>
                <div className="col-span-full h-2 overflow-hidden rounded-sm bg-off">
                  <div
                    data-testid="by-project-bar"
                    className="h-full rounded-sm"
                    style={{ width: `${(minutes / largest) * 100}%`, background: color }}
                  />
                </div>
              </div>
            );
          })}
          {more > 0 ? <p className="text-meta text-ink-3">And {more} more</p> : null}
        </div>
      )}
      {insight ? (
        <div className="mx-5 mb-5 flex gap-2 rounded-row bg-sunk p-3 text-secondary text-ink-2">
          <Icon name="target" size={16} className="shrink-0 text-accent" />
          <span>
            {`${insight.projectName} got ${fmtHours(insight.tracked)} of the ${fmtHours(insight.planned)} you planned for it this week.`}
          </span>
        </div>
      ) : null}
    </Card>
  );
}
