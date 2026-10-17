import { createClient } from "@/app/lib/supabase-server";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin, PlayCircle, Sprout, StopCircle } from "lucide-react";

import CycleDetailView from "@/components/CycleDetailView";
import MoveCycleSpaceModal from "@/components/MoveCycleSpaceModal";
import PageShell from "@/components/layout/PageShell";
import PageHeader from "@/components/layout/PageHeader";
import { daysSince } from "@/app/lib/utils";
import { Space } from "@/app/lib/types";
import { parseId } from "@/app/lib/sanitize";
import { formatDay } from "@/app/lib/dates";

/** Cuántas mediciones se traen para el historial de clima. */
const HISTORY_SIZE = 30;

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
  ] = await Promise.all([
    supabase.from('cycles').select(`*, spaces ( name, type )`).eq('id', id).single(),
    supabase.from('plants').select('*').eq('cycle_id', id).order('id', { ascending: true }),
    // Destinos posibles para mudar el ciclo de espacio.
    supabase.from('spaces').select('id, name, type').order('name', { ascending: true }),
    // Las más recientes. Antes se pedían en orden ascendente con límite, o
    // sea las 20 más viejas: una medición nueva nunca entraba al historial.
    supabase.from('measurements').select('*').eq('cycle_id', id).order('date', { ascending: false }).order('created_at', { ascending: false }).limit(HISTORY_SIZE),
    supabase.from('cycle_images').select('*').eq('cycle_id', id).order('taken_at', { ascending: false }),
  ]);

  if (error || !cycle) return notFound();

  const lastMeasurement = recentMeasurements?.[0] ?? null;
  const history = [...(recentMeasurements ?? [])].reverse();

  const days = daysSince(cycle.start_date);

  const activePlants = (plants ?? []).filter(p => !p.is_archived);

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
      />
    </PageShell>
  );
}
