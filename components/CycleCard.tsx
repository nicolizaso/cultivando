"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import { PlayCircle, StopCircle, Trash2, MapPin, Calendar, ArrowRight } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/app/context/ToastContext";

interface CycleWithSpace {
  id: number;
  name: string;
  start_date: string;
  is_active: boolean;
  spaces: { name: string } | null;
  cycle_images?: { public_url: string }[];
}

export default function CycleCard({ cycle }: { cycle: CycleWithSpace }) {
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
      <article
        className={`surface-interactive group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] ${
          cycle.is_active ? "" : "opacity-75 hover:opacity-100"
        }`}
      >
        {latestImage && (
          <div className="relative h-32 w-full">
            <Image
              src={latestImage}
              alt=""
              fill
              sizes="(min-width: 1024px) 420px, 100vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          </div>
        )}

        <div className="flex flex-1 flex-col p-5">
          <div className="mb-3 flex items-start justify-between gap-2">
            <span
              className={`chip ${
                cycle.is_active
                  ? "border-[color:color-mix(in_srgb,var(--brand)_35%,transparent)] bg-brand-soft text-[color:var(--brand-text)]"
                  : "border-line bg-surface-3 text-fg-muted"
              }`}
            >
              {cycle.is_active
                ? <PlayCircle size={12} aria-hidden="true" />
                : <StopCircle size={12} aria-hidden="true" />}
              {cycle.is_active ? "Activo" : "Archivado"}
            </span>

            {/* Siempre visible: en táctil no existe el hover que antes lo revelaba */}
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="btn-icon relative z-10 h-9 min-h-9 w-9 min-w-9 text-[color:var(--danger)]"
              aria-label={`Eliminar ciclo ${cycle.name}`}
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>

          <h3 className="font-title text-xl font-semibold tracking-tight text-fg">
            {/* El enlace se estira sobre la tarjeta; los botones llevan z-10 */}
            <Link
              href={`/cycles/${cycle.id}`}
              className="transition-colors after:absolute after:inset-0 after:content-[''] hover:text-[color:var(--brand-text)]"
            >
              {cycle.name}
            </Link>
          </h3>

          <dl className="mt-3 space-y-1.5 text-xs text-fg-muted">
            <div className="flex items-center gap-2">
              <dt className="sr-only">Espacio</dt>
              <MapPin size={14} aria-hidden="true" />
              <dd>{cycle.spaces?.name || "Sin espacio"}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="sr-only">Fecha de inicio</dt>
              <Calendar size={14} aria-hidden="true" />
              <dd>Inicio: {new Date(cycle.start_date).toLocaleDateString('es-AR')}</dd>
            </div>
          </dl>

          <p className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-[color:var(--brand-text)]">
            Entrar al panel
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </p>

          <div className="mt-auto flex justify-end border-t border-line pt-3">
            <button
              type="button"
              onClick={toggleStatus}
              disabled={loading}
              className="btn btn-ghost relative z-10 h-9 min-h-9 px-3 text-xs"
            >
              {cycle.is_active
                ? <StopCircle size={14} aria-hidden="true" />
                : <PlayCircle size={14} aria-hidden="true" />}
              {cycle.is_active ? "Finalizar ciclo" : "Reactivar ciclo"}
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
