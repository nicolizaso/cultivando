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
    if (t.includes('riego')) return <Droplets size={14} className="text-[#00a599]" />;
    if (t === 'foto') return <Camera size={14} className="text-yellow-400" />;
    if (t.includes('etapa')) return <Rocket size={14} className="text-purple-400" />;
    if (t.includes('poda') || t.includes('defoliación') || t.includes('scissors')) return <Scissors size={14} className="text-muted" />;
    if (t.includes('fertilizante')) return <FlaskConical size={14} className="text-green-500" />;
    if (t.includes('repelente')) return <ShieldAlert size={14} className="text-orange-500" />;
    if (t.includes('trasplante')) return <Shovel size={14} className="text-amber-700" />;
    if (t.includes('entrenamiento')) return <Activity size={14} className="text-muted" />;
    if (t.includes('ambiente')) return <ArrowRightLeft size={14} className="text-muted" />;
    if (t.includes('lavado')) return <CloudRain size={14} className="text-muted" />;
    if (t.includes('cosechar')) return <Flower size={14} className="text-violet-500" />;
    if (t.includes('muerta')) return <Skull size={14} className="text-foreground" />;
    if (t.includes('otro')) return <PenTool size={14} className="text-muted" />;
    return <StickyNote size={14} className="text-muted" />;
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
    <div className="flex flex-col lg:flex-row gap-8">
      {/* CALENDARIO */}
      <div className="flex-1 bg-brand-card border border-card-border dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-title font-light text-brand-text capitalize">
            {format(currentDate, 'MMMM yyyy', { locale: es })}
          </h2>
          <div className="flex gap-2">
            <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-black/5 dark:hover:bg-card-border rounded-full text-brand-text"><ChevronLeft size={20} /></button>
            <button onClick={() => setCurrentDate(new Date())} className="text-xs font-bold uppercase text-brand-primary hover:underline px-2 font-body">Hoy</button>
            <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-black/5 dark:hover:bg-card-border rounded-full text-brand-text"><ChevronRight size={20} /></button>
          </div>
        </div>

        <div className="grid grid-cols-7 mb-2">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(day => (
            <div key={day} className="text-center text-[10px] font-bold text-brand-muted uppercase py-2">{day}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day) => {
            const dayEvents = allEvents.filter(event => isSameDay(event.date, day) && !event.hideInCalendar && (event.isTask || event.type === 'foto'));
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isToday = isSameDay(day, new Date());

            return (
              <div 
                key={day.toString()}
                onClick={() => onDateSelect(day)}
                className={`min-h-[80px] p-2 rounded-xl border cursor-pointer transition-all relative flex flex-col justify-between
                  ${!isCurrentMonth ? 'bg-transparent border-transparent opacity-20' : 'bg-brand-bg border-card-border dark:border-slate-800'}
                  ${isSelected ? 'ring-1 ring-brand-primary border-brand-primary z-10 bg-brand-card-hover' : 'hover:border-brand-primary/30'}
                `}
              >
                <div className={`text-[10px] font-bold mb-1 flex justify-between ${isToday ? 'text-brand-primary' : 'text-brand-muted'}`}>
                    <span>{format(day, 'd')}</span>
                    {isToday && <span className="w-1 h-1 rounded-full bg-brand-primary"></span>}
                </div>
                <div className="flex flex-wrap gap-1 content-start">
                  {dayEvents.slice(0, 4).map((event, i) => (
                    <span key={i} title={`${event.type}: ${event.title}`} className={`relative ${event.status === 'completed' ? 'opacity-50' : ''}`}>
                      {getIcon(event.type)}
                      {(event as any).isGroup && (
                        <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-brand-primary text-[7px] font-bold text-foreground">
                          {(event as any).count}
                        </span>
                      )}
                    </span>
                  ))}
                  {dayEvents.length > 4 && <span className="text-[8px] text-muted">+{dayEvents.length - 4}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* DETALLE LATERAL */}
      <div className="w-full lg:w-80 shrink-0">
        <div className="bg-brand-card border border-card-border dark:border-slate-800 rounded-2xl p-6 sticky top-6">
            <h3 className="text-xl font-title font-light text-brand-text mb-1 capitalize">
                {selectedDate ? format(selectedDate, 'EEEE d', { locale: es }) : 'Selecciona un día'}
            </h3>
            <div className="space-y-4 mt-6">
                {(() => {
                  const tasks = eventsForSelectedDate.filter(e => e.isTask);
                  if (tasks.length > 0) {
                    const mappedTasks: AppTask[] = tasks.map(e => ({
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
                      task_plants: e.plants // Mapped from task.task_plants in allEvents
                    }));
                    return <AgendaList tasks={mappedTasks} disableDateFilter={true} />;
                  }
                  return null;
                })()}

                {eventsForSelectedDate.filter(e => !e.isTask).length > 0 ? (
                    eventsForSelectedDate.filter(e => !e.isTask).map(event => {
                        const plantName = getPlantName(event.plants);
                        const isGroup = (event as any).isGroup;
                        const count = (event as any).count;

                        return (
                            <div key={event.id} className="bg-brand-bg border border-card-border dark:border-slate-800 p-3 rounded-xl hover:border-brand-primary/30 transition-colors">
                                <div className="flex justify-between items-start mb-1">
                                    <div className="flex items-center gap-2">
                                      <span>{getIcon(event.type)}</span>
                                      <span className="text-[9px] bg-brand-card text-brand-muted px-2 py-0.5 rounded uppercase font-bold">{event.type}</span>
                                    </div>
                                    {isGroup && (
                                       <span className="text-[9px] bg-brand-primary/20 text-brand-primary px-1.5 py-0.5 rounded font-bold">x{count}</span>
                                    )}
                                </div>
                                <h4 className="font-bold text-brand-text text-sm mb-1">{event.title} {isGroup && <span className="text-brand-muted font-normal">x{count} plantas</span>}</h4>
                                {plantName && (
                                    <p className="text-xs text-brand-primary mb-1 break-words leading-relaxed">🌿 {plantName}</p>
                                )}
                                {event.notes && <p className="text-xs text-brand-muted italic">"{event.notes}"</p>}
                            </div>
                        );
                    })
                ) : null}

                {eventsForSelectedDate.length === 0 && (
                    <div className="text-center py-8 text-brand-muted border border-dashed border-card-border dark:border-slate-800 rounded-xl">
                        <p className="text-sm">Sin eventos.</p>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}