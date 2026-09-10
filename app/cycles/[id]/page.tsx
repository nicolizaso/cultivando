import { createClient } from "@/app/lib/supabase-server";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin, PlayCircle, Sprout, StopCircle } from "lucide-react";

import CycleDetailView from "@/components/CycleDetailView";
import PageShell from "@/components/layout/PageShell";
import PageHeader from "@/components/layout/PageHeader";
import { daysSince } from "@/app/lib/utils";

export default async function CycleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: cycle, error } = await supabase
    .from('cycles')
    .select(`*, spaces ( name, type )`)
    .eq('id', id)
    .single();

  if (error || !cycle) return notFound();

  const { data: plants } = await supabase.from('plants').select('*, current_age_days, days_in_stage').eq('cycle_id', id).order('id', { ascending: true });

  // Consultas de datos ambientales (igual que antes)...
  const { data: lastMeasurement } = await supabase.from('measurements').select('*').eq('cycle_id', id).order('date', { ascending: false }).limit(1).single();
  const { data: history } = await supabase.from('measurements').select('*').eq('cycle_id', id).order('date', { ascending: true }).limit(20);

  // Fetch Cycle Images (Gallery)
  const { data: cycleImages } = await supabase
    .from('cycle_images')
    .select('*')
    .eq('cycle_id', id)
    .order('taken_at', { ascending: false });

  const days = daysSince(cycle.start_date);

  const activePlants = (plants ?? []).filter(p => !p.is_archived);

  return (
    <PageShell>
      <PageHeader
        title={cycle.name}
        backHref="/cycles"
        backLabel="Ciclos"
        subtitle={`Arrancó el ${new Date(cycle.start_date).toLocaleDateString('es-AR')}`}
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
