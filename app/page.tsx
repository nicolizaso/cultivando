import { createClient } from "@/app/lib/supabase-server";
import GlobalHeader from "@/components/GlobalHeader";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";
import DashboardData from "@/components/DashboardData";

export const dynamic = 'force-dynamic';

export default async function Home() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <main className="mx-auto w-full max-w-[1400px] px-5 py-6 md:px-8 md:py-8">
      <GlobalHeader userEmail={user.email} title="Panel de Control" />

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardData user={user} />
      </Suspense>
    </main>
  );
}
