"use client";

import { useState } from "react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, addMonths, subMonths, parseISO
} from "date-fns";
import { es } from "date-fns/locale";
import { CalendarOff, ChevronLeft, ChevronRight } from "lucide-react";
import AgendaList from "@/components/AgendaList";
import { getTaskType } from "@/app/lib/constants";
import { Task as AppTask } from "@/app/lib/types";

interface Log {
  id: number;
  created_at: string;
  type: string;
  title: string;
  notes?: string;
  plants?: any; // Usamos any temporalmente para manejar la inconsistencia de array/objeto
}

interface GroupedLog extends Log {
  isGroup?: boolean;
  count?: number;
}

interface WidgetTask {
  id: number | string;
  created_at?: string;
  due_date: string;
  date?: string; // Fallback date
  type: string;
  title: string;
  description?: string;
  status?: 'pending' | 'completed';
  plants?: any;
  task_plants?: any[];
  recurrence_id?: string;
  cycleName?: string;
  cycleNames?: string;
  cycleIds?: number[];
}

interface CalendarWidgetProps {
  logs: Log[];
  tasks: WidgetTask[];
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

// Helper para agrupar logs
const groupLogs = (logs: Log[]): GroupedLog[] => {
  const groups: Record<string, Log[]> = {};

  logs.forEach(log => {
      // Key: Type + Title + Minute (ignore seconds)
      const dateKey = log.created_at.substring(0, 16); // YYYY-MM-DDTHH:mm
      const key = `${log.type}-${log.title}-${dateKey}`;

      if (!groups[key]) groups[key] = [];
      groups[key].push(log);
  });

  return Object.values(groups).map(group => {
      if (group.length === 1) return group[0];

      const first = group[0];
      // Collect all plants from the group
      const allPlants = group.map(g => {
        if (Array.isArray(g.plants)) return g.plants;
        if (g.plants) return [g.plants];
        return [];
      }).flat();

      return {
          ...first,
          isGroup: true,
          count: group.length,
          id: -first.id, // Use negative ID to avoid conflicts or just distinct
          // Combine plants for display
          plants: allPlants
      } as GroupedLog;
  });
}

/** Icono del evento, con el color que le toca a su tipo en la taxonomía. */
function EventIcon({ type, className = "h-3.5 w-3.5" }: { type: string; className?: string }) {
  const taskType = getTaskType(type);
  const Icon = taskType.icon;
  return <Icon className={`${className} ${taskType.color}`} aria-hidden="true" />;
}

const getPlantName = (plants: any) => {
  if (!plants) return null;

  // Si es un array (caso task_plants o logs con múltiples plantas)
  if (Array.isArray(plants)) {
    if (plants.length === 0) return null;

    // Caso nueva estructura: task_plants con objeto anidado 'plants'
    if (plants[0].plants) {
      return plants.map((p: any) => p.plants?.name).filter(Boolean).join(', ');
    }

    // Caso legacy o simple array de plantas
    return plants.map((p: any) => p.name || p).filter(Boolean).join(', ');
  }

  // Caso objeto simple
  if (typeof plants === 'object') return plants.name;

  return null;
};

export default function CalendarWidget({ logs, tasks, selectedDate, onDateSelect }: CalendarWidgetProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  // Unificar eventos (con agrupación de logs, filtrando solo los de tipo foto)
  const groupedLogs = groupLogs(logs.filter(log => log.type === 'foto'));

  const allEvents = [
    ...groupedLogs.map(log => ({
      id: log.isGroup ? `group-${log.id}` : `log-${log.id}`,
      originalId: log.id,
      date: parseISO(log.created_at),
      type: log.type,
      title: log.title,
      notes: log.notes,
      plants: log.plants,
      isTask: false,
      status: undefined,
      recurrence_id: undefined,
      isGroup: log.isGroup,
      count: log.count,
    })),
    ...tasks.map(task => ({
      id: `task-${task.id}`,
      originalId: task.id,
      date: parseISO(task.due_date || task.date!),
      type: task.type,
      title: task.title,
      notes: task.description,
      plants: task.task_plants || task.plants,
      isTask: true,
      status: task.status,
      recurrence_id: task.recurrence_id,
      cycleName: task.cycleName,
      cycleNames: task.cycleNames,
      cycleIds: task.cycleIds,
    }))
  ];

  const eventsForSelectedDate = allEvents.filter(event => selectedDate && isSameDay(event.date, selectedDate));
  const dayTasks = eventsForSelectedDate.filter(e => e.isTask);
  const dayLogs = eventsForSelectedDate.filter(e => !e.isTask);

  const mappedDayTasks: AppTask[] = dayTasks.map(e => ({
    id: String(e.originalId),
    title: e.title,
    due_date: e.date.toISOString(),
    status: e.status || 'pending',
    type: e.type,
    cycleName: (e as any).cycleName,
    cycleNames: (e as any).cycleNames,
    cycleIds: (e as any).cycleIds,
    completed: e.status === 'completed',
    description: e.notes,
    recurrence_id: e.recurrence_id,
    task_plants: e.plants,
  }));

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-6">
      <div className="surface min-w-0 flex-1 rounded-[var(--radius-lg)] p-3 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="section-title text-lg capitalize">
            {format(currentDate, 'MMMM yyyy', { locale: es })}
          </h2>

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="btn-icon btn-icon-sm"
              aria-label="Mes anterior"
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => { setCurrentDate(new Date()); onDateSelect(new Date()); }}
              className="btn btn-sm btn-ghost"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="btn-icon btn-icon-sm"
              aria-label="Mes siguiente"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="mb-1 grid grid-cols-7" aria-hidden="true">
          {[['Lun', 'L'], ['Mar', 'M'], ['Mié', 'X'], ['Jue', 'J'], ['Vie', 'V'], ['Sáb', 'S'], ['Dom', 'D']].map(([long, short]) => (
            <div key={long} className="py-1.5 text-center text-[11px] font-semibold text-fg-subtle">
              <span className="hidden sm:inline">{long}</span>
              <span className="sm:hidden">{short}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {calendarDays.map((day) => {
            const dayEvents = allEvents.filter(event => isSameDay(event.date, day));
            const pending = dayEvents.filter(e => e.isTask && e.status !== 'completed').length;
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isToday = isSameDay(day, new Date());

            return (
              /* Cada día es un botón: antes era un div con onClick y el
                 calendario entero quedaba fuera del alcance del teclado. */
              <button
                type="button"
                key={day.toString()}
                onClick={() => onDateSelect(day)}
                aria-pressed={isSelected}
                aria-current={isToday ? 'date' : undefined}
                aria-label={`${format(day, "d 'de' MMMM", { locale: es })}${
                  dayEvents.length > 0
                    ? `, ${dayEvents.length} evento${dayEvents.length === 1 ? '' : 's'}${pending > 0 ? `, ${pending} pendiente${pending === 1 ? '' : 's'}` : ''}`
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
                  {format(day, 'd')}
                </span>

                <span className="flex flex-wrap content-start gap-1">
                  {dayEvents.slice(0, 3).map((event, i) => (
                    <span key={i} className={`relative ${event.status === 'completed' ? 'opacity-60' : ''}`}>
                      <EventIcon type={event.type} className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      {(event as any).isGroup && (
                        <span className="mono absolute -right-1.5 -top-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-brand text-[7px] font-bold text-[color:var(--brand-fg)]">
                          {(event as any).count}
                        </span>
                      )}
                    </span>
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="mono text-[9px] text-fg-subtle">+{dayEvents.length - 3}</span>
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
            {selectedDate ? format(selectedDate, "EEEE d", { locale: es }) : 'Elegí un día'}
          </h3>
          <p className="mb-4 text-xs text-fg-muted">
            {selectedDate && format(selectedDate, "d 'de' MMMM 'de' yyyy", { locale: es })}
          </p>

          <div className="space-y-4">
            {dayTasks.length > 0 && <AgendaList tasks={mappedDayTasks} disableDateFilter={true} />}

            {dayLogs.map(event => {
              const plantName = getPlantName(event.plants);
              const isGroup = (event as any).isGroup;
              const count = (event as any).count;

              return (
                <article key={event.id} className="rounded-[var(--radius-md)] border border-line bg-surface-2 p-3">
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <span className="chip chip-neutral">
                      <EventIcon type={event.type} className="h-3 w-3" />
                      {event.type}
                    </span>
                    {isGroup && <span className="chip chip-brand mono">x{count}</span>}
                  </div>

                  <h4 className="text-sm font-semibold text-fg">{event.title}</h4>
                  {plantName && <p className="mt-1 break-words text-xs text-[color:var(--brand-text)]">{plantName}</p>}
                  {event.notes && <p className="mt-1 text-xs text-fg-muted">{event.notes}</p>}
                </article>
              );
            })}

            {eventsForSelectedDate.length === 0 && (
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
