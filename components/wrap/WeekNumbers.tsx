import Kpi from "@/components/ui/Kpi";
import { fmtHours } from "@/lib/format";
import type { WeekNumbers as Numbers } from "@/lib/wrap";

function nowrap(text: string) {
  return <span className="whitespace-nowrap">{text}</span>;
}

export default function WeekNumbers({ numbers }: { numbers: Numbers }) {
  const { done, focusedMinutes, accuracy } = numbers;
  return (
    <section aria-label="This week">
      <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 shell:grid-cols-3">
        <Kpi
          as="li"
          label="Done"
          value={nowrap(String(done))}
          unit={done === 1 ? "task" : "tasks"}
          foot={{ label: nowrap("Last 7 days"), value: "" }}
        />
        <Kpi
          as="li"
          label="Focused"
          value={nowrap(fmtHours(focusedMinutes))}
          foot={{ label: nowrap("Last 7 days"), value: "" }}
        />
        <Kpi
          as="li"
          label="Estimates"
          value={nowrap(accuracy === null ? "None" : `${accuracy}%`)}
          foot={{ label: nowrap("On target"), value: "" }}
        />
      </ul>
    </section>
  );
}
