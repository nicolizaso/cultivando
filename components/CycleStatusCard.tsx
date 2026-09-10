"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Leaf, MapPin } from "lucide-react";
import { Plant } from "@/app/lib/types";
import { groupPlants } from "@/app/lib/plant-grouping";

interface SpaceInfo {
  id: number;
  name: string;
  type: string;
}

export interface CycleWithPlantsAndSpace {
  id: number;
  name: string;
  start_date: string;
  space_id: number;
  plants: Plant[];
  spaces: SpaceInfo | null;
  cycle_images?: { public_url: string }[];
}

interface CycleStatusCardProps {
  cycle: CycleWithPlantsAndSpace;
  /** Día de cultivo, resuelto en el servidor. */
  days: number;
  isCompact?: boolean;
}

/**
 * Tarjeta de ciclo activo del panel.
 *
 * La versión compacta antes escondía nombre, botón y plantas detrás de :hover.
 * En táctil eso era contenido inalcanzable, así que ahora sólo cambia la
 * densidad: todo el contenido está siempre presente.
 */
export default function CycleStatusCard({ cycle, days, isCompact = false }: CycleStatusCardProps) {
  const groupedPlants = groupPlants(cycle.plants || []);
  const latestImage = cycle.cycle_images?.[0]?.public_url;
  const plantCount = cycle.plants?.length || 0;

  return (
    <article className="surface-interactive group relative flex overflow-hidden rounded-[var(--radius-lg)]">
      {latestImage && (
        <div className={`relative shrink-0 ${isCompact ? 'w-28' : 'w-36 sm:w-44'}`}>
          <Image
            src={latestImage}
            alt={`Última foto del ciclo ${cycle.name}`}
            fill
            sizes="180px"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        </div>
      )}

      <div className={`min-w-0 flex-1 ${isCompact ? 'p-4' : 'p-5'}`}>
        <div className="flex items-start justify-between gap-3">
          <h3 className={`min-w-0 font-title font-semibold tracking-tight text-fg ${isCompact ? 'text-base' : 'text-lg'}`}>
            {/* El enlace se estira sobre la tarjeta; las píldoras llevan z-10. */}
            <Link
              href={`/cycles/${cycle.id}`}
              className="transition-colors after:absolute after:inset-0 after:content-[''] hover:text-[color:var(--brand-text)]"
            >
              {cycle.name}
            </Link>
          </h3>

          <ArrowUpRight
            className="mt-0.5 h-4 w-4 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            aria-hidden="true"
          />
        </div>

        <dl className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <div className="flex items-baseline gap-1.5">
            <dt className="text-xs text-fg-muted">Día</dt>
            <dd className="metric text-xl text-fg">{days}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-xs text-fg-muted">{plantCount === 1 ? 'Planta' : 'Plantas'}</dt>
            <dd className="metric text-xl text-fg">{plantCount}</dd>
          </div>
          {cycle.spaces && (
            <div className="flex min-w-0 items-center gap-1.5">
              <dt className="sr-only">Espacio</dt>
              <dd className="flex min-w-0 items-center gap-1 truncate text-xs text-fg-muted">
                <MapPin size={12} className="shrink-0" aria-hidden="true" />
                {cycle.spaces.name}
              </dd>
            </div>
          )}
        </dl>

        {groupedPlants.length > 0 ? (
          <ul className="mt-3.5 flex flex-wrap gap-1.5">
            {groupedPlants.slice(0, isCompact ? 3 : 6).map((group) => (
              <li key={group.id}>
                <Link
                  href={group.href}
                  className="relative z-10 flex items-center gap-1.5 rounded-full border border-line bg-surface-2 py-1 pl-2 pr-2.5 text-[11px] font-medium text-fg-muted transition-colors hover:border-[color:var(--brand)] hover:text-[color:var(--brand-text)]"
                >
                  <Leaf className="h-3 w-3 text-[color:var(--brand-text)]" aria-hidden="true" />
                  {group.label}
                </Link>
              </li>
            ))}
            {groupedPlants.length > (isCompact ? 3 : 6) && (
              <li className="flex items-center px-1 text-[11px] text-fg-subtle">
                +{groupedPlants.length - (isCompact ? 3 : 6)}
              </li>
            )}
          </ul>
        ) : (
          <p className="mt-3.5 text-xs text-fg-subtle">Sin plantas registradas todavía</p>
        )}
      </div>
    </article>
  );
}
