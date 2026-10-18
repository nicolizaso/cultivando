import { createClient } from "@/app/lib/supabase-server";
import { notFound } from "next/navigation";
import { parseId } from "@/app/lib/sanitize";
import PageShell from "@/components/layout/PageShell";
import PageHeader from "@/components/layout/PageHeader";
import EditPlantForm from "@/components/EditPlantForm";
import { Plant, Cycle } from "@/app/lib/types";

export default async function EditPlantPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (!id) return notFound();

  // Fetch Plant
  const { data: plant, error } = await supabase
    .from('plants')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !plant) return notFound();

  // Ciclos para el desplegable: los activos y, aunque esté cerrado, el actual.
  let cyclesQuery = supabase
    .from('cycles')
    .select('id, name, start_date, is_active, space_id')
    .order('created_at', { ascending: false });
  cyclesQuery = plant.cycle_id
    ? cyclesQuery.or(`is_active.eq.true,id.eq.${Number(plant.cycle_id)}`)
    : cyclesQuery.eq('is_active', true);
  const { data: cycles } = await cyclesQuery;

  return (
    <PageShell size="narrow">
      <PageHeader
        title="Editar planta"
        subtitle={plant.name}
        backHref={`/plants/${plant.id}`}
        backLabel="Ficha de la planta"
      />

      <EditPlantForm
        plant={plant as Plant}
        cycles={(cycles as Cycle[]) || []}
      />
    </PageShell>
  );
}
