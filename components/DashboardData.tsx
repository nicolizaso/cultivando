import Link from "next/link";
import { cookies } from "next/headers";
import { AlertTriangle, CalendarCheck, LayoutGrid, RefreshCw, Sprout, Warehouse } from "lucide-react";

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
import { dayRange, formatInAppTz, todayKey } from "@/app/lib/dates";
import { ONBOARDING_SKIPPED_COOKIE } from "@/app/lib/onboarding";
import { STRAIN_PLANT_COLUMNS, strainDurationIndex, strainStats } from "@/app/lib/strain-stats";
import { buildTaskTargetOptions } from "@/app/lib/task-targets";

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

/** Tope de atrasadas en el panel: el resto se ve en la agenda. */
const OVERDUE_LIMIT = 30;

const TASK_SELECT = '*, task_cycles(cycles(id, name)), task_plants(plants(id, name, cycle_id, cycles(id, name)))';

export default async function DashboardData({ user }: { user: { id: string } }) {
  const supabase = await createClient();
  const cookieStore = await cookies();

  // "Hoy" es el día en Argentina: el servidor corre en UTC y desde las 21:00
  // ya estaba en mañana.
  const today = todayKey();
  const { from: todayFrom, to: todayTo } = dayRange(today);

  const [
    { data: profile },
    { data: cyclesData },
    { data: todayData },
    { data: overdueData },
    { data: allSpaces },
    { data: strainPlants },
    { data: stockRows },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle(),
    // Ciclos activos con sus plantas (sin las archivadas) y la última foto.
    supabase
      .from('cycles')
      .select(`*, spaces (id, name, type), plants (*), cycle_images(public_url)`)
      .eq('is_active', true)
      .eq('plants.is_archived', false)
      .order('created_at', { ascending: true })
      .order('taken_at', { foreignTable: 'cycle_images', ascending: false })
      .limit(1, { foreignTable: 'cycle_images' }),
    // Las de hoy, hechas o no.
    supabase
      .from('tasks')
      .select(TASK_SELECT)
      .eq('user_id', user.id)
      .gte('due_date', todayFrom)
      .lt('due_date', todayTo)
      .order('due_date', { ascending: true }),
    // Las pendientes de días anteriores: antes desaparecían del panel al día
    // siguiente y nadie se enteraba de que no se habían hecho.
    supabase
      .from('tasks')
      .select(TASK_SELECT)
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .lt('due_date', todayFrom)
      .order('due_date', { ascending: true })
      .limit(OVERDUE_LIMIT),
    supabase
      .from('spaces')
      .select('id, name'),
    // Todas las plantas, con lo justo para saber cuánto dura cada etapa en
    // cada genética (el sugeridor usa esos promedios).
    supabase
      .from('plants')
      .select(STRAIN_PLANT_COLUMNS),
    // Productos con stock cargado, para avisar si queda poco.
    supabase
      .from('fertilizers')
      .select('id, name, stock_ml, low_stock_ml')
      .not('stock_ml', 'is', null)
      .not('low_stock_ml', 'is', null),
  ]);

  const username = profile?.username;

  const activeCycles = (cyclesData || []) as unknown as CycleWithPlantsAndSpace[];

  const todaysTasks = (todayData || []).map((t) => ({ ...t, ...mapTaskCycles(t) })) as unknown as Task[];
  const overdueTasks = (overdueData || []).map((t) => ({ ...t, ...mapTaskCycles(t) })) as unknown as Task[];

  const totalPlants = activeCycles.reduce((acc, cycle) => acc + (cycle.plants?.length || 0), 0);
  const totalCycles = activeCycles.length;

  const activeSpacesMap = new Map();
  activeCycles.forEach(c => {
    if (c.spaces) activeSpacesMap.set(c.spaces.id, c.spaces);
  });
  const activeSpacesCount = activeSpacesMap.size;
  // Opciones del modal de tareas, con los días en etapa para la dosis semanal.
  const taskTargets = buildTaskTargetOptions(activeCycles);

  const flatPlantsList: Plant[] = activeCycles.flatMap(c => c.plants || []);
  const strainDurations = strainDurationIndex(strainStats(strainPlants ?? []));

  const lowStock = (stockRows ?? []).filter((row) => Number(row.stock_ml) <= Number(row.low_stock_ml));

  const pendingToday = todaysTasks.filter(t => t.status === 'pending').length;
  const doneToday = todaysTasks.length - pendingToday;

  const todayLabel = formatInAppTz(new Date(), { weekday: 'long', day: 'numeric', month: 'long' });

  // El asistente es para quien recién llega: sin espacios todavía y sin
  // haberlo salteado. Antes salía también a quien tenía todo finalizado.
  const showOnboarding = (allSpaces || []).length === 0 && !cookieStore.has(ONBOARDING_SKIPPED_COOKIE);

  return (
    <>
      {showOnboarding && <OnboardingWizard />}

      <StageSuggester plants={flatPlantsList} durations={strainDurations} />

      <PageHeader
        title={username ? `Hola, ${username}` : 'Tu cultivo hoy'}
        subtitle={todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1)}
        actions={
          <CreateTaskAction
            plants={taskTargets.plants}
            spaces={allSpaces || []}
            cycles={taskTargets.cycles}
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

      {lowStock.length > 0 && (
        <Link
          href="/fertilizers"
          className="surface mb-6 flex items-start gap-3 rounded-[var(--radius-lg)] p-4 transition-colors hover:bg-surface-2"
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[color:var(--warning)]" aria-hidden="true" />
          <span className="text-sm text-fg">
            <span className="font-semibold">Queda poco stock: </span>
            {lowStock.map((row) => `${row.name} (${Number(row.stock_ml).toLocaleString('es-AR')} ml)`).join(', ')}.
            <span className="ml-1 font-semibold text-[color:var(--brand-text)]">Ver nutrición</span>
          </span>
        </Link>
      )}

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
              {overdueTasks.length > 0 && (
                <section aria-labelledby="tareas-atrasadas" className="mb-4">
                  <h3
                    id="tareas-atrasadas"
                    className="mb-2 flex items-center gap-2 text-xs font-bold text-[color:var(--danger)]"
                  >
                    Atrasadas
                    <span className="mono">{overdueTasks.length === OVERDUE_LIMIT ? `${OVERDUE_LIMIT}+` : overdueTasks.length}</span>
                  </h3>
                  <AgendaList tasks={overdueTasks} />
                </section>
              )}
              {overdueTasks.length > 0 && todaysTasks.length > 0 && (
                <h3 className="mb-2 text-xs font-bold text-fg-muted">Hoy</h3>
              )}
              {(todaysTasks.length > 0 || overdueTasks.length === 0) && (
                <AgendaList tasks={todaysTasks} emptyLabel="Nada pendiente para hoy" />
              )}
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
