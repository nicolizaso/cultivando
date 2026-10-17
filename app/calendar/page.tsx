import { createClient } from "@/app/lib/supabase-server";
import CalendarView from "@/components/CalendarView";
import PageShell from "@/components/layout/PageShell";
import { Plant } from "../lib/types";
import { mapTaskCycles } from "../lib/utils";
import { buildTaskTargetOptions } from "../lib/task-targets";

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

export default async function CalendarPage() {
  const supabase = await createClient();

  // Parallel fetch of all needed data
  const [
    { data: logs },
    { data: tasks },
    { data: activeCycles },
    { data: allSpaces }
  ] = await Promise.all([
    supabase
      .from('logs')
      .select(`*, plants ( name )`)
      .order('created_at', { ascending: true }),
    supabase
      .from('tasks')
      .select(`*, task_cycles(cycles(id, name)), task_plants(plants(id, name, cycle_id, cycles(id, name)))`)
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

  const viewCycles = cycles.map(c => ({ id: c.id, name: c.name, space_id: c.space_id }));
  const mappedTasks = (tasks || []).map((t: any) => {
    const { cycleIds, cycleNames } = mapTaskCycles(t, viewCycles);

    return {
      ...t,
      cycleIds,
      cycleNames
    };
  });

  return (
    <PageShell>
      <CalendarView
        logs={logs || []}
        tasks={mappedTasks}
        plants={taskTargets.plants}
        spaces={allSpaces || []}
        cycles={taskTargets.cycles}
      />
    </PageShell>
  );
}
