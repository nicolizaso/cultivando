import { createClient } from "@/app/lib/supabase-server";
import AddCycleModal from "@/components/AddCycleModal";
import CycleCard from "@/components/CycleCard";
import GlobalHeader from "@/components/GlobalHeader";
import EmptyState from "@/components/EmptyState";
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
    <main className="mx-auto w-full max-w-[1400px] px-5 py-6 md:px-8 md:py-8">
      
      <GlobalHeader userEmail={user?.email} title="Ciclos" subtitle="Historial de cultivo" />
      
      <div className="flex justify-end mb-6">
          {/* Modal simple sin props automáticas */}
          <AddCycleModal />
      </div>

      {cycles && cycles.length > 0 ? (
        <ul className="stagger grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cycles.map((cycle, i) => (
            <li key={cycle.id} style={{ ['--i' as string]: i }}>
              <CycleCard cycle={cycle} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Sprout}
          title="Sin ciclos"
          description="Un ciclo agrupa las plantas que cultivás juntas en un espacio. Creá el primero para empezar a registrar."
        />
      )}

    </main>
  );
}