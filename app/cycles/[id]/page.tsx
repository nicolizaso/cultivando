import { createClient } from "@/app/lib/supabase-server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarDays, FileText, MapPin, PlayCircle, Sprout, StopCircle } from "lucide-react";

import CycleDetailView from "@/components/CycleDetailView";
import MoveCycleSpaceModal from "@/components/MoveCycleSpaceModal";
import PageShell from "@/components/layout/PageShell";
import PageHeader from "@/components/layout/PageHeader";
import { daysSince } from "@/app/lib/utils";
import { Space } from "@/app/lib/types";
import { parseId } from "@/app/lib/sanitize";
import { formatDay, todayKey } from "@/app/lib/dates";
import { dominantStrain } from "@/app/lib/harvest";
import { cycleTimeline, cycleWeekRef, timelineText } from "@/app/lib/cycle-week";
import CycleWeekSummary from "@/components/CycleWeekSummary";
import CycleWeekStrip from "@/components/CycleWeekStrip";
import CycleTargetModal from "@/components/CycleTargetModal";
import { DEFAULT_VEG_DAYS } from "@/app/lib/grow-plan";
import { MIN_SAMPLES, STRAIN_PLANT_COLUMNS, strainDurationIndex, strainKey, strainStats } from "@/app/lib/strain-stats";
import GrowPlanModal from "@/components/GrowPlanModal";
import ShareCycleButton from "@/components/ShareCycleButton";
import CycleHarvestSection from "@/components/CycleHarvestSection";

/** Cuántas mediciones se traen para el historial de clima (unos tres meses). */
const HISTORY_SIZE = 120;

/** Tope de registros con foto para el timelapse. */
const PHOTO_LIMIT = 400;

