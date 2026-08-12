import OnboardingWizard from "./OnboardingWizard";
import { createClient } from "@/app/lib/supabase-server";
import Link from "next/link";
import DashboardFab from "@/components/DashboardFab";
import HomeTaskCard from "@/components/HomeTaskCard";
import AgendaList from "@/components/AgendaList";
import TaskManagerModal from "@/components/TaskManagerModal";
import CycleStatusCard from "@/components/CycleStatusCard";
import { Plant, Task } from "@/app/lib/types";
import { Leaf, RefreshCw, Warehouse, Plus, ArrowRight } from "lucide-react";
import Logo from "@/components/Logo";
import StageSuggester from "@/components/StageSuggester";
import { mapTaskCycles } from "@/app/lib/utils";

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

  return (
    <>
      {activeSpacesCount === 0 && totalCycles === 0 && <OnboardingWizard />}

      <StageSuggester plants={flatPlantsList} />

      {username && (
        <div className="mb-8">
          <p className="font-title text-2xl font-semibold tracking-tight text-fg md:text-3xl">
            Hola, {username}
          </p>
          <p className="mt-1 text-sm capitalize text-fg-muted">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      )}

      {/* Resumen: cuatro indicadores, tres de ellos navegables */}
      <div className="stagger mb-10 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div style={{ ['--i' as string]: 0 }}>
          <HomeTaskCard tasks={allTodayTasks} />
        </div>

        <div style={{ ['--i' as string]: 1 }} className="h-full">
          {totalCycles > 0 ? (
            <Link href="/cycles" className="surface-interactive group flex h-full flex-col justify-between rounded-[var(--radius-lg)] p-5">
              <p className="mb-3 text-xs font-semibold text-fg-muted">Ciclos en curso</p>
              <div className="flex items-end justify-between gap-2">
                <span className="font-title text-4xl font-semibold leading-none text-fg">{totalCycles}</span>
                <RefreshCw
                  className="h-7 w-7 shrink-0 text-[color:var(--info)] transition-transform duration-700 group-hover:rotate-180"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </div>
            </Link>
          ) : (
            <Link href="/cycles" className="surface-interactive group flex h-full flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] p-5 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-[color:var(--brand-text)] transition-transform group-hover:scale-105">
                <Plus size={22} strokeWidth={2.5} aria-hidden="true" />
              </span>
              <p className="text-xs leading-snug text-fg-muted">
                Sin ciclos activos.
                <span className="mt-0.5 block font-semibold text-[color:var(--brand-text)]">Iniciá uno acá</span>
              </p>
            </Link>
          )}
        </div>

        <div style={{ ['--i' as string]: 2 }} className="surface flex h-full flex-col justify-between rounded-[var(--radius-lg)] p-5">
          <p className="mb-3 text-xs font-semibold text-fg-muted">Plantas activas</p>
          <div className="flex items-end justify-between gap-2">
            <span className="font-title text-4xl font-semibold leading-none text-fg">{totalPlants}</span>
            <Leaf
              className="h-7 w-7 shrink-0 text-[color:var(--brand-text)]"
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </div>
        </div>

        <div style={{ ['--i' as string]: 3 }} className="h-full">
          <Link href="/spaces" className="surface-interactive group flex h-full flex-col justify-between rounded-[var(--radius-lg)] p-5">
            <p className="mb-3 text-xs font-semibold text-fg-muted">Mis espacios</p>
            <div className="flex items-end justify-between gap-2">
              <span className="font-title text-4xl font-semibold leading-none text-fg">{activeSpacesCount}</span>
              <Warehouse
                className="h-7 w-7 shrink-0 text-fg-muted transition-colors group-hover:text-fg"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </div>
          </Link>
        </div>
      </div>

      {/* --- FEED PRINCIPAL --- */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <section aria-labelledby="cultivo-activo" className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 id="cultivo-activo" className="font-title text-lg font-semibold text-fg">
              Cultivo activo
            </h2>
            <Link
              href="/cycles"
              className="flex items-center gap-1 text-sm font-semibold text-fg-muted transition-colors hover:text-fg"
            >
              Ver todos
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          {activeCycles.length > 0 ? (
            <div className={activeCycles.length > 3 ? "grid grid-cols-1 gap-4 md:grid-cols-2" : "space-y-4"}>
              {activeCycles.map((cycle) => (
                <CycleStatusCard
                  key={cycle.id}
                  cycle={cycle}
                  isCompact={activeCycles.length > 3}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-line-strong bg-surface p-10 text-center">
              <Logo className="mb-4 h-10 w-10 text-fg-subtle" aria-hidden="true" />
              <p className="mb-4 text-sm text-fg-muted">No hay ciclos activos en este momento.</p>
              <Link href="/cycles" className="btn btn-primary">Iniciar un nuevo ciclo</Link>
            </div>
          )}
        </section>

        <section aria-labelledby="agenda" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id="agenda" className="font-title text-lg font-semibold text-fg">Agenda</h2>
            <TaskManagerModal />
          </div>
          <div className="custom-scrollbar surface h-80 overflow-y-auto rounded-[var(--radius-lg)] p-4">
            <AgendaList tasks={allTodayTasks} />
          </div>
        </section>
      </div>

      <DashboardFab
        plants={allPlants}
        spaces={allSpaces || []}
        cycles={mappedCyclesList}
      />
    </>
  );
}
