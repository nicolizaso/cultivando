"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check, MoreVertical, Trash2, Droplet, ArrowUpRight } from "lucide-react";
import { Plant } from "@/app/lib/types";
import { getStageColor, getPlantMetrics, getWaterStatus } from "@/app/lib/utils";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/app/context/ToastContext";

interface PlantCardProps {
  plant: Plant;
  cycleName?: string;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: () => void;
}

const WATER_TONE = {
  ok: "text-fg-muted",
  warn: "text-[color:var(--warning)]",
  late: "text-[color:var(--danger)]",
  unknown: "text-fg-subtle",
} as const;

export default function PlantCard({
  plant,
  cycleName,
  selectionMode = false,
  isSelected = false,
  onToggleSelection
}: PlantCardProps) {
  const { id, name, strain, stage, image_url: imageUrl } = plant;
  const router = useRouter();
  const { showToast } = useToast();
  const reduceMotion = useReducedMotion();
  const [lastWater, setLastWater] = useState<string | null | undefined>(plant.last_water);
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

    // Se guarda la fecha, no la palabra "Hoy": ese valor heredado se quedaba
    // congelado y la ficha de la planta no podía calcular los días de atraso.
    const today = new Date().toLocaleDateString('en-CA');

    try {
      const { error } = await supabase
        .from('plants')
        .update({ last_water: today })
        .eq('id', id);
      if (error) throw error;
      setLastWater(today);
      showToast(`Riego registrado en ${name}`);
      router.refresh();
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
  const water = getWaterStatus(lastWater);

  const content = (
    <>
      <div className="min-w-0">
        <h3 className="truncate text-[15px] font-semibold leading-tight text-fg">{name}</h3>
        <p className="mt-0.5 truncate text-xs text-fg-muted">
          {strain || 'Genética sin cargar'}
          {cycleName && <span className="text-fg-subtle"> · {cycleName}</span>}
        </p>
      </div>

      <span className={`chip mt-2.5 w-fit ${stageInfo.bgColor} ${stageInfo.textColor} ${stageInfo.borderColor}`}>
        {stageInfo.icon}
        {displayStage}
      </span>

      <div className="mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-2.5 text-[11px]">
        {/* Las edades se calculan con la fecha del cliente: hasta montar se
            reserva el hueco para no provocar un salto de layout. */}
        <span className="font-medium text-fg">
          <span className="mono" suppressHydrationWarning>{isMounted ? totalAge : 0}</span> días
        </span>

        <span className="text-fg-subtle">
          <span className="mono" suppressHydrationWarning>{isMounted ? daysInCurrentStage : 0}</span> en etapa
        </span>

        <span className={`flex items-center gap-1 ${WATER_TONE[water.level]}`}>
          <Droplet className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="sr-only">Riego: </span>
          {water.label}
        </span>
      </div>
    </>
  );

  return (
    <>
      <motion.article
        className={`group relative flex h-[132px] flex-row overflow-hidden rounded-[var(--radius-lg)] border bg-surface shadow-[var(--shadow-sm)] transition-colors ${
          selectionMode && isSelected
            ? 'border-[color:var(--brand)] ring-1 ring-[color:var(--brand)]'
            : 'border-line hover:border-line-strong'
        }`}
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        layout={!reduceMotion}
      >
        <div className="relative w-[88px] shrink-0 border-r border-line bg-surface-2 sm:w-[104px]">
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
              <span className="text-[30px]" aria-hidden="true">{stageInfo.icon}</span>
            </div>
          )}

          {selectionMode && (
            <span
              className={`absolute inset-0 z-20 flex items-center justify-center bg-[color:var(--scrim)] transition-opacity ${
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
              className="flex min-w-0 flex-1 flex-col p-3.5 text-left"
            >
              {content}
            </button>
          ) : (
            <Link
              href={`/plants/${id}`}
              className="flex min-w-0 flex-1 flex-col p-3.5 pr-11 transition-colors hover:bg-surface-2"
            >
              {content}
              <ArrowUpRight
                className="absolute bottom-3 right-3 h-4 w-4 text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden="true"
              />
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
                className="btn-icon btn-icon-sm"
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
                    className="absolute right-0 top-full z-50 mt-1 flex min-w-[168px] flex-col overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface py-1 shadow-[var(--shadow-lg)]"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleWater}
                      disabled={loading || water.days === 0}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs font-medium text-fg transition-colors hover:bg-surface-3 disabled:opacity-50"
                    >
                      <Droplet
                        size={14}
                        className={water.days === 0 ? "text-[color:var(--info)]" : ""}
                        aria-hidden="true"
                      />
                      {water.days === 0 ? 'Ya regada hoy' : 'Registrar riego'}
                    </button>

                    <Link
                      href={`/plants/${id}`}
                      role="menuitem"
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs font-medium text-fg transition-colors hover:bg-surface-3"
                    >
                      <ArrowUpRight size={14} aria-hidden="true" />
                      Ver la ficha
                    </Link>

                    <span className="my-1 h-px bg-[color:var(--border)]" aria-hidden="true" />

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setShowMenu(false);
                        setShowConfirm(true);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs font-medium text-[color:var(--danger)] transition-colors hover:bg-[color:var(--danger-soft)]"
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
      </motion.article>

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
