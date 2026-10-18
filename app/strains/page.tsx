import Link from "next/link";
import { Dna } from "lucide-react";
import { createClient } from "@/app/lib/supabase-server";
import PageShell from "@/components/layout/PageShell";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/EmptyState";
import { MIN_SAMPLES, STRAIN_PLANT_COLUMNS, strainStats } from "@/app/lib/strain-stats";
import type { Average } from "@/app/lib/strain-stats";
import { strainYields } from "@/app/lib/harvest";

export const metadata = { title: "Genéticas" };

/**
 * Cuánto dura cada etapa en cada genética, con las plantas que ya pasaron por
 * ella. Es lo mismo que usa el sugeridor del panel: con MIN_SAMPLES plantas o
 * más, avisa según el promedio de esa genética en vez de la regla general.
 */
export default async function StrainsPage() {
  const supabase = await createClient();
  const [{ data: plants }, { data: harvests }] = await Promise.all([
    supabase.from("plants").select(STRAIN_PLANT_COLUMNS),
    supabase.from("harvests").select("plant_id, harvested_on, dry_g"),
  ]);
  const stats = strainStats(plants ?? []);
  const yields = strainYields(harvests ?? [], new Map((plants ?? []).map((plant) => [plant.id, plant.strain])));
  const withoutStrain = (plants ?? []).filter((plant) => !plant.strain?.trim()).length;

  return (
    <PageShell>
      <PageHeader
        title="Genéticas"
        backHref="/plants"
        backLabel="Plantas"
        subtitle="Cuánto dura cada etapa en tus genéticas, según lo que ya cultivaste"
      />

      {stats.length === 0 ? (
        <EmptyState
          icon={Dna}
          title="Todavía no hay genéticas"
          description="Cargá la genética de tus plantas y, a medida que pasen de etapa, acá vas a ver cuánto dura cada una."
          action={<Link href="/plants" className="btn btn-primary">Ir a plantas</Link>}
        />
      ) : (
        <>
          <div className="surface overflow-x-auto rounded-[var(--radius-lg)]">
            <table className="w-full min-w-[52rem] text-sm">
              <caption className="sr-only">Estadísticas por genética</caption>
              <thead className="text-left text-xs text-fg-muted">
                <tr className="border-b border-line">
                  <th scope="col" className="sticky left-0 bg-surface px-4 py-3 font-semibold">Genética</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Plantas</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Ciclos</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Vegetativo</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Floración</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Hasta cosecha</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Cosechadas</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Seco por planta</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Pérdidas</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((strain) => (
                  <tr key={strain.key} className="border-b border-line last:border-0">
                    <th scope="row" className="sticky left-0 bg-surface px-4 py-3 text-left">
                      <Link
                        href={`/plants?search=${encodeURIComponent(strain.name)}`}
                        className="font-semibold text-fg hover:text-[color:var(--brand-text)] hover:underline"
                      >
                        {strain.name}
                      </Link>
                      <span className="mt-0.5 block text-xs font-normal text-fg-muted">
                        {strain.seeds > 0 && `${strain.seeds} de semilla`}
                        {strain.seeds > 0 && strain.clones > 0 && " · "}
                        {strain.clones > 0 && `${strain.clones} ${strain.clones === 1 ? "esqueje" : "esquejes"}`}
                      </span>
                    </th>
                    <td className="mono px-3 py-3 text-right text-fg">
                      {strain.plants}
                      {strain.active !== strain.plants && <span className="ml-1 text-xs text-fg-subtle">({strain.active} activas)</span>}
                    </td>
                    <td className="mono px-3 py-3 text-right text-fg">{strain.cycles}</td>
                    <td className="mono px-3 py-3 text-right"><Days value={strain.stages["Vegetativo"]} /></td>
                    <td className="mono px-3 py-3 text-right"><Days value={strain.stages["Floración"]} /></td>
                    <td className="mono px-3 py-3 text-right"><Days value={strain.toHarvest} /></td>
                    <td className="mono px-3 py-3 text-right text-fg">{strain.harvested}</td>
                    <td className="mono px-3 py-3 text-right">
                      {yields[strain.key] ? (
                        <span className="text-fg">
                          {yields[strain.key].avg.toLocaleString("es-AR")} g
                          <span className="ml-1 text-xs text-fg-subtle">({yields[strain.key].n})</span>
                        </span>
                      ) : (
                        <span className="text-fg-subtle">–</span>
                      )}
                    </td>
                    <td className="mono px-4 py-3 text-right text-fg">
                      {strain.lossRate === null ? <span className="text-fg-subtle">–</span> : `${Math.round(strain.lossRate * 100)}%`}
                      {strain.lost > 0 && <span className="ml-1 text-xs text-fg-subtle">({strain.lost})</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 space-y-1 text-xs text-fg-muted">
            <p>
              Días promedio de cada etapa en las plantas que ya la terminaron; entre paréntesis, de cuántas plantas sale.
              Con {MIN_SAMPLES} o más, el panel te avisa el cambio de etapa según ese promedio.
            </p>
            <p>Pérdidas: plantas archivadas sin llegar a cosecharse, sobre las que ya terminaron.</p>
            {withoutStrain > 0 && (
              <p>
                {withoutStrain === 1 ? "Hay 1 planta" : `Hay ${withoutStrain} plantas`} sin genética cargada: no entran en la tabla.
              </p>
            )}
          </div>
        </>
      )}
    </PageShell>
  );
}

function Days({ value }: { value: Average | null | undefined }) {
  if (!value) return <span className="text-fg-subtle">–</span>;
  return (
    <span className="text-fg">
      {value.avg} d
      <span className="ml-1 text-xs text-fg-subtle">({value.n})</span>
    </span>
  );
}
