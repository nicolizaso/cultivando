import { createClient } from "@/app/lib/supabase-server";
import PageShell from "@/components/layout/PageShell";
import PageHeader from "@/components/layout/PageHeader";
import PlantsGridManager from "@/components/PlantsGridManager";
import AddPlantModal from "@/components/AddPlantModal";
import { Cycle, Plant, Space } from "@/app/lib/types";

type PlantWithCycle = Plant & { cycles?: { id: number; name: string; space_id: number } | null };

export const metadata = { title: "Plantas" };

export default async function PlantsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string | string[] }>;
}) {
  const supabase = await createClient();
  const { search } = await searchParams;
  const initialQuery = (Array.isArray(search) ? search[0] : search ?? '').slice(0, 100);

  const [
    { data: plants },
    { data: cycles },
    { data: spaces }
  ] = await Promise.all([
    supabase
      .from('plants')
      .select(`
        *,
        cycles ( id, name, space_id )
      `)
      .order('created_at', { ascending: false }),
    supabase
      .from('cycles')
      .select('id, name, space_id, is_active')
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
        actions={
          <AddPlantModal
            activeCycles={(cycles ?? []).filter((cycle) => cycle.is_active)}
            potentialMothers={(plants ?? []).filter((plant) => !plant.is_archived).sort((a, b) => a.name.localeCompare(b.name, 'es'))}
          />
        }
      />

      <PlantsGridManager
        plants={(plants ?? []) as PlantWithCycle[]}
        cycles={(cycles ?? []) as Pick<Cycle, 'id' | 'name' | 'space_id'>[]}
        spaces={(spaces ?? []) as Pick<Space, 'id' | 'name'>[]}
        initialQuery={initialQuery}
        key={initialQuery}
      />
    </PageShell>
  );
}
