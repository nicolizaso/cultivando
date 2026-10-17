import { createClient } from "@/app/lib/supabase-server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarDays, FileText, MapPin, PlayCircle, Scissors, Sprout, StopCircle } from "lucide-react";

import CycleDetailView from "@/components/CycleDetailView";
import MoveCycleSpaceModal from "@/components/MoveCycleSpaceModal";
import PageShell from "@/components/layout/PageShell";
import PageHeader from "@/components/layout/PageHeader";
import { daysSince } from "@/app/lib/utils";
import { Space } from "@/app/lib/types";
import { parseId } from "@/app/lib/sanitize";
import { dateKey, formatDay, todayKey } from "@/app/lib/dates";
import { dominantStage, stagePeriods } from "@/app/lib/climate";
import { DEFAULT_FLOWER_DAYS, dominantStrain, estimateHarvest } from "@/app/lib/harvest";
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
  ]);

  if (error || !cycle) return notFound();

  const lastMeasurement = recentMeasurements?.[0] ?? null;
  const history = [...(recentMeasurements ?? [])].reverse();

  const days = daysSince(cycle.start_date);

  const activePlants = (plants ?? []).filter(p => !p.is_archived);

  const cycleStage = dominantStage(activePlants);
  const stageStart = stagePeriods(activePlants).find((period) => period.stage === cycleStage)?.from
    ?? activePlants
      .filter((plant) => plant.stage === cycleStage)
      .map((plant) => dateKey(plant.stage_updated_at))
      .filter((day): day is string => Boolean(day))
      .sort()[0]
    ?? null;
  const strain = dominantStrain(activePlants);
  const durations = strainDurationIndex(strainStats(strainPlants ?? []));
  const strainDurationsOfCycle = strainKey(strain) ? durations[strainKey(strain)!] : undefined;
  const averageDaysOf = (stage: 'Vegetativo' | 'Floración', fallback: number) => {
    const average = strainDurationsOfCycle?.[stage];
    return average && average.n >= MIN_SAMPLES ? average.avg : fallback;
  };

  // Cosecha estimada: sólo si el ciclo está en floración.
  const estimate = cycle.is_active && cycleStage === 'Floración'
    ? estimateHarvest({ flowerStart: stageStart, strain, durations, today: todayKey() })
    : null;

  return (
    <PageShell>
      <PageHeader
        title={cycle.name}
        backHref="/cycles"
        backLabel="Ciclos"
        subtitle={cycle.start_date ? `Arrancó el ${formatDay(cycle.start_date)}` : undefined}
      />

      {/* Resumen del ciclo. El nombre ya está en la cabecera, así que acá sólo
          van los datos: estado, ubicación y los dos números que se miran. */}
      <div className="surface mb-6 flex flex-wrap items-center gap-x-8 gap-y-5 rounded-[var(--radius-lg)] p-5">
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

          {estimate && (
            <span className="chip chip-brand" title={estimate.basis === 'strain' ? `Floración de ${estimate.flowerDays} días, el promedio de tu genética` : `Floración de ${estimate.flowerDays} días (sin historia de la genética)`}>
              <Scissors size={12} aria-hidden="true" />
              Cosecha estimada {formatDay(estimate.day)}
              {estimate.daysLeft > 0 ? ` · en ${estimate.daysLeft} días` : estimate.daysLeft === 0 ? ' · hoy' : ` · hace ${-estimate.daysLeft} días`}
            </span>
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
              defaultVegDays={averageDaysOf('Vegetativo', DEFAULT_VEG_DAYS)}
              defaultFlowerDays={averageDaysOf('Floración', DEFAULT_FLOWER_DAYS)}
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
            <dd className="metric mt-1 text-3xl text-fg">{days}</dd>
          </div>

          <div>
            <dt className="metric-label flex items-center gap-1.5">
              <Sprout size={13} aria-hidden="true" />
              Plantas activas
            </dt>
            <dd className="metric mt-1 text-3xl text-fg">
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
