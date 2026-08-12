"use client";

import { useState } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  Droplets, Camera, StickyNote, Rocket, Scissors, ChevronLeft, ChevronRight,
  FlaskConical, ShieldAlert, Shovel, Activity, ArrowRightLeft, CloudRain, Flower, Skull, PenTool
} from "lucide-react";
import AgendaList from "@/components/AgendaList";
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
      hideInCalendar: false
    })),
    ...tasks.map(task => {
      const hasPlants = (task.task_plants && task.task_plants.length > 0) ||
                        (Array.isArray(task.plants) ? task.plants.length > 0 : !!task.plants);
      return {
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
        hideInCalendar: false
      };
    })
  ];

  const eventsForSelectedDate = allEvents.filter(event => selectedDate && isSameDay(event.date, selectedDate));

  const getIcon = (type: string) => {
    const t = type.toLowerCase();
    const cls = "h-3.5 w-3.5";
    if (t.includes('riego')) return <Droplets className={`${cls} text-sky-700 dark:text-sky-300`} aria-hidden="true" />;
    if (t === 'foto') return <Camera className={`${cls} text-amber-700 dark:text-amber-300`} aria-hidden="true" />;
    if (t.includes('etapa')) return <Rocket className={`${cls} text-purple-700 dark:text-purple-300`} aria-hidden="true" />;
    if (t.includes('poda') || t.includes('defoliación') || t.includes('scissors')) return <Scissors className={`${cls} text-slate-700 dark:text-slate-300`} aria-hidden="true" />;
    if (t.includes('fertilizante')) return <FlaskConical className={`${cls} text-emerald-700 dark:text-emerald-300`} aria-hidden="true" />;
    if (t.includes('repelente')) return <ShieldAlert className={`${cls} text-orange-700 dark:text-orange-300`} aria-hidden="true" />;
    if (t.includes('trasplante')) return <Shovel className={`${cls} text-amber-700 dark:text-amber-300`} aria-hidden="true" />;
    if (t.includes('entrenamiento')) return <Activity className={`${cls} text-teal-700 dark:text-teal-300`} aria-hidden="true" />;
    if (t.includes('ambiente')) return <ArrowRightLeft className={`${cls} text-indigo-700 dark:text-indigo-300`} aria-hidden="true" />;
    if (t.includes('lavado')) return <CloudRain className={`${cls} text-cyan-700 dark:text-cyan-300`} aria-hidden="true" />;
    if (t.includes('cosechar')) return <Flower className={`${cls} text-violet-700 dark:text-violet-300`} aria-hidden="true" />;
    if (t.includes('muerta')) return <Skull className={`${cls} text-rose-700 dark:text-rose-300`} aria-hidden="true" />;
    if (t.includes('otro')) return <PenTool className={`${cls} text-stone-700 dark:text-stone-300`} aria-hidden="true" />;
    return <StickyNote className={`${cls} text-fg-muted`} aria-hidden="true" />;
  };

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

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
      <div className="surface flex-1 rounded-[var(--radius-lg)] p-4 md:p-6">
        <div className="mb-5 flex items-center justify-between gap-2">
          <h2 className="font-title text-lg font-semibold capitalize tracking-tight text-fg">
            {format(currentDate, 'MMMM yyyy', { locale: es })}
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="btn-icon h-10 min-h-10 w-10 min-w-10"
              aria-label="Mes anterior"
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentDate(new Date())}
              className="btn btn-ghost h-10 min-h-10 px-3 text-xs"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="btn-icon h-10 min-h-10 w-10 min-w-10"
              aria-label="Mes siguiente"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="mb-1 grid grid-cols-7" aria-hidden="true">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day, i) => (
            <div key={i} className="py-2 text-center text-[11px] font-bold uppercase text-fg-subtle">{day}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day) => {
            const dayEvents = allEvents.filter(event => isSameDay(event.date, day) && !event.hideInCalendar && (event.isTask || event.type === 'foto'));
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
                  dayEvents.length > 0 ? `, ${dayEvents.length} eventos` : ', sin eventos'
                }`}
                className={`flex min-h-[74px] flex-col justify-between rounded-[var(--radius-md)] border p-2 text-left transition-colors ${
                  !isCurrentMonth ? 'border-transparent bg-transparent opacity-40' : 'border-line bg-surface-2'
                } ${
                  isSelected
                    ? 'border-[color:var(--brand)] ring-1 ring-[color:var(--brand)]'
                    : 'hover:border-line-strong'
                }`}
              >
                <span
                  className={`flex items-center justify-between text-xs font-semibold ${
                    isToday ? 'text-[color:var(--brand-text)]' : 'text-fg-muted'
                  }`}
                >
                  {format(day, 'd')}
                  {isToday && <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />}
                </span>

                <span className="flex flex-wrap content-start gap-1">
                  {dayEvents.slice(0, 4).map((event, i) => (
                    <span key={i} className={`relative ${event.status === 'completed' ? 'opacity-50' : ''}`}>
                      {getIcon(event.type)}
                      {(event as any).isGroup && (
                        <span className="absolute -right-1.5 -top-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-brand text-[7px] font-bold text-[color:var(--brand-fg)]">
                          {(event as any).count}
                        </span>
                      )}
                    </span>
                  ))}
                  {dayEvents.length > 4 && (
                    <span className="text-[9px] text-fg-subtle">+{dayEvents.length - 4}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="w-full shrink-0 lg:w-80">
        <div className="surface sticky top-24 rounded-[var(--radius-lg)] p-5">
          <h3 className="mb-4 font-title text-lg font-semibold capitalize tracking-tight text-fg">
            {selectedDate ? format(selectedDate, "EEEE d 'de' MMMM", { locale: es }) : 'Elegí un día'}
          </h3>

          <div className="space-y-4">
            {(() => {
              const dayTasks = eventsForSelectedDate.filter(e => e.isTask);
              if (dayTasks.length > 0) {
                const mappedTasks: AppTask[] = dayTasks.map(e => ({
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
                  task_plants: e.plants
                }));
                return <AgendaList tasks={mappedTasks} disableDateFilter={true} />;
              }
              return null;
            })()}

            {eventsForSelectedDate.filter(e => !e.isTask).map(event => {
              const plantName = getPlantName(event.plants);
              const isGroup = (event as any).isGroup;
              const count = (event as any).count;

              return (
                <article key={event.id} className="rounded-[var(--radius-md)] border border-line bg-surface-2 p-3">
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <span className="chip border-line bg-surface-3 text-fg-muted">
                      {getIcon(event.type)}
                      {event.type}
                    </span>
                    {isGroup && (
                      <span className="chip border-[color:color-mix(in_srgb,var(--brand)_35%,transparent)] bg-brand-soft text-[color:var(--brand-text)]">
                        x{count}
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-semibold text-fg">{event.title}</h4>
                  {plantName && <p className="mt-1 break-words text-xs text-[color:var(--brand-text)]">{plantName}</p>}
                  {event.notes && <p className="mt-1 text-xs text-fg-muted">{event.notes}</p>}
                </article>
              );
            })}

            {eventsForSelectedDate.length === 0 && (
              <p className="rounded-[var(--radius-md)] border border-dashed border-line-strong py-8 text-center text-sm text-fg-muted">
                Sin eventos este día.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