export default async function CycleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (!id) return notFound();

  // Todo en paralelo: antes eran seis consultas una detrás de otra.
  const [
    { data: cycle, error },
    { data: plants },
    { data: spaces },
    { data: recentMeasurements },
    { data: cycleImages },
    { data: plantPhotoLogs },
    { data: cyclePhotoLogs },
    { data: harvests },
    { data: strainPlants },
    { count: pendingPlanTasks },
    { data: cycleTasks },
    { data: plantTasks },
  ] = await Promise.all([
    supabase.from('cycles').select(`*, spaces ( name, type, area_m2, width, length, light_watts )`).eq('id', id).single(),
    supabase.from('plants').select('*').eq('cycle_id', id).order('id', { ascending: true }),
    // Destinos posibles para mudar el ciclo de espacio.
    supabase.from('spaces').select('id, name, type').order('name', { ascending: true }),
    // Las más recientes. Antes se pedían en orden ascendente con límite, o
    // sea las 20 más viejas: una medición nueva nunca entraba al historial.
    supabase.from('measurements').select('*').eq('cycle_id', id).order('date', { ascending: false }).order('created_at', { ascending: false }).limit(HISTORY_SIZE),
    supabase.from('cycle_images').select('*').eq('cycle_id', id).order('taken_at', { ascending: false }),
    // Para el timelapse: las fotos de la bitácora de las plantas del ciclo y
    // las del ciclo mismo.
    supabase
      .from('logs')
      .select('id, plant_id, created_at, media_url, title, plants!inner ( cycle_id )')
      .eq('plants.cycle_id', id)
      .not('media_url', 'is', null)
      .order('created_at', { ascending: true })
      .limit(PHOTO_LIMIT),
    supabase
      .from('logs')
      .select('id, plant_id, created_at, media_url, title')
      .eq('cycle_id', id)
      .not('media_url', 'is', null)
      .order('created_at', { ascending: true })
      .limit(PHOTO_LIMIT),
    supabase.from('harvests').select('plant_id, cycle_id, harvested_on, dried_on, wet_g, dry_g, rating, notes').eq('cycle_id', id),
    // Para estimar la cosecha con los días de floración de la genética.
    supabase.from('plants').select(STRAIN_PLANT_COLUMNS),
    // Tareas pendientes de un plan de cultivo de este ciclo.
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .eq('metadata->>plan_cycle_id', String(id)),
    // Pendientes del ciclo (o de sus plantas), para la tira de semanas.
    supabase
      .from('tasks')
      .select('id, due_date, type, task_cycles!inner(cycle_id)')
      .eq('status', 'pending')
      .eq('task_cycles.cycle_id', id),
    supabase
      .from('tasks')
      .select('id, due_date, type, task_plants!inner(plants!inner(cycle_id))')
      .eq('status', 'pending')
      .eq('task_plants.plants.cycle_id', id),
  ]);

  if (error || !cycle) return notFound();

  const lastMeasurement = recentMeasurements?.[0] ?? null;
  const history = [...(recentMeasurements ?? [])].reverse();

  const days = daysSince(cycle.start_date);

  const activePlants = (plants ?? []).filter(p => !p.is_archived);

  const today = todayKey();
  const weekRef = cycleWeekRef(activePlants, cycle);
  const timeline = cycleTimeline(weekRef, today);
  const cycleStage = weekRef.stage;
  const stageStart = weekRef.stageStart;

  const strain = dominantStrain(activePlants);
  const durations = strainDurationIndex(strainStats(strainPlants ?? []));
  const strainDurationsOfCycle = strainKey(strain) ? durations[strainKey(strain)!] : undefined;
  const strainAverage = (stage: 'Vegetativo' | 'Floración') => {
    const average = strainDurationsOfCycle?.[stage];
    return average && average.n >= MIN_SAMPLES ? average.avg : null;
  };
  const strainFlowerDays = strainAverage('Floración');
  const strainFlowerWeeks = strainFlowerDays ? Math.round((strainFlowerDays / 7) * 10) / 10 : null;

  // Las pendientes, sin repetir las que apuntan al ciclo y a sus plantas.
  const pendingById = new Map<string, { due_date: string | null; type: string | null }>();
  for (const task of [...(cycleTasks ?? []), ...(plantTasks ?? [])]) {
    pendingById.set(String(task.id), { due_date: task.due_date, type: task.type });
  }

  return (
    <PageShell>
      <PageHeader
        title={cycle.name}
        backHref="/cycles"
        backLabel="Ciclos"
        subtitle={cycle.start_date ? `Arrancó el ${formatDay(cycle.start_date)}` : undefined}
      />

      {/* Resumen del ciclo. Lo primero es en qué semana de etapa está hoy:
          es lo que se viene a mirar. Después, estado, ubicación y acciones. */}
      <div className="surface mb-6 flex flex-wrap items-center gap-x-8 gap-y-5 rounded-[var(--radius-lg)] p-5">
        {cycle.is_active && (
          <div className="w-full">
            <p className="metric-label mb-1">Hoy</p>
            <CycleWeekSummary text={timelineText(timeline, today)} size="lg" />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className={`chip ${cycle.is_active ? 'chip-brand' : 'chip-neutral'}`}>
            {cycle.is_active
              ? <PlayCircle size={12} aria-hidden="true" />
              : <StopCircle size={12} aria-hidden="true" />}
            {cycle.is_active ? 'En curso' : 'Finalizado'}
          </span>

          <span className="chip chip-neutral">
            <MapPin size={12} aria-hidden="true" />
            {cycle.spaces?.name || 'Sin espacio'}
            {cycle.spaces?.type ? ` · ${cycle.spaces.type}` : ''}
          </span>

          {cycle.is_active && (
            <CycleTargetModal
              cycleId={cycle.id}
              targetWeeks={weekRef.targetWeeks}
              plannedFlowerStart={cycle.planned_flower_start ?? null}
              flowerStarted={Boolean(weekRef.flowerStart && !weekRef.flowerPlanned)}
              strainFlowerWeeks={strainFlowerWeeks}
            />
          )}

          <Link href={`/cycles/${cycle.id}/reporte`} className="btn btn-sm btn-ghost">
            <FileText size={15} aria-hidden="true" />
            Reporte
          </Link>
          <ShareCycleButton cycleId={cycle.id} cycleName={cycle.name} />

          {cycle.is_active && activePlants.length > 0 && (
            <GrowPlanModal
              cycleId={cycle.id}
              stage={cycleStage}
              stageStart={stageStart}
              defaultVegDays={strainAverage('Vegetativo') ?? DEFAULT_VEG_DAYS}
              defaultFlowerWeeks={weekRef.targetWeeks}
              pendingPlanTasks={pendingPlanTasks ?? 0}
            />
          )}

          <MoveCycleSpaceModal
            cycleId={cycle.id}
            currentSpaceId={cycle.space_id ?? null}
            spaces={(spaces ?? []) as Pick<Space, 'id' | 'name' | 'type'>[]}
            plantCount={activePlants.length}
          />
        </div>

        <dl className="flex flex-wrap items-end gap-x-8 gap-y-4 sm:ml-auto">
          <div>
            <dt className="metric-label flex items-center gap-1.5">
              <CalendarDays size={13} aria-hidden="true" />
              Día de cultivo
            </dt>
            <dd className="metric mt-1 text-xl text-fg">{days}</dd>
          </div>

          <div>
            <dt className="metric-label flex items-center gap-1.5">
              <Sprout size={13} aria-hidden="true" />
              Plantas activas
            </dt>
            <dd className="metric mt-1 text-xl text-fg">
              {activePlants.length}
              {activePlants.length !== (plants?.length ?? 0) && (
                <span className="ml-1.5 text-sm font-medium text-fg-subtle">
                  de {plants?.length ?? 0}
                </span>
              )}
            </dd>
          </div>
        </dl>
      </div>

      {cycle.is_active && (
        <CycleWeekStrip weekRef={weekRef} today={today} tasks={Array.from(pendingById.values())} />
      )}

      <CycleDetailView
        cycle={cycle}
        plants={plants || []}
        lastMeasurement={lastMeasurement}
        history={history || []}
        cycleImages={cycleImages || []}
        photoLogs={[...(plantPhotoLogs ?? []), ...(cyclePhotoLogs ?? [])].map(({ id, plant_id, created_at, media_url, title }) => ({ id, plant_id, created_at, media_url, title }))}
      />

      <div className="mt-8">
        <CycleHarvestSection
          cycleId={cycle.id}
          plants={(plants ?? []).map(({ id, name, stage, is_archived }) => ({ id, name, stage, is_archived }))}
          harvests={harvests ?? []}
          space={cycle.spaces ?? null}
        />
      </div>
    </PageShell>
  );
}
