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
    <main className="mx-auto w-full max-w-[1400px] px-5 py-6 md:px-8 md:py-8">
      
      <GlobalHeader userEmail={user?.email} title="Espacios" subtitle="Tu infraestructura" />

      <div className="flex justify-end mb-6">
        <AddSpaceModal />
      </div>

      <SpacesGridManager initialSpaces={spaces || []} />
    </main>
  );
}
