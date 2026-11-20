import Link from "next/link";
import { CloudRain, Flower, Scissors } from "lucide-react";
import { addDaysToKey, dateKey, daysBetweenKeys, formatInAppTz } from "@/app/lib/dates";
import { STAGE_SHORT, stageWeekOn } from "@/app/lib/cycle-week";
import type { CycleWeekRef, WeekStage } from "@/app/lib/cycle-week";

interface StripTask {
  due_date: string | null;
  type: string | null;
}

interface CycleWeekStripProps {
  weekRef: CycleWeekRef;
  today: string;
  /** Tareas pendientes del ciclo. */
  tasks: StripTask[];
}

interface StripWeek {
  stage: WeekStage;
  week: number;
  from: string;
  /** Primer día que ya no es de esta semana. */
  to: string;
}

/** Más semanas de vege que esto se recortan desde el principio. */
const MAX_VEG_WEEKS = 16;

function buildWeeks(ref: CycleWeekRef, today: string): StripWeek[] {
  const weeks: StripWeek[] = [];
  const { vegStart, flowerStart } = ref;

  if (vegStart && (!flowerStart || vegStart < flowerStart)) {
    const vegEnd = flowerStart ?? addDaysToKey(vegStart, (Math.floor(Math.max(0, daysBetweenKeys(vegStart, today)) / 7) + 1) * 7);
    const count = Math.ceil(daysBetweenKeys(vegStart, vegEnd) / 7);
    for (let i = Math.max(0, count - MAX_VEG_WEEKS); i < count; i++) {
      const from = addDaysToKey(vegStart, i * 7);
      const next = addDaysToKey(from, 7);
      weeks.push({ stage: "Vegetativo", week: i + 1, from, to: next < vegEnd ? next : vegEnd });
    }
  }

  if (flowerStart) {
    const current = stageWeekOn(today, ref);
    const reached = current?.stage === "Floración" ? current.week : 0;
    const count = Math.max(ref.targetWeeks, reached);
    for (let i = 0; i < count; i++) {
      const from = addDaysToKey(flowerStart, i * 7);
      weeks.push({ stage: "Floración", week: i + 1, from, to: addDaysToKey(from, 7) });
    }
  }

  return weeks;
}

/**
 * Las semanas del ciclo en una tira: V1…Vn | F1…F8, con el hoy marcado, las
 * tareas pendientes de cada semana y los hitos (lavado, cosecha). Cada semana
 * abre la agenda en su primer día.
 */
export default function CycleWeekStrip({ weekRef, today, tasks }: CycleWeekStripProps) {
  const weeks = buildWeeks(weekRef, today);
  if (weeks.length === 0) return null;

  const days = tasks
    .map((task) => ({ day: dateKey(task.due_date), type: task.type }))
    .filter((task): task is { day: string; type: string | null } => Boolean(task.day));

  return (
    <section aria-labelledby="semanas-del-ciclo" className="surface mb-6 rounded-[var(--radius-lg)] p-4 sm:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="semanas-del-ciclo" className="section-title text-base">Semanas del ciclo</h2>
        {weekRef.flowerPlanned && (
          <p className="text-xs text-fg-subtle">Flora según el pase previsto</p>
        )}
      </div>

      <ol className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {weeks.map((week, index) => {
          const inWeek = days.filter((task) => task.day >= week.from && task.day < week.to);
          const isCurrent = today >= week.from && today < week.to;
          const isPast = week.to <= today;
          const isHarvestWeek = week.stage === "Floración" && week.week === weekRef.targetWeeks;
          const hasFlush = inWeek.some((task) => task.type === "lavado");
          const hasHarvestTask = inWeek.some((task) => task.type === "cosechar");
          const isStageStart = index > 0 && weeks[index - 1].stage !== week.stage;
          const overTarget = week.stage === "Floración" && week.week > weekRef.targetWeeks;

          return (
            <li key={`${week.stage}-${week.week}`} className={`shrink-0 ${isStageStart ? "ml-2 border-l border-line pl-2" : ""}`}>
              <Link
                href={`/calendar?mes=${week.from.slice(0, 7)}&dia=${week.from}`}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`${week.stage === "Floración" ? "Flora" : "Vege"} semana ${week.week}, desde el ${formatInAppTz(week.from, { day: "numeric", month: "long" })}${inWeek.length > 0 ? `, ${inWeek.length} tareas pendientes` : ""}${isCurrent ? ", semana actual" : ""}`}
                className={`flex min-h-[3.75rem] w-12 flex-col items-center justify-between rounded-[var(--radius-md)] border px-1 py-1.5 text-center transition-colors ${
                  isCurrent
                    ? "border-transparent bg-brand text-[color:var(--brand-fg)]"
                    : `border-line hover:border-line-strong ${isPast ? "bg-transparent text-fg-subtle" : "bg-surface-2 text-fg"} ${overTarget ? "border-dashed" : ""}`
                }`}
              >
                <span className="mono text-xs font-semibold">{STAGE_SHORT[week.stage]}{week.week}</span>
                <span className="flex h-3.5 items-center gap-0.5" aria-hidden="true">
                  {inWeek.length > 0 && <span className="mono text-[10px] font-semibold">{inWeek.length}</span>}
                  {hasFlush && <CloudRain className="h-3 w-3" />}
                  {(hasHarvestTask || (isHarvestWeek && !hasHarvestTask)) && (
                    hasHarvestTask ? <Scissors className="h-3 w-3" /> : <Flower className="h-3 w-3 opacity-70" />
                  )}
                </span>
                <span className={`mono text-[10px] ${isCurrent ? "" : "text-fg-muted"}`}>
                  {formatInAppTz(week.from, { day: "numeric", month: "numeric" })}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      <p className="mt-2 text-xs text-fg-subtle">
        Tocá una semana para verla en la agenda. El número es la cantidad de tareas pendientes; abajo, el día en que empieza.
      </p>
    </section>
  );
}
