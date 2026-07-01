import { createClient } from "@/app/lib/supabase-server";
import AddSpaceModal from "@/components/AddSpaceModal";
import GlobalHeader from "@/components/GlobalHeader";
import SpacesGridManager from "@/components/SpacesGridManager";

export default async function SpacesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: spaces } = await supabase
    .from('spaces')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <main className="min-h-screen bg-background text-foreground p-4 md:p-8 pb-24 font-body">
      
      <GlobalHeader userEmail={user?.email} title="Infraestructura" subtitle="Espacios" />

      <div className="flex justify-end mb-6">
        <AddSpaceModal />
      </div>

      <SpacesGridManager initialSpaces={spaces || []} />
    </main>
  );
}
