import { notFound } from "next/navigation";
import { createClient } from "@/app/lib/supabase-server";
import PageShell from "@/components/layout/PageShell";
import CycleReport from "@/components/CycleReport";
import type { ReportData } from "@/components/CycleReport";

export const metadata = { title: "Ciclo compartido", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Lo que ve quien recibe el enlace de un ciclo: sólo lectura, sin cuenta.
 * Los datos salen de `get_shared_cycle`, que devuelve únicamente ese ciclo y
 * null si el enlace no existe o se cortó.
 */
export default async function SharedCyclePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{24,64}$/.test(token)) return notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_shared_cycle", { p_token: token });
  const shared = data as unknown as ReportData | null;
  if (error || !shared?.cycle) return notFound();

  return (
    <PageShell>
      <CycleReport
        data={shared}
        footer={
          <p className="border-t border-line pt-4 text-center text-xs text-fg-muted">
            Ciclo compartido desde Cultivando. Es una vista de sólo lectura.
          </p>
        }
      />
    </PageShell>
  );
}
