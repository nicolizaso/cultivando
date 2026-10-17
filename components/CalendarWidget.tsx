"use client";

import { useMemo } from "react";
import Image from "next/image";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarOff, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import AgendaList from "@/components/AgendaList";
import { getTaskType } from "@/app/lib/constants";
import { canonicalLogType } from "@/app/lib/logs";
import { addDaysToKey, dateKey, daysBetweenKeys, todayKey } from "@/app/lib/dates";
import { Task } from "@/app/lib/types";

/** Un registro de la bitácora tal como llega de la página. */
export interface CalendarLog {
  id: number;
  created_at: string | null;
  type: string;
  title: string | null;
  notes?: string | null;
  cycle_id?: number | null;
  media_url?: string[] | null;
  plants?: { name: string } | { name: string }[] | null;
}

/** Varios registros iguales en el mismo minuto (un riego en lote) se muestran como uno. */
interface LogEvent {
  key: string;
  type: string;
  title: string;
  notes: string | null;
  plantNames: string[];
  count: number;
  media: string | null;
}

interface DayEvents {
  tasks: Task[];
  logs: LogEvent[];
}

interface CalendarWidgetProps {
  /** El mes que se muestra, "YYYY-MM". */
  month: string;
  logs: CalendarLog[];
  tasks: Task[];
  selectedDay: string;
  onDaySelect: (day: string) => void;
  onMonthChange: (month: string) => void;
  isLoading?: boolean;
}

const WEEK_DAYS = [['Lun', 'L'], ['Mar', 'M'], ['Mié', 'X'], ['Jue', 'J'], ['Vie', 'V'], ['Sáb', 'S'], ['Dom', 'D']];

function plantNamesOf(plants: CalendarLog['plants']): string[] {
  if (!plants) return [];
  return (Array.isArray(plants) ? plants : [plants]).map((plant) => plant?.name).filter((name): name is string => Boolean(name));
}

/** "2026-10" → "2026-11" (o "2026-09" con delta -1). */
function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

/** Los días de la grilla: de lunes a domingo, cubriendo el mes entero. */
function gridDays(month: string): string[] {
  const first = `${month}-01`;
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const last = `${month}-${String(lastDay).padStart(2, '0')}`;
  // getUTCDay: 0 = domingo. La grilla empieza el lunes.
  const startOffset = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const endOffset = 6 - ((new Date(`${last}T12:00:00Z`).getUTCDay() + 6) % 7);
  const start = addDaysToKey(first, -startOffset);
  const total = daysBetweenKeys(start, addDaysToKey(last, endOffset)) + 1;
  return Array.from({ length: total }, (_, i) => addDaysToKey(start, i));
}

/** Un día "YYYY-MM-DD" como Date al mediodía, para formatear con date-fns. */
function asDate(day: string): Date {
  return new Date(`${day}T12:00:00`);
}

/** Icono del evento, con el color que le toca a su tipo en la taxonomía. */
function EventIcon({ type, className = "h-3.5 w-3.5" }: { type: string; className?: string }) {
  const taskType = getTaskType(type);
  const Icon = taskType.icon;
  return <Icon className={`${className} ${taskType.color}`} aria-hidden="true" />;
}

