import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { createClient } from "@/app/lib/supabase-server";
import { parseId } from "@/app/lib/sanitize";
import PageShell from "@/components/layout/PageShell";
import CycleReport from "@/components/CycleReport";
import type { ReportData } from "@/components/CycleReport";
import PrintButton from "@/components/PrintButton";

export const metadata = { title: "Reporte del ciclo" };

const EXPORTS = [
  { kind: "plantas", label: "Plantas" },
  { kind: "bitacora", label: "Bitácora" },
  { kind: "clima", label: "Clima" },
  { kind: "cosechas", label: "Cosechas" },
] as const;

/** El ciclo en una página para imprimir o guardar como PDF, y sus CSV. */
export default async function CycleReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (!id) return notFound();

  const supabase = await createClient();
  const [{ data: cycle }, { data: plants }, { data: measurements }, { data: images }, { data: harvests }] = await Promise.all([
    supabase.from("cycles").select("name, start_date, is_active, spaces ( name, type, area_m2, width, length, light_watts )").eq("id", id).maybeSingle(),
    supabase.from("plants").select("id, name, strain, source_type, is_archived, stage, planted_at, stage_updated_at, date_germinacion, date_plantula, date_enraizamiento, date_vegetativo, date_floracion, date_secado, date_curado").eq("cycle_id", id).order("id"),
    supabase.from("measurements").select("date, created_at, temperature, humidity").eq("cycle_id", id).order("date", { ascending: false }).limit(120),
    supabase.from("cycle_images").select("id, public_url, taken_at, created_at, description").eq("cycle_id", id).order("taken_at"),
    supabase.from("harvests").select("plant_id, harvested_on, dried_on, wet_g, dry_g").eq("cycle_id", id),
  ]);

  if (!cycle) return notFound();

  const data: ReportData = {
    cycle: { name: cycle.name, start_date: cycle.start_date, is_active: cycle.is_active, space: cycle.spaces ?? null },
    plants: plants ?? [],
    measurements: measurements ?? [],
    images: images ?? [],
    harvests: harvests ?? [],
  };

  return (
    <PageShell>
      <CycleReport
        data={data}
        actions={
          <>
            <PrintButton />
            {EXPORTS.map((item) => (
              <a key={item.kind} href={`/cycles/${id}/export?tipo=${item.kind}`} className="btn btn-sm btn-ghost" download>
                <Download size={15} aria-hidden="true" />
                {item.label} (CSV)
              </a>
            ))}
          </>
        }
      />
    </PageShell>
  );
}
