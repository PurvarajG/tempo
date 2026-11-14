import Ticks from "@/components/ui/Ticks";
import { fmtHours } from "@/lib/format";

export interface DayCapacityProps {
  plannedMinutes: number;
  ceilingMinutes: number;
  freeMinutes: number;
  overByMinutes: number;
  over: boolean;
  ratio: number; // 0..1
  provisional: boolean; // settings not loaded yet
  dayLabel: string; // e.g. "Tuesday", used in the meter's accessible name
}

/**
 * One day's capacity: "1h 35m of 6h" / "4h 25m free" over a tick bar.
 * Over capacity is the one allowed red (hi) state outside High priority, as in
 * the mockup: a full hi-tone tick bar plus "Over by ..." in hi. Otherwise the
 * bar is accent and the right side reads "X free".
 */
export default function DayCapacity({
  plannedMinutes,
  ceilingMinutes,
  freeMinutes,
  overByMinutes,
  over,
  ratio,
  provisional,
  dayLabel,
}: DayCapacityProps) {
  const planned = fmtHours(plannedMinutes);
  const value = provisional ? 0 : over ? 1 : ratio;
  const valueText = provisional
    ? `${planned} planned`
    : `${planned} of ${fmtHours(ceilingMinutes)}`;

  return (
    <div data-over={over && !provisional ? "true" : "false"}>
      <div className="flex justify-between text-meta text-ink-3">
        <span>
          <b className="font-mono font-medium text-ink">{planned}</b>
          {provisional ? " planned" : ` of ${fmtHours(ceilingMinutes)}`}
        </span>
        {provisional ? null : over ? (
          <span className="text-hi">
            Over by {fmtHours(overByMinutes)}
          </span>
        ) : (
          <span>{fmtHours(freeMinutes)} free</span>
        )}
      </div>
      <Ticks
        className="mt-2"
        size="sm"
        tone={over && !provisional ? "hi" : "accent"}
        value={value}
        label={`${dayLabel} capacity`}
        valueText={valueText}
      />
    </div>
  );
}
