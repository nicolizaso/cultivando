import { createClient } from "@/app/lib/supabase-server";
import GlobalHeader from "@/components/GlobalHeader";
import PlantsGridManager from "@/components/PlantsGridManager";

export default async function PlantsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [
    { data: plants },
    { data: cycles },
    { data: spaces }
  ] = await Promise.all([
    supabase
      .from('plants')
      .select(`
        *,
        current_age_days,
        days_in_stage,
        is_archived,
        cycles ( id, name, space_id )
      `)
      .order('created_at', { ascending: false }),
    supabase
      .from('cycles')
      .select('id, name, space_id')
      .order('start_date', { ascending: false }),
    supabase
      .from('spaces')
      .select('id, name')
      .order('name')
  ]);

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text p-4 md:p-8 pb-24 font-body">
      
      <GlobalHeader 
        userEmail={user?.email} 
        title="Inventario Global" 
        subtitle="Todas las muestras"
      />

      <PlantsGridManager
        plants={plants as any[] || []}
        cycles={cycles as any[] || []}
        spaces={spaces as any[] || []}
      />

    </main>
  );
}
