import { createClient } from "@/app/lib/supabase-server";
import AddSpaceModal from "@/components/AddSpaceModal";
import PageShell from "@/components/layout/PageShell";
import PageHeader from "@/components/layout/PageHeader";
import SpacesGridManager, { type SpaceUsage } from "@/components/SpacesGridManager";
import { Space } from "@/app/lib/types";

export const metadata = { title: "Espacios" };

export default async function SpacesPage() {
  const supabase = await createClient();

  const [{ data: spaces }, { data: cycles }, { data: plants }] = await Promise.all([
    supabase.from('spaces').select('*').order('created_at', { ascending: false }),
    supabase.from('cycles').select('id, space_id, is_active'),
    supabase.from('plants').select('cycle_id, is_archived'),
  ]);

  // Ocupación por espacio: ciclos en curso y plantas vivas que aloja.
  const plantsPerCycle: Record<number, number> = {};
  (plants ?? []).forEach((plant: { cycle_id: number | null; is_archived: boolean | null }) => {
    if (plant.cycle_id == null || plant.is_archived) return;
    plantsPerCycle[plant.cycle_id] = (plantsPerCycle[plant.cycle_id] ?? 0) + 1;
  });

  const usage: Record<number, SpaceUsage> = {};
  (cycles ?? []).forEach((cycle: { id: number; space_id: number | null; is_active: boolean }) => {
    if (cycle.space_id == null || !cycle.is_active) return;
    const entry = usage[cycle.space_id] ?? { activeCycles: 0, plants: 0 };
    entry.activeCycles += 1;
    entry.plants += plantsPerCycle[cycle.id] ?? 0;
    usage[cycle.space_id] = entry;
  });

  return (
    <PageShell>
      <PageHeader
        title="Espacios"
        subtitle="Dónde cultivás: carpas, armarios y exterior, con su ficha técnica"
        actions={<AddSpaceModal />}
      />

      <SpacesGridManager initialSpaces={(spaces ?? []) as Space[]} usage={usage} />
    </PageShell>
  );
}
