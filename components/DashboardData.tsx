import Link from "next/link";
import { CalendarCheck, LayoutGrid, RefreshCw, Sprout, Warehouse } from "lucide-react";

import OnboardingWizard from "./OnboardingWizard";
import { createClient } from "@/app/lib/supabase-server";
import PageHeader from "@/components/layout/PageHeader";
import CreateTaskAction from "@/components/CreateTaskAction";
import AgendaList from "@/components/AgendaList";
import TaskManagerModal from "@/components/TaskManagerModal";
import CycleStatusCard from "@/components/CycleStatusCard";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/EmptyState";
import StageSuggester from "@/components/StageSuggester";
import { Plant, Task } from "@/app/lib/types";
import { daysSince, mapTaskCycles } from "@/app/lib/utils";

interface SpaceInfo { id: number; name: string; type: string; }
interface CycleWithPlantsAndSpace {
    id: number;
    name: string;
    start_date: string;
    space_id: number;
    plants: Plant[];
    spaces: SpaceInfo;
    cycle_images?: { public_url: string }[];
}

export default async function DashboardData({ user }: { user: { id: string } }) {
  const supabase = await createClient();

  // Get yesterday's date to ensure we catch tasks regardless of timezone shifts
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString('en-CA');

  // Parallel fetch of all independent dashboard data
  const [
    { data: profile },
    { data: cyclesData },
    { data: tasksData },
    { data: allSpaces }
  ] = await Promise.all([
    // Profile info
    supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single(),
    // Active cycles with plants and spaces info
    supabase
      .from('cycles')
      .select(`*, spaces (id, name, type), plants (*, current_age_days, days_in_stage), cycle_images(public_url)`)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .order('taken_at', { foreignTable: 'cycle_images', ascending: false })
      .limit(1, { foreignTable: 'cycle_images' }),
    // Tasks
    supabase
      .from('tasks')
      .select('*, task_cycles(cycles(id, name)), task_plants(plants(id, name, cycle_id, cycles(id, name)))')
      .eq('user_id', user.id)
      .gte('due_date', yesterdayStr)
      .order('created_at', { ascending: true }),
    // All available spaces for the UI
    supabase
      .from('spaces')
      .select('id, name')
  ]);

  const username = profile?.username;

  const activeCycles = (cyclesData || []) as unknown as CycleWithPlantsAndSpace[];
  const mappedCyclesList = activeCycles.map(c => ({ id: c.id, name: c.name, space_id: c.space_id }));

  const allTodayTasks = (tasksData || []).map((t: Task) => {
    const { cycleIds, cycleNames } = mapTaskCycles(t, mappedCyclesList);
    return {
      ...t,
      cycleIds,
      cycleNames
    };
  }) as Task[];

  // Procesamiento
  const totalPlants = activeCycles.reduce((acc, cycle) => acc + (cycle.plants?.length || 0), 0);
  const totalCycles = activeCycles.length;

  const activeSpacesMap = new Map();
  activeCycles.forEach(c => {
    if (c.spaces) activeSpacesMap.set(c.spaces.id, c.spaces);
  });
  const activeSpacesCount = activeSpacesMap.size;
  const allPlants: { id: string, name: string, space_id?: number }[] = [];
  activeCycles.forEach(cycle => {
    cycle.plants?.forEach(p => {
      allPlants.push({ id: String(p.id), name: p.name, space_id: cycle.space_id });
    });
  });

  const flatPlantsList: Plant[] = activeCycles.flatMap(c => c.plants || []);

  // Recuento del día: la fecha se compara en local para no desplazarse de huso.
  const todayStr = new Date().toLocaleDateString('en-CA');
  const todaysTasks = allTodayTasks.filter(t => t.due_date && t.due_date.split('T')[0] === todayStr);
  const pendingToday = todaysTasks.filter(t => t.status === 'pending').length;
  const doneToday = todaysTasks.length - pendingToday;

  const todayLabel = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <>
      {activeSpacesCount === 0 && totalCycles === 0 && <OnboardingWizard />}

      <StageSuggester plants={flatPlantsList} />

      <PageHeader
        title={username ? `Hola, ${username}` : 'Tu cultivo hoy'}
        subtitle={todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1)}
        actions={
          <CreateTaskAction
            plants={allPlants}
            spaces={allSpaces || []}
            cycles={mappedCyclesList}
          />
        }
      />

      {/* Resumen: cuatro indicadores del mismo tipo, los cuatro navegables. */}
      <div className="stagger mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:mb-10 lg:grid-cols-4">
        <div style={{ ['--i' as string]: 0 }}>
          <StatCard
            label="Tareas de hoy"
            value={pendingToday}
            icon={CalendarCheck}
            href="/calendar"
            tone="brand"
            hint={
              pendingToday === 0
                ? todaysTasks.length > 0 ? 'Todo hecho' : 'Nada agendado'
                : `${doneToday} ya hechas`
            }
          />
        </div>

        <div style={{ ['--i' as string]: 1 }}>
          <StatCard
            label="Ciclos activos"
            value={totalCycles}
            icon={RefreshCw}
            href="/cycles"
            hint={totalCycles === 0 ? 'Empezá el primero' : 'Ver historial'}
          />
        </div>

        <div style={{ ['--i' as string]: 2 }}>
          <StatCard
            label="Plantas en curso"
            value={totalPlants}
            icon={Sprout}
            href="/plants"
            hint={totalPlants === 0 ? 'Sin plantas cargadas' : 'Ver inventario'}
          />
        </div>

        <div style={{ ['--i' as string]: 3 }}>
          <StatCard
            label="Espacios"
            value={(allSpaces || []).length}
            icon={Warehouse}
            href="/spaces"
            hint={activeSpacesCount > 0 ? `${activeSpacesCount} en uso` : 'Ninguno en uso'}
          />
        </div>
      </div>

      {/* --- FEED PRINCIPAL --- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
        <section aria-labelledby="cultivo-activo" className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 id="cultivo-activo" className="section-title">Cultivo activo</h2>
            {activeCycles.length > 0 && (
              <Link
                href="/cycles"
                className="text-sm font-semibold text-fg-muted transition-colors hover:text-fg"
              >
                Ver todos
              </Link>
            )}
          </div>

          {activeCycles.length > 0 ? (
            <div className={activeCycles.length > 2 ? "grid grid-cols-1 gap-4 xl:grid-cols-2" : "space-y-4"}>
              {activeCycles.map((cycle) => (
                <CycleStatusCard
                  key={cycle.id}
                  cycle={cycle}
                  days={daysSince(cycle.start_date)}
                  isCompact={activeCycles.length > 2}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={LayoutGrid}
              title="Todavía no hay nada creciendo"
              description="Un ciclo agrupa las plantas que cultivás juntas en un espacio. Creá el primero y el panel se llena solo."
              action={<Link href="/cycles" className="btn btn-primary">Iniciar un ciclo</Link>}
            />
          )}
        </section>

        <section aria-labelledby="tareas-hoy" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 id="tareas-hoy" className="section-title">Tareas de hoy</h2>
            <TaskManagerModal />
          </div>

          <div className="surface flex flex-col rounded-[var(--radius-lg)]">
            <div className="custom-scrollbar max-h-[26rem] min-h-[12rem] flex-1 overflow-y-auto p-3">
              <AgendaList tasks={allTodayTasks} />
            </div>

            <Link
              href="/calendar"
              className="border-t border-line px-4 py-3 text-center text-sm font-semibold text-[color:var(--brand-text)] transition-colors hover:bg-surface-2"
            >
              Abrir la agenda
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
