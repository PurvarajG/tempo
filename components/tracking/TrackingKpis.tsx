import Kpi from "@/components/ui/Kpi";
import Spark from "@/components/ui/Spark";
import { fmtHours } from "@/lib/tracking-stats";

export type TrackingKpisProps = {
  thisWeek: number;
  lastWeek: number; // minutes
  dailyAverage: number;
  weekdays: number; // minutes, count of weekdays averaged
  accuracy: number | null;
  overByAvg: number; // percent or null, minutes
  sessions: number;
  longest: number; // count, minutes
  sparks: {
    week: number[];
    average: number[];
    accuracy: number[];
    sessions: number[];
  };
};

const nowrap = (text: string) => (
  <span className="whitespace-nowrap">{text}</span>
);

export default function TrackingKpis({
  thisWeek,
  lastWeek,
  dailyAverage,
  weekdays,
  accuracy,
  overByAvg,
  sessions,
  longest,
  sparks,
}: TrackingKpisProps) {
  const ahead = thisWeek > lastWeek;
  const weekDelta = ahead
    ? `+${fmtHours(thisWeek - lastWeek)}`
    : thisWeek === lastWeek
      ? lastWeek === 0
        ? "First week"
        : "Same"
      : `-${fmtHours(lastWeek - thisWeek)}`;

  return (
    <div className="grid grid-cols-2 gap-4 rail:grid-cols-4">
      <Kpi
        label="This week"
        value={nowrap(fmtHours(thisWeek))}
        visual={<Spark values={sparks.week} label="This week, last 12 days" />}
        foot={{
          label: nowrap("vs last week"),
          value: nowrap(weekDelta),
          tone: ahead ? "up" : "neutral",
        }}
      />
      <Kpi
        label="Daily average"
        value={nowrap(fmtHours(dailyAverage))}
        visual={
          <Spark values={sparks.average} label="Daily average, last 12 days" />
        }
        foot={{
          label: nowrap("Weekdays only"),
          value: nowrap(weekdays === 1 ? "1 day" : `${weekdays} days`),
        }}
      />
      <Kpi
        label="Plan accuracy"
        value={nowrap(accuracy === null ? "No estimates" : `${accuracy}%`)}
        visual={
          <Spark values={sparks.accuracy} label="Plan accuracy, last 12 days" />
        }
        foot={{
          label: nowrap("Estimates ran over"),
          value: nowrap(
            overByAvg > 0 ? `by ${fmtHours(overByAvg)} avg` : "Within estimate",
          ),
        }}
      />
      <Kpi
        label="Sessions"
        value={nowrap(String(sessions))}
        visual={<Spark values={sparks.sessions} label="Sessions, last 12 days" />}
        foot={{
          label: nowrap("Longest"),
          value: nowrap(fmtHours(longest)),
        }}
      />
    </div>
  );
}
