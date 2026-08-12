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
    <main className="mx-auto w-full max-w-[1400px] px-5 py-6 md:px-8 md:py-8">
      
      <GlobalHeader 
        userEmail={user?.email} 
        title="Plantas"
        subtitle="Todo tu inventario"
      />

      <PlantsGridManager
        plants={plants as any[] || []}
        cycles={cycles as any[] || []}
        spaces={spaces as any[] || []}
      />

    </main>
  );
}