export default function CalendarWidget({
  month,
  logs,
  tasks,
  selectedDay,
  onDaySelect,
  onMonthChange,
  isLoading = false,
}: CalendarWidgetProps) {
  const days = useMemo(() => gridDays(month), [month]);
  const today = todayKey();

  /**
   * Los eventos agrupados por día una sola vez. Antes cada una de las ~42
   * celdas recorría todos los eventos en cada render; ahora es una búsqueda
   * por clave. Los días se cuentan en hora de Argentina.
   */
  const eventsByDay = useMemo(() => {
    const map = new Map<string, DayEvents>();
    const bucket = (day: string) => {
      let entry = map.get(day);
      if (!entry) {
        entry = { tasks: [], logs: [] };
        map.set(day, entry);
      }
      return entry;
    };

    for (const task of tasks) {
      const day = dateKey(task.due_date);
      if (day) bucket(day).tasks.push(task);
    }

    // Toda la bitácora, no sólo las fotos: riegos, notas y cambios de etapa
    // también son parte del día.
    const groups = new Map<string, LogEvent & { day: string }>();
    for (const log of logs) {
      const day = dateKey(log.created_at);
      if (!day) continue;
      const type = canonicalLogType(log.type) || 'log';
      const title = log.title || getTaskType(type).label;
      const key = `${type}|${title}|${(log.created_at ?? '').slice(0, 16)}`;
      const existing = groups.get(key);
      if (existing) {
        existing.count += 1;
        existing.plantNames.push(...plantNamesOf(log.plants));
      } else {
        groups.set(key, {
          key: `log-${log.id}`,
          day,
          type,
          title,
          notes: log.notes ?? null,
          plantNames: plantNamesOf(log.plants),
          count: 1,
          media: log.media_url?.[0] ?? null,
        });
      }
    }
    for (const event of groups.values()) bucket(event.day).logs.push(event);

    return map;
  }, [tasks, logs]);

  const selected = eventsByDay.get(selectedDay) ?? { tasks: [], logs: [] };

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-6">
      <div className="surface min-w-0 flex-1 rounded-[var(--radius-lg)] p-3 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="section-title flex items-center gap-2 text-lg capitalize">
            {format(asDate(`${month}-01`), 'MMMM yyyy', { locale: es })}
            {isLoading && <Loader2 size={16} className="animate-spin text-fg-muted" aria-label="Cargando" />}
          </h2>

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onMonthChange(shiftMonth(month, -1))}
              className="btn-icon btn-icon-sm"
              aria-label="Mes anterior"
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onDaySelect(today)}
              className="btn btn-sm btn-ghost"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => onMonthChange(shiftMonth(month, 1))}
              className="btn-icon btn-icon-sm"
              aria-label="Mes siguiente"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="mb-1 grid grid-cols-7" aria-hidden="true">
          {WEEK_DAYS.map(([long, short]) => (
            <div key={long} className="py-1.5 text-center text-[11px] font-semibold text-fg-subtle">
              <span className="hidden sm:inline">{long}</span>
              <span className="sm:hidden">{short}</span>
            </div>
          ))}
        </div>

        <div className={`grid grid-cols-7 gap-1 transition-opacity sm:gap-1.5 ${isLoading ? 'opacity-60' : ''}`}>
          {days.map((day) => {
            const events = eventsByDay.get(day);
            const icons = [
              ...(events?.tasks ?? []).map((task) => ({ type: task.type || 'otro', done: task.status === 'completed', count: 1 })),
              ...(events?.logs ?? []).map((log) => ({ type: log.type, done: false, count: log.count })),
            ];
            const total = icons.length;
            const pending = (events?.tasks ?? []).filter((task) => task.status !== 'completed').length;
            const isCurrentMonth = day.startsWith(month);
            const isSelected = day === selectedDay;
            const isToday = day === today;

            return (
              /* Cada día es un botón: antes era un div con onClick y el
                 calendario entero quedaba fuera del alcance del teclado. */
              <button
                type="button"
                key={day}
                onClick={() => onDaySelect(day)}
                aria-pressed={isSelected}
                aria-current={isToday ? 'date' : undefined}
                aria-label={`${format(asDate(day), "d 'de' MMMM", { locale: es })}${
                  total > 0
                    ? `, ${total} evento${total === 1 ? '' : 's'}${pending > 0 ? `, ${pending} pendiente${pending === 1 ? '' : 's'}` : ''}`
                    : ', sin eventos'
                }`}
                className={`flex min-h-[62px] flex-col gap-1 rounded-[var(--radius-md)] border p-1.5 text-left transition-colors sm:min-h-[78px] sm:p-2 ${
                  !isCurrentMonth
                    ? 'border-transparent bg-transparent'
                    : 'border-line bg-surface-2 hover:border-line-strong'
                } ${
                  isSelected ? 'border-[color:var(--brand)] ring-1 ring-[color:var(--brand)]' : ''
                }`}
              >
                <span
                  className={`mono flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                    isToday
                      ? 'bg-brand text-[color:var(--brand-fg)]'
                      : isCurrentMonth
                        ? 'text-fg-muted'
                        : 'text-fg-subtle'
                  }`}
                >
                  {Number(day.slice(8))}
                </span>

                <span className="flex flex-wrap content-start gap-1">
                  {icons.slice(0, 3).map((icon, i) => (
                    <span key={i} className={`relative ${icon.done ? 'opacity-60' : ''}`}>
                      <EventIcon type={icon.type} className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      {icon.count > 1 && (
                        <span className="mono absolute -right-1.5 -top-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-brand text-[7px] font-bold text-[color:var(--brand-fg)]">
                          {icon.count}
                        </span>
                      )}
                    </span>
                  ))}
                  {total > 3 && (
                    <span className="mono text-[9px] text-fg-subtle">+{total - 3}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detalle del día. En escritorio queda fijo bajo la barra superior. */}
      <div className="w-full shrink-0 lg:w-[340px]">
        <div className="surface rounded-[var(--radius-lg)] p-4 sm:p-5 lg:sticky lg:top-20">
          <h3 className="section-title mb-1 capitalize">
            {format(asDate(selectedDay), "EEEE d", { locale: es })}
          </h3>
          <p className="mb-4 text-xs text-fg-muted">
            {format(asDate(selectedDay), "d 'de' MMMM 'de' yyyy", { locale: es })}
          </p>

          <div className="space-y-4">
            {/* Las tareas llegan completas: editarlas desde acá ya no pisa la
                etapa de destino ni el tipo de aplicación con valores por defecto. */}
            {selected.tasks.length > 0 && <AgendaList tasks={selected.tasks} disableDateFilter={true} />}

            {selected.logs.map(event => (
              <article key={event.key} className="rounded-[var(--radius-md)] border border-line bg-surface-2 p-3">
                <div className="mb-1.5 flex items-start justify-between gap-2">
                  <span className="chip chip-neutral">
                    <EventIcon type={event.type} className="h-3 w-3" />
                    {getTaskType(event.type).label}
                  </span>
                  {event.count > 1 && <span className="chip chip-brand mono">x{event.count}</span>}
                </div>

                <h4 className="text-sm font-semibold text-fg">{event.title}</h4>
                {event.plantNames.length > 0 && (
                  <p className="mt-1 break-words text-xs text-[color:var(--brand-text)]">{event.plantNames.join(', ')}</p>
                )}
                {event.notes && <p className="mt-1 whitespace-pre-line text-xs text-fg-muted">{event.notes}</p>}
                {event.media && (
                  <div className="relative mt-2 h-28 w-full overflow-hidden rounded-[var(--radius-md)] border border-line">
                    <Image src={event.media} alt={`Foto: ${event.title}`} fill sizes="320px" className="object-cover" />
                  </div>
                )}
              </article>
            ))}

            {selected.tasks.length === 0 && selected.logs.length === 0 && (
              <div className="flex flex-col items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-line-strong py-8 text-center">
                <CalendarOff className="h-6 w-6 text-fg-subtle" aria-hidden="true" />
                <p className="text-sm text-fg-muted">Sin eventos este día</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
