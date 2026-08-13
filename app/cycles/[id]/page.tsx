import { createClient } from "@/app/lib/supabase-server";
import { notFound } from "next/navigation";
import CycleDetailView from "@/components/CycleDetailView";
import GlobalHeader from "@/components/GlobalHeader"; 
import { PlayCircle, StopCircle, MapPin, CalendarDays, Sprout } from "lucide-react"; // Importar iconos

export default async function CycleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;
  const { data: { user } } = await supabase.auth.getUser();

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

  const daysDiff = Math.floor((new Date().getTime() - new Date(cycle.start_date).getTime()) / (1000 * 60 * 60 * 24));

  return (
    <main className="mx-auto w-full max-w-[1400px] px-5 py-6 md:px-8 md:py-8">
      <GlobalHeader userEmail={user?.email} title={cycle.name} subtitle="Panel del ciclo" />

      <div className="surface mb-8 rounded-[var(--radius-lg)] p-5 md:p-6">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span
                className={`chip ${
                  cycle.is_active
                    ? 'border-[color:color-mix(in_srgb,var(--brand)_35%,transparent)] bg-brand-soft text-[color:var(--brand-text)]'
                    : 'border-line bg-surface-3 text-fg-muted'
                }`}
              >
                {cycle.is_active
                  ? <PlayCircle size={12} aria-hidden="true" />
                  : <StopCircle size={12} aria-hidden="true" />}
                {cycle.is_active ? 'Activo' : 'Archivado'}
              </span>
              {cycle.spaces?.type && (
                <span className="chip border-line bg-surface-2 text-fg-muted">{cycle.spaces.type}</span>
              )}
            </div>

            <h2 className="font-title text-3xl font-semibold tracking-tight text-fg md:text-4xl">{cycle.name}</h2>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg-muted">
              <span className="flex items-center gap-1.5">
                <MapPin size={14} aria-hidden="true" />
                {cycle.spaces?.name || 'Sin espacio'}
              </span>
              <span className="flex items-center gap-1.5">
                <CalendarDays size={14} aria-hidden="true" />
                Día {daysDiff}
              </span>
            </div>
          </div>

          <div className="surface-2 rounded-[var(--radius-lg)] p-4 text-right">
            <p className="mb-1 flex items-center justify-end gap-1.5 text-xs font-semibold text-fg-muted">
              Plantas
              <Sprout size={13} aria-hidden="true" />
            </p>
            <p className="font-title text-2xl font-semibold text-fg">{plants?.length || 0}</p>
          </div>
        </div>
      </div>

      <CycleDetailView 
        cycle={cycle} 
        plants={plants || []} 
        lastMeasurement={lastMeasurement}
        history={history || []}
        cycleImages={cycleImages || []}
      />
    </main>
  );
}