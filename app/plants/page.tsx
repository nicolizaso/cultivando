import { createClient } from "@/app/lib/supabase-server";
import PageShell from "@/components/layout/PageShell";
import PageHeader from "@/components/layout/PageHeader";
import PlantsGridManager from "@/components/PlantsGridManager";
import AddPlantModal from "@/components/AddPlantModal";
import { Cycle, Plant, Space } from "@/app/lib/types";

type PlantWithCycle = Plant & { cycles?: { id: number; name: string; space_id: number } | null };

export const metadata = { title: "Plantas" };

export default async function PlantsPage() {
  const supabase = await createClient();

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
    <PageShell>
      <PageHeader
        title="Plantas"
        subtitle="Todos tus ejemplares, con su etapa y su edad al día"
        actions={<AddPlantModal />}
      />

      <PlantsGridManager
        plants={(plants ?? []) as PlantWithCycle[]}
        cycles={(cycles ?? []) as Pick<Cycle, 'id' | 'name' | 'space_id'>[]}
        spaces={(spaces ?? []) as Pick<Space, 'id' | 'name'>[]}
      />
    </PageShell>
  );
}
