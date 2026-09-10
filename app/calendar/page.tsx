import { createClient } from "@/app/lib/supabase-server";
import CalendarView from "@/components/CalendarView";
import PageShell from "@/components/layout/PageShell";
import { Plant } from "../lib/types";
import { mapTaskCycles } from "../lib/utils";

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
      .select(`*, spaces (id, name, type), plants (*, current_age_days, days_in_stage)`)
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
    supabase
      .from('spaces')
      .select('id, name')
  ]);

  // Process plants for the create-task action (extracted from active cycles)
  const cycles = (activeCycles || []) as unknown as CycleWithPlantsAndSpace[];
  const allPlantsMap = new Map<string, { id: string, name: string, space_id?: number }>();
  cycles.forEach(cycle => {
    cycle.plants?.forEach(p => {
      if (!allPlantsMap.has(String(p.id))) {
        allPlantsMap.set(String(p.id), { id: String(p.id), name: p.name, space_id: cycle.space_id });
      }
    });
  });
  const allPlants = Array.from(allPlantsMap.values());

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
        plants={allPlants}
        spaces={allSpaces || []}
        cycles={viewCycles}
      />
    </PageShell>
  );
}
