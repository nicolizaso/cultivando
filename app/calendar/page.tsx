import { createClient } from "@/app/lib/supabase-server";
import CalendarView from "@/components/CalendarView";
import PageShell from "@/components/layout/PageShell";
import { Plant, Task } from "../lib/types";
import { mapTaskCycles } from "../lib/utils";
import { buildTaskTargetOptions } from "../lib/task-targets";
import { addDaysToKey, todayKey } from "../lib/dates";

export const dynamic = 'force-dynamic';
export const metadata = { title: "Agenda" };

interface CycleWithPlantsAndSpace {
  id: number;
  name: string;
  start_date: string;
  space_id: number;
  plants: Plant[];
  spaces: { id: number, name: string };
}

const MONTH_PARAM = /^\d{4}-\d{2}$/;

const TASK_SELECT = `*, task_cycles(cycles(id, name)), task_plants(plants(id, name, cycle_id, cycles(id, name)))`;

/** Primer y último día de la grilla de un mes ("YYYY-MM"), con una semana de margen. */
function monthRange(month: string): { from: string; to: string } {
  const [year, monthNumber] = month.split('-').map(Number);
  const first = `${month}-01`;
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const last = `${month}-${String(lastDay).padStart(2, '0')}`;
  return { from: addDaysToKey(first, -7), to: addDaysToKey(last, 8) };
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ mes?: string; dia?: string }> }) {
  const supabase = await createClient();
  const { mes, dia } = await searchParams;

  // Se trae sólo el mes que se mira (con margen para los días de los meses
  // vecinos que entran en la grilla). Antes se traía toda la historia: cada
  // registro y cada tarea desde el primer día, en cada visita.
  const month = mes && MONTH_PARAM.test(mes) ? mes : todayKey().slice(0, 7);
  const { from, to } = monthRange(month);

  const [
    { data: logs },
    { data: monthTasks },
    { data: pendingTasks },
    { data: activeCycles },
    { data: allSpaces }
  ] = await Promise.all([
    supabase
      .from('logs')
      .select(`*, plants ( name )`)
      .gte('created_at', `${from}T00:00:00-03:00`)
      .lt('created_at', `${to}T00:00:00-03:00`)
      .order('created_at', { ascending: true }),
    supabase
      .from('tasks')
      .select(TASK_SELECT)
      .gte('due_date', `${from}T00:00:00-03:00`)
      .lt('due_date', `${to}T00:00:00-03:00`)
      .order('due_date', { ascending: true }),
    // Para "Todas las tareas": lo pendiente de cualquier fecha.
    supabase
      .from('tasks')
      .select(TASK_SELECT)
      .eq('status', 'pending')
      .order('due_date', { ascending: true }),
    supabase
      .from('cycles')
      .select(`*, spaces (id, name, type), plants (*)`)
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
    supabase
      .from('spaces')
      .select('id, name')
  ]);

  // Opciones del modal de tareas, con los días en etapa para la dosis semanal.
  const cycles = (activeCycles || []) as unknown as CycleWithPlantsAndSpace[];
  const taskTargets = buildTaskTargetOptions(cycles);

  const withCycles = (t: Task) => ({ ...t, ...mapTaskCycles(t) });

  const tasksById = new Map<string, Task>();
  for (const task of [...(monthTasks ?? []), ...(pendingTasks ?? [])] as Task[]) {
    tasksById.set(String(task.id), withCycles(task));
  }

  return (
    <PageShell>
      {/* La key reinicia el día elegido al cambiar de mes. */}
      <CalendarView
        key={month}
        month={month}
        initialSelectedDay={dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : undefined}
        logs={logs || []}
        tasks={Array.from(tasksById.values())}
        plants={taskTargets.plants}
        spaces={allSpaces || []}
        cycles={taskTargets.cycles}
      />
    </PageShell>
  );
}
