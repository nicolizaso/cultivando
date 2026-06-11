import { createClient } from "@/app/lib/supabase-server";
import Link from "next/link";
import DashboardFab from "@/components/DashboardFab";
import HomeTaskCard from "@/components/HomeTaskCard";
import AgendaList from "@/components/AgendaList";
import TaskManagerModal from "@/components/TaskManagerModal";
import CycleStatusCard from "@/components/CycleStatusCard";
import { Plant, Task } from "@/app/lib/types";
import { Leaf, RefreshCw, Warehouse, Sprout, Plus, ArrowRight } from "lucide-react";
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
      <StageSuggester plants={flatPlantsList} />

      {username && (
        <div className="mb-8 animate-in slide-in-from-top-2 duration-500">
            <h1 className="text-2xl md:text-3xl font-title font-light text-foreground tracking-wide uppercase">
              Hola, <span className="font-bold text-brand-primary">{username}</span>
            </h1>
            <p className="text-muted text-sm mt-1 font-body capitalize">
              {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
        </div>
      )}

      {/* KPIs Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">

        <HomeTaskCard tasks={allTodayTasks} />

        {totalCycles > 0 ? (
          <Link href="/cycles" className="bg-card p-5 rounded-2xl border border-card-border hover:border-brand-primary/30 transition-colors group flex flex-col justify-between">
            <p className="text-[10px] uppercase tracking-widest text-muted font-bold mb-2 font-body">Ciclos en Curso</p>
            <div className="flex items-end justify-between">
              <span className="text-4xl font-title font-light text-foreground group-hover:text-brand-primary transition-colors">{totalCycles}</span>
              <RefreshCw className="text-blue-500 w-8 h-8 opacity-80 group-hover:rotate-180 transition-transform duration-700" strokeWidth={1.5} />
            </div>
          </Link>
        ) : (
          <Link href="/cycles" className="bg-card p-5 rounded-2xl border border-card-border hover:border-brand-primary/30 transition-colors group flex flex-col justify-center items-center text-center relative">
             <div className="bg-brand-primary/10 p-3 rounded-full mb-2 text-brand-primary group-hover:scale-110 transition-transform">
                <Plus size={24} strokeWidth={2.5} />
             </div>
             <p className="text-xs text-muted leading-tight font-body">
                No tenés ningún ciclo activo.<br/>
                <span className="text-brand-primary font-bold">Iniciá uno presionando acá</span>
             </p>
          </Link>
        )}

        <div className="bg-card p-5 rounded-2xl border border-card-border hover:border-brand-primary/30 transition-colors group">
          <p className="text-[10px] uppercase tracking-widest text-muted font-bold mb-2 font-body">Plantas Activas</p>
          <div className="flex items-end justify-between">
            <span className="text-4xl font-title font-light text-foreground group-hover:text-brand-primary transition-colors">{totalPlants}</span>
            <Leaf className="text-brand-primary w-8 h-8 opacity-80 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
          </div>
        </div>

        <Link href="/spaces" className="bg-card p-5 rounded-2xl border border-card-border hover:bg-card-border transition-all cursor-pointer group">
          <p className="text-[10px] uppercase tracking-widest text-muted font-bold mb-2 font-body">Mis Espacios</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-4xl font-title font-light text-foreground group-hover:text-brand-primary transition-colors">
              {activeSpacesCount}
            </span>
            <Warehouse className="text-muted w-8 h-8 group-hover:text-foreground transition-colors" strokeWidth={1.5} />
          </div>
        </Link>
      </div>

      {/* --- FEED PRINCIPAL --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-medium font-title text-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-primary animate-pulse"></span>
              Laboratorio Activo
            </h2>
            <Link href="/cycles" className="text-xs text-muted hover:text-foreground transition-colors uppercase font-bold tracking-wide font-body flex items-center gap-1">
              Ver Todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {activeCycles.length > 0 ? (
            activeCycles.map((cycle) => (
              <CycleStatusCard key={cycle.id} cycle={cycle} />
            ))
          ) : (
            <div className="bg-card rounded-2xl p-10 text-center border border-dashed border-card-border flex flex-col items-center justify-center">
              <Sprout className="w-12 h-12 text-muted mb-4 opacity-50" />
              <p className="text-muted mb-4 font-body">No hay ciclos activos en este momento.</p>
              <Link href="/cycles" className="text-brand-primary hover:underline font-body font-bold bg-brand-primary/10 px-4 py-2 rounded-lg">Iniciar un nuevo ciclo</Link>
            </div>
          )}
        </div>

        {/* Agenda Placeholder */}
        <div className="space-y-6">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-medium text-foreground font-title">Agenda</h2>
            <TaskManagerModal />
          </div>
          <div className="bg-card rounded-2xl p-4 border border-card-border h-80 overflow-y-auto custom-scrollbar">
             <AgendaList tasks={allTodayTasks} />
          </div>
        </div>
      </div>

      <DashboardFab
        plants={allPlants}
        spaces={allSpaces || []}
        cycles={mappedCyclesList}
      />
    </>
  );
}
