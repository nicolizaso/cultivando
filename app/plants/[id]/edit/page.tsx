import { createClient } from "@/app/lib/supabase-server";
import { notFound } from "next/navigation";
import GlobalHeader from "@/components/GlobalHeader";
import EditPlantForm from "@/components/EditPlantForm";
import { Plant, Cycle } from "@/app/lib/types";

export default async function EditPlantPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;
  const { data: { user } } = await supabase.auth.getUser();

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
    <main className="min-h-screen bg-background pb-24 text-foreground p-4 md:p-8 font-body">

      <GlobalHeader userEmail={user?.email} title="Editar Planta" subtitle={plant.name} />

      <EditPlantForm
        plant={plant as Plant}
        cycles={(cycles as Cycle[]) || []}
      />

    </main>
  );
}
