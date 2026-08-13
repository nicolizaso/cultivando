"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { CalendarDays, Check, MoreVertical, Trash2, Droplet, Pencil } from "lucide-react";
import { Plant } from "@/app/lib/types";
import { getStageColor, getPlantMetrics } from "@/app/lib/utils";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/app/context/ToastContext";

interface PlantCardProps {
  plant: Plant;
  cycleName?: string;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: () => void;
}

export default function PlantCard({
  plant,
  cycleName,
  selectionMode = false,
  isSelected = false,
  onToggleSelection
}: PlantCardProps) {
  const { id, name, strain, stage, last_water: lastWater, image_url: imageUrl } = plant;
  const router = useRouter();
  const { showToast } = useToast();
  const reduceMotion = useReducedMotion();
  const [isWatered, setIsWatered] = useState(lastWater === "Hoy");
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Cierre del menú contextual por clic fuera o Escape.
  useEffect(() => {
    if (!showMenu) return;

    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowMenu(false);
        menuButtonRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showMenu]);

  const handleWater = async () => {
    if (loading) return;
    setLoading(true);
    setShowMenu(false);
    try {
      const { error } = await supabase
        .from('plants')
        .update({ last_water: 'Hoy' })
        .eq('id', id);
      if (error) throw error;
      setIsWatered(true);
      showToast(`Riego registrado en ${name}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudo registrar el riego", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from('plants')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setIsDeleting(true);
      showToast(`${name} eliminada`);
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudo eliminar la planta", "error");
    }
  };

  if (isDeleting) return null;

  const { currentStage, daysInCurrentStage, totalAge } = getPlantMetrics(plant);

  const rawStage = currentStage || stage;
  const displayStage = (rawStage === 'Esqueje' || rawStage === 'Plántula') ? 'Plántula' : rawStage;
  const stageInfo = getStageColor(displayStage);

  const content = (
    <>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold leading-tight text-fg">{name}</h3>
          {strain && <p className="mt-0.5 truncate text-xs text-fg-muted">{strain}</p>}
        </div>
      </div>

      <span className={`chip mt-2 w-fit ${stageInfo.bgColor} ${stageInfo.textColor} ${stageInfo.borderColor}`}>
        {stageInfo.icon}
        {displayStage}
      </span>

      <div className="mt-auto pt-2 text-xs text-fg-muted">
        <span className="flex items-center gap-1.5 font-medium text-fg">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          {/* Las edades se calculan con la fecha del cliente: hasta montar se
              reserva el espacio para no provocar un salto de layout. */}
          {isMounted ? `${totalAge} días` : <span className="opacity-0">0 días</span>}
          {cycleName && <span className="truncate border-l border-line pl-1.5 font-normal">{cycleName}</span>}
        </span>
        <span className="mt-0.5 block text-[11px] text-fg-subtle">
          En {displayStage.toLowerCase()} hace {isMounted ? daysInCurrentStage : 0} días
        </span>
      </div>
    </>
  );

  return (
    <>
      <motion.div
        className={`group relative flex h-28 flex-row overflow-hidden rounded-[var(--radius-lg)] border bg-surface transition-colors ${
          selectionMode && isSelected
            ? 'border-[color:var(--brand)] ring-1 ring-[color:var(--brand)]'
            : 'border-line hover:border-line-strong'
        }`}
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        layout={!reduceMotion}
      >
        <div className="relative w-24 shrink-0 border-r border-line bg-surface-2 md:w-28">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt=""
              fill
              sizes="120px"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className={`flex h-full w-full items-center justify-center ${stageInfo.bgColor} ${stageInfo.textColor}`}>
              <span className="text-3xl">{stageInfo.icon}</span>
            </div>
          )}

          {selectionMode && (
            <span
              className={`absolute inset-0 z-20 flex items-center justify-center bg-[color-mix(in_srgb,var(--fg)_45%,transparent)] transition-opacity ${
                isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
              aria-hidden="true"
            >
              <span
                className={`rounded-full p-1 ${
                  isSelected
                    ? 'bg-brand text-[color:var(--brand-fg)]'
                    : 'border-2 border-white/70 text-transparent'
                }`}
              >
                <Check size={16} strokeWidth={3} />
              </span>
            </span>
          )}
        </div>

        <div className="relative flex min-w-0 flex-1 flex-col">
          {selectionMode ? (
            <button
              type="button"
              onClick={onToggleSelection}
              aria-pressed={isSelected}
              className="flex min-w-0 flex-1 flex-col p-3 text-left"
            >
              {content}
            </button>
          ) : (
            <Link
              href={`/plants/${id}`}
              className="flex min-w-0 flex-1 flex-col p-3 pr-11 transition-colors hover:bg-surface-2"
            >
              {content}
            </Link>
          )}

          {!selectionMode && (
            <div ref={menuRef} className="absolute right-1.5 top-1.5 z-10">
              <button
                ref={menuButtonRef}
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                aria-expanded={showMenu}
                aria-haspopup="menu"
                aria-label={`Acciones para ${name}`}
                className="btn-icon h-9 min-h-9 w-9 min-w-9"
              >
                <MoreVertical size={16} aria-hidden="true" />
              </button>

              <AnimatePresence>
                {showMenu && (
                  <motion.div
                    role="menu"
                    aria-label={`Acciones para ${name}`}
                    initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -6 }}
                    transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute right-0 top-full z-50 mt-1 flex min-w-[150px] flex-col overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface py-1 shadow-[var(--shadow-lg)]"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleWater}
                      disabled={loading}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-fg transition-colors hover:bg-surface-3 disabled:opacity-50"
                    >
                      <Droplet
                        size={14}
                        className={isWatered ? "text-[color:var(--info)]" : ""}
                        aria-hidden="true"
                      />
                      {isWatered ? 'Regada hoy' : 'Regar'}
                    </button>

                    <Link
                      href={`/plants/${id}`}
                      role="menuitem"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-fg transition-colors hover:bg-surface-3"
                    >
                      <Pencil size={14} aria-hidden="true" />
                      Detalles
                    </Link>

                    <span className="my-1 h-px bg-[color:var(--border)]" aria-hidden="true" />

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setShowMenu(false);
                        setShowConfirm(true);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[color:var(--danger)] transition-colors hover:bg-[color:var(--danger-soft)]"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      Eliminar
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleDelete}
        title="Eliminar planta"
        description={`Se eliminará "${name}" y su historial. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
      />
    </>
  );
}
