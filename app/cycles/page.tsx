import { createClient } from "@/app/lib/supabase-server";
import AddCycleModal from "@/components/AddCycleModal";
import CycleCard from "@/components/CycleCard";
import GlobalHeader from "@/components/GlobalHeader";
import { Sprout } from "lucide-react"; 

export default async function CyclesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: cycles } = await supabase
    .from('cycles')
    .select('*, spaces(name), cycle_images(public_url)')
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false })
    .order('taken_at', { foreignTable: 'cycle_images', ascending: false })
    .limit(1, { foreignTable: 'cycle_images' });

  return (
    <main className="min-h-screen bg-background text-foreground p-4 md:p-8 pb-24 font-body">
      
      <GlobalHeader userEmail={user?.email} title="Historial" subtitle="Ciclos de Cultivo" />
      
      <div className="flex justify-end mb-6">
          {/* Modal simple sin props automáticas */}
          <AddCycleModal />
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cycles && cycles.length > 0 ? (
          cycles.map((cycle) => (
            <CycleCard key={cycle.id} cycle={cycle} />
          ))
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center py-20 opacity-50">
            <Sprout size={48} className="mb-4 text-muted" />
            <p className="text-muted">No hay ciclos registrados aún.</p>
          </div>
        )}
      </section>

    </main>
  );
}