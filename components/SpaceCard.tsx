"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import { Space } from "@/app/lib/types";
import { Warehouse, Sun, Trash2, Tent, Maximize, Wind } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/app/context/ToastContext";

interface SpaceCardProps {
  space: Space;
  onClick?: () => void;
}

export default function SpaceCard({ space, onClick }: SpaceCardProps) {
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

  const getSpaceIcon = () => {
    switch (space.type) {
      case 'Indoor':
        return <Warehouse className="text-[color:var(--info)]" size={22} aria-hidden="true" />;
      case 'Outdoor':
        return <Sun className="text-[color:var(--warning)]" size={22} aria-hidden="true" />;
      default:
        return <Tent className="text-[color:var(--stage-bloom)]" size={22} aria-hidden="true" />;
    }
  };

  const hasLight = space.light_type || space.light_watts;
  const hasDims = space.width || space.length || space.area_m2;
  const hasVent = space.vent_extraction || space.vent_intraction;
  const hasSpecs = hasLight || hasDims || hasVent;

  return (
    <>
      <div className="surface group relative rounded-[var(--radius-lg)] p-5">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-line bg-surface-2">
            {getSpaceIcon()}
          </span>

          <div className="min-w-0 flex-1">
            <h3 className="font-title text-lg font-semibold tracking-tight text-fg">
              {/* El botón cubre la tarjeta para que el clic funcione igual que
                  antes, pero ahora es un control real: recibe foco y responde
                  a Enter y espacio. */}
              {onClick ? (
                <button
                  type="button"
                  onClick={onClick}
                  className="text-left after:absolute after:inset-0 after:rounded-[var(--radius-lg)] after:content-['']"
                >
                  {space.name}
                </button>
              ) : (
                space.name
              )}
            </h3>

            {hasSpecs ? (
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-fg-muted">
                {hasLight && (
                  <li className="flex items-center gap-1.5">
                    <Sun size={14} className="text-[color:var(--warning)]" aria-hidden="true" />
                    <span className="sr-only">Iluminación:</span>
                    {[space.light_type, space.light_watts ? `${space.light_watts}W` : ''].filter(Boolean).join(' ')}
                  </li>
                )}
                {hasDims && (
                  <li className="flex items-center gap-1.5">
                    <Maximize size={14} className="text-[color:var(--brand-text)]" aria-hidden="true" />
                    <span className="sr-only">Dimensiones:</span>
                    {space.width && space.length ? `${space.width}x${space.length}m` : `${space.area_m2}m²`}
                  </li>
                )}
                {hasVent && (
                  <li className="flex items-center gap-1.5">
                    <Wind size={14} className="text-[color:var(--info)]" aria-hidden="true" />
                    <span className="sr-only">Ventilación:</span>
                    {space.vent_extraction || space.vent_intraction}m³/h
                  </li>
                )}
              </ul>
            ) : (
              <p className="mt-1.5 text-xs text-fg-subtle">Sin configuración técnica todavía</p>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
          <span className="chip border-line bg-surface-2 text-fg-muted">{space.type}</span>

          {/* Siempre visible: revelarlo sólo al pasar el cursor lo dejaba
              inalcanzable en táctil. z-10 lo pone sobre el área clicable. */}
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            className="btn-icon relative z-10 h-9 min-h-9 w-9 min-w-9 text-[color:var(--danger)]"
            aria-label={`Eliminar espacio ${space.name}`}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleDelete}
        title="Eliminar espacio"
        description={`Se eliminará "${space.name}". Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
      />
    </>
  );
}
