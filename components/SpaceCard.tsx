"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import { Space } from "@/app/lib/types";
import { Warehouse, Sun, Trash2, Tent, Maximize, Wind, SlidersHorizontal } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/app/context/ToastContext";

interface SpaceCardProps {
  space: Space;
  /** Ciclos en curso y plantas vivas alojadas en el espacio. */
  activeCycles?: number;
  plants?: number;
  onConfigure?: () => void;
}

export default function SpaceCard({ space, activeCycles = 0, plants = 0, onConfigure }: SpaceCardProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async () => {
    try {
      const { error } = await supabase.from('spaces').delete().eq('id', space.id);
      if (error) throw error;
      setIsDeleting(true);
      showToast(`Espacio "${space.name}" eliminado`);
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudo eliminar el espacio", "error");
    }
  };

  if (isDeleting) return null;

  const typeIcon = {
    Indoor: <Warehouse className="text-[color:var(--accent-blue)]" size={20} aria-hidden="true" />,
    Outdoor: <Sun className="text-[color:var(--accent-amber)]" size={20} aria-hidden="true" />,
  }[space.type as string] ?? <Tent className="text-[color:var(--accent-violet)]" size={20} aria-hidden="true" />;

  const specs = [
    (space.light_type || space.light_watts) && {
      icon: Sun,
      srLabel: 'Iluminación',
      value: [space.light_type, space.light_watts ? `${space.light_watts}W` : ''].filter(Boolean).join(' '),
    },
    (space.width || space.length || space.area_m2) && {
      icon: Maximize,
      srLabel: 'Dimensiones',
      value: space.width && space.length ? `${space.width} x ${space.length} m` : `${space.area_m2} m²`,
    },
    (space.vent_extraction || space.vent_intraction) && {
      icon: Wind,
      srLabel: 'Ventilación',
      value: `${space.vent_extraction || space.vent_intraction} m³/h`,
    },
  ].filter(Boolean) as { icon: typeof Sun; srLabel: string; value: string }[];

  return (
    <>
      <article className="surface flex h-full flex-col rounded-[var(--radius-lg)] p-5">
        <div className="flex items-start gap-3.5">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-line bg-surface-2"
            aria-hidden="true"
          >
            {typeIcon}
          </span>

          <div className="min-w-0 flex-1">
            <h3 className="truncate font-title text-lg font-semibold tracking-tight text-fg">{space.name}</h3>
            <p className="mt-0.5 text-xs text-fg-muted">
              {/* La ocupación es el dato que faltaba: hasta ahora la tarjeta no
                  decía si el espacio estaba en uso o vacío. */}
              {activeCycles === 0
                ? 'Libre'
                : `${activeCycles} ciclo${activeCycles === 1 ? '' : 's'} · ${plants} planta${plants === 1 ? '' : 's'}`}
            </p>
          </div>

          <span className="chip chip-neutral shrink-0">{space.type}</span>
        </div>

        {specs.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-fg-muted">
            {specs.map(spec => {
              const Icon = spec.icon;
              return (
                <li key={spec.srLabel} className="flex items-center gap-1.5">
                  <Icon size={14} className="shrink-0 text-fg-subtle" aria-hidden="true" />
                  <span className="sr-only">{spec.srLabel}: </span>
                  {spec.value}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 text-xs text-fg-subtle">
            Sin ficha técnica. Cargá luz, medidas y ventilación para calcular el VPD.
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3.5">
          {/* Botón explícito: antes había que adivinar que la tarjeta entera
              abría la configuración. */}
          <button type="button" onClick={onConfigure} className="btn btn-sm btn-secondary">
            <SlidersHorizontal size={15} aria-hidden="true" />
            Configurar
          </button>

          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            className="btn-icon btn-icon-sm text-[color:var(--danger)]"
            aria-label={`Eliminar espacio ${space.name}`}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      </article>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleDelete}
        title="Eliminar espacio"
        description={
          activeCycles > 0
            ? `"${space.name}" tiene ${activeCycles} ciclo${activeCycles === 1 ? '' : 's'} en curso. Al eliminarlo esos ciclos se quedan sin espacio asignado.`
            : `Se eliminará "${space.name}". Esta acción no se puede deshacer.`
        }
        confirmLabel="Eliminar"
      />
    </>
  );
}
