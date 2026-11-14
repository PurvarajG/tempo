import type { Momentum } from "@/lib/momentum";
import Caption from "@/components/ui/Caption";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import Ticks from "@/components/ui/Ticks";
import { fmtDate } from "@/lib/format";

export default function MomentumCard({
  data,
  todayISO,
}: {
  data: Momentum;
  todayISO: string;
}) {
  return (
    <Card aria-labelledby="momentum-heading" clip>
      <div className="mom-glow rounded-t-card p-5">
        <div>
          <div className="flex items-center justify-between">
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-tab bg-mom-tile text-mom-glyph"
            >
              <Icon name="target" />
            </span>
            <Caption className="text-ink-2">{fmtDate(todayISO)}</Caption>
          </div>
          <h2
            id="momentum-heading"
            className="mt-18 font-moment text-moment text-ink"
          >
            Momentum
          </h2>
          <p className="mt-2 text-body leading-relaxed text-ink-2">{data.sentence}</p>
          <div className="mt-4 rounded-row bg-sunk p-4">
            <div className="flex items-center justify-between">
              <div>
                <b className="block text-body font-medium text-ink">Day progress</b>
                <span className="mt-1 block text-meta text-ink-3">
                  {data.done} of {data.total} tasks done
                </span>
              </div>
              <div className="text-big text-ink">{data.percent}%</div>
            </div>
            <Ticks
              value={data.percent / 100}
              label="Day progress"
              className="mt-3"
            />
          </div>
        </div>
      </div>
      <p className="px-4 py-3 text-secondary text-ink-3 shadow-hairline-top">
        {data.foot ?? "Nothing tracked yet today."}
      </p>
    </Card>
  );
}
