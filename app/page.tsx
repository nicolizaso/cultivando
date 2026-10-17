import { getCurrentUser } from "@/app/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import PageShell from "@/components/layout/PageShell";
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";
import DashboardData from "@/components/DashboardData";

export const dynamic = 'force-dynamic';

export default async function Home() {
  // La misma verificación que ya hizo el layout: `getCurrentUser` la comparte.
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <PageShell>
      {/* La cabecera vive dentro de DashboardData porque el saludo depende del
          perfil: sacarla fuera obligaría a una segunda consulta en cascada. */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardData user={user} />
      </Suspense>
    </PageShell>
  );
}
