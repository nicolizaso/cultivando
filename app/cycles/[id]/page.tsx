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
    <main className="min-h-screen bg-background pb-24 text-foreground p-4 md:p-8 font-body">
      
      <GlobalHeader userEmail={user?.email} title="Panel de Ciclo" subtitle={cycle.name} />

      {/* --- HERO SECTION --- */}
      <div className="bg-card border border-card-border rounded-2xl p-6 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

        <div className="flex flex-col md:flex-row justify-between items-end gap-6 relative z-10">
            <div>
                <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border flex items-center gap-1 ${
                        cycle.is_active 
                        ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/20' 
                        : 'bg-slate-800 text-muted border-card-border'
                    }`}>
                        {cycle.is_active ? <PlayCircle size={10} /> : <StopCircle size={10} />}
                        {cycle.is_active ? 'Activo' : 'Archivado'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-foreground border border-card-border">
                        {cycle.spaces?.type}
                    </span>
                </div>
                <h1 className="text-3xl md:text-5xl font-light font-title text-foreground mb-2">
                    {cycle.name}
                </h1>
                <div className="flex items-center gap-4 text-muted text-sm font-body">
                   <div className="flex items-center gap-1"><MapPin size={14} /> {cycle.spaces?.name}</div>
                   <div className="w-px h-3 bg-card-border"></div>
                   <div className="flex items-center gap-1"><CalendarDays size={14} /> Día {daysDiff}</div>
                </div>
            </div>

            {/* KPI Rápido */}
            <div className="flex gap-8 text-right bg-background/50 p-4 rounded-2xl border border-card-border backdrop-blur-sm">
                <div>
                    <p className="text-[10px] text-muted uppercase tracking-widest font-bold mb-1 flex items-center justify-end gap-1">
                        Plantas <Sprout size={10} />
                    </p>
                    <p className="text-2xl font-light font-title text-foreground">{plants?.length || 0}</p>
                </div>
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