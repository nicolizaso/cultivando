import { createClient } from "@/app/lib/supabase-server";
import { notFound } from "next/navigation";
import PageShell from "@/components/layout/PageShell";
import PageHeader from "@/components/layout/PageHeader";
import EditPlantForm from "@/components/EditPlantForm";
import { Plant, Cycle } from "@/app/lib/types";

export default async function EditPlantPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;

  // Fetch Plant
  const { data: plant, error } = await supabase
    .from('plants')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !plant) return notFound();

  // Fetch Cycles for Dropdown
  const { data: cycles } = await supabase
    .from('cycles')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

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
