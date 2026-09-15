import { createClient } from "@/app/lib/supabase-server";
import AddCycleModal from "@/components/AddCycleModal";
import CyclesGrid from "@/components/CyclesGrid";
import type { CycleWithSpace } from "@/components/CycleCard";
import PageShell from "@/components/layout/PageShell";
import PageHeader from "@/components/layout/PageHeader";
import { daysSince } from "@/app/lib/utils";
import { Space } from "@/app/lib/types";

export const metadata = { title: "Ciclos" };

export default async function CyclesPage() {
  const supabase = await createClient();

  const [{ data: cycles }, { data: plants }, { data: spaces }] = await Promise.all([
    supabase
      .from('cycles')
      .select('*, spaces(name), cycle_images(public_url)')
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: false })
      .order('taken_at', { foreignTable: 'cycle_images', ascending: false })
      .limit(1, { foreignTable: 'cycle_images' }),
    // Una sola consulta para contar plantas por ciclo, en vez de una por tarjeta.
    supabase
      .from('plants')
      .select('cycle_id, is_archived'),
    // Destinos posibles para mudar un ciclo de espacio desde su tarjeta.
    supabase
      .from('spaces')
      .select('id, name, type')
      .order('name', { ascending: true }),
  ]);

  const plantCounts: Record<number, number> = {};
  (plants ?? []).forEach((plant: { cycle_id: number | null; is_archived: boolean | null }) => {
    if (plant.cycle_id == null || plant.is_archived) return;
    plantCounts[plant.cycle_id] = (plantCounts[plant.cycle_id] ?? 0) + 1;
  });

  const days: Record<number, number> = {};
  (cycles ?? []).forEach((cycle: { id: number; start_date: string }) => {
    days[cycle.id] = daysSince(cycle.start_date);
  });

  return (
    <PageShell>
      <PageHeader
        title="Ciclos"
        subtitle="Cada tanda de cultivo, desde el día uno hasta el curado"
        actions={<AddCycleModal />}
      />

      <CyclesGrid
        cycles={(cycles ?? []) as CycleWithSpace[]}
        plantCounts={plantCounts}
        days={days}
        spaces={(spaces ?? []) as Pick<Space, 'id' | 'name' | 'type'>[]}
      />
    </PageShell>
  );
}
