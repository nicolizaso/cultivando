"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Leaf } from "lucide-react";
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
  isCompact?: boolean;
}

export default function CycleStatusCard({ cycle, isCompact = false }: CycleStatusCardProps) {
  const daysDiff = Math.floor(
    (new Date().getTime() - new Date(cycle.start_date).getTime()) / (1000 * 60 * 60 * 24)
  );

  const groupedPlants = groupPlants(cycle.plants || []);
  const latestImage = cycle.cycle_images?.[0]?.public_url;
  const plantCount = cycle.plants?.length || 0;

  return (
    /* La versión compacta antes escondía nombre, botón y plantas detrás de
       :hover. En táctil eso era contenido inalcanzable, así que ahora sólo
       cambia la densidad: todo el contenido está siempre presente. */
    <article className="surface-interactive group overflow-hidden rounded-[var(--radius-lg)]">
      {latestImage && (
        <div className={`relative w-full ${isCompact ? "h-28" : "h-40"}`}>
          <Image
            src={latestImage}
            alt={`Última foto del ciclo ${cycle.name}`}
            fill
            sizes="(min-width: 1024px) 640px, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </div>
      )}

      <div className={isCompact ? "p-4" : "p-5"}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {cycle.spaces && (
            <span className="chip border-line bg-surface-3 text-fg-muted">{cycle.spaces.name}</span>
          )}
          <span className="chip border-[color:color-mix(in_srgb,var(--brand)_35%,transparent)] bg-brand-soft text-[color:var(--brand-text)]">
            Día {daysDiff}
          </span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className={`font-title font-semibold tracking-tight text-fg ${isCompact ? "text-lg" : "text-xl"}`}>
            <Link
              href={`/cycles/${cycle.id}`}
              className="transition-colors hover:text-[color:var(--brand-text)]"
            >
              {cycle.name}
            </Link>
          </h3>

          <Link
            href={`/cycles/${cycle.id}`}
            className="btn btn-secondary h-9 min-h-9 px-3 text-xs"
            aria-label={`Ver el ciclo ${cycle.name}`}
          >
            Ver ciclo
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold text-fg-muted">
            {plantCount} {plantCount === 1 ? "planta" : "plantas"}
          </p>

          {groupedPlants.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {groupedPlants.map((group) => (
                <li key={group.id}>
                  <Link
                    href={group.href}
                    className="flex items-center gap-1.5 rounded-full border border-line bg-surface-2 py-1 pl-2 pr-3 text-xs text-fg transition-colors hover:border-[color:var(--brand)] hover:text-[color:var(--brand-text)]"
                  >
                    <Leaf className="h-3.5 w-3.5 text-[color:var(--brand-text)]" aria-hidden="true" />
                    {group.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-fg-subtle">Sin plantas registradas</p>
          )}
        </div>
      </div>
    </article>
  );
}
