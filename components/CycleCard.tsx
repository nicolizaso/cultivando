"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import { PlayCircle, StopCircle, Trash2, MapPin, Sprout, Loader2 } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/app/context/ToastContext";

export interface CycleWithSpace {
  id: number;
  name: string;
  start_date: string;
  is_active: boolean;
  spaces: { name: string } | null;
  cycle_images?: { public_url: string }[];
}

interface CycleCardProps {
  cycle: CycleWithSpace;
  /** Día de cultivo, resuelto en el servidor. */
  days: number;
  plantCount?: number;
}

export default function CycleCard({ cycle, days, plantCount }: CycleCardProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const latestImage = cycle.cycle_images?.[0]?.public_url;

  const toggleStatus = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.from('cycles').update({ is_active: !cycle.is_active }).eq('id', cycle.id);
      if (error) throw error;
      showToast(cycle.is_active ? "Ciclo finalizado" : "Ciclo reactivado");
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudo actualizar el ciclo", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase.from('cycles').delete().eq('id', cycle.id);
      if (error) throw error;
      showToast("Ciclo eliminado");
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudo eliminar el ciclo", "error");
    }
  };

  return (
    <>
      <article className="surface-interactive group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)]">
        <div className="relative h-32 w-full shrink-0 bg-surface-2">
          {latestImage ? (
            <Image
              src={latestImage}
              alt=""
              fill
              sizes="(min-width: 1280px) 400px, (min-width: 640px) 50vw, 100vw"
              className={`object-cover transition-transform duration-500 group-hover:scale-[1.03] ${
                cycle.is_active ? '' : 'grayscale-[0.4]'
              }`}
            />
          ) : (
            /* Sin foto, la cabecera no se queda vacía: un degradado de marca
               mantiene la altura y la tarjeta no cambia de forma en la grilla. */
            <div
              className={`flex h-full w-full items-center justify-center ${cycle.is_active ? 'bg-brand-soft' : 'bg-surface-3'}`}
              aria-hidden="true"
            >
              <Sprout
                className={`h-9 w-9 opacity-45 ${cycle.is_active ? 'text-[color:var(--brand-text)]' : 'text-fg-subtle'}`}
                strokeWidth={1.5}
              />
            </div>
          )}

          <span
            className={`chip absolute left-3 top-3 backdrop-blur-sm ${
              cycle.is_active
                ? 'border-[color:color-mix(in_srgb,var(--brand)_40%,transparent)] bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] text-[color:var(--brand-text)]'
                : 'border-line bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] text-fg-muted'
            }`}
          >
            {cycle.is_active
              ? <PlayCircle size={12} aria-hidden="true" />
              : <StopCircle size={12} aria-hidden="true" />}
            {cycle.is_active ? "En curso" : "Finalizado"}
          </span>
        </div>

        <div className="flex flex-1 flex-col p-4">
          <h3 className="font-title text-lg font-semibold tracking-tight text-fg">
            {/* El enlace se estira sobre la tarjeta; los botones llevan z-10. */}
            <Link
              href={`/cycles/${cycle.id}`}
              className="transition-colors after:absolute after:inset-0 after:content-[''] hover:text-[color:var(--brand-text)]"
            >
              {cycle.name}
            </Link>
          </h3>

          <dl className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <div>
              <dt className="text-[11px] font-semibold text-fg-muted">Día</dt>
              <dd className="metric text-2xl text-fg">{days}</dd>
            </div>

            {typeof plantCount === 'number' && (
              <div>
                <dt className="text-[11px] font-semibold text-fg-muted">Plantas</dt>
                <dd className="metric text-2xl text-fg">{plantCount}</dd>
              </div>
            )}

            <div className="ml-auto min-w-0 text-right">
              <dt className="sr-only">Espacio</dt>
              <dd className="flex items-center justify-end gap-1.5 truncate text-xs text-fg-muted">
                <MapPin size={13} className="shrink-0" aria-hidden="true" />
                {cycle.spaces?.name || "Sin espacio"}
              </dd>
              <dd className="mt-0.5 text-[11px] text-fg-subtle">
                Desde el {new Date(cycle.start_date).toLocaleDateString('es-AR')}
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
            <button
              type="button"
              onClick={toggleStatus}
              disabled={loading}
              className="btn btn-sm btn-ghost relative z-10"
            >
              {loading
                ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                : cycle.is_active
                  ? <StopCircle size={14} aria-hidden="true" />
                  : <PlayCircle size={14} aria-hidden="true" />}
              {cycle.is_active ? "Finalizar" : "Reactivar"}
            </button>

            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="btn-icon btn-icon-sm relative z-10 text-[color:var(--danger)]"
              aria-label={`Eliminar ciclo ${cycle.name}`}
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </article>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleDelete}
        title="Eliminar ciclo"
        description={`Se eliminará "${cycle.name}" y su historial. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
      />
    </>
  );
}
