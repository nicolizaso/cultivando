"use client";

import { useEffect, useState } from "react";
import { Plant } from "@/app/lib/types";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sprout } from "lucide-react";
import { useToast } from "@/app/context/ToastContext";
import { useRouter } from "next/navigation";
import { getFirstSuggestion } from "@/app/lib/stage-logic";
import { getPlantMetrics } from "@/app/lib/plant-metrics";
import { changePlantStage } from "@/app/actions/plants";

interface StageSuggesterProps {
  plants: Plant[];
}

/** "Ahora no" se recuerda una semana por planta y etapa sugerida. */
const DISMISS_KEY = 'cultivando:sugerencias-descartadas';
const DISMISS_DAYS = 7;

type Dismissals = Record<string, number>;

function readDismissals(): Dismissals {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Dismissals) : {};
    const cutoff = Date.now() - DISMISS_DAYS * 24 * 60 * 60 * 1000;
    // Se limpian las vencidas para que la lista no crezca para siempre.
    return Object.fromEntries(Object.entries(parsed).filter(([, at]) => typeof at === 'number' && at > cutoff));
  } catch {
    return {};
  }
}

function saveDismissal(plantId: number, nextStage: string) {
  try {
    const dismissals = readDismissals();
    dismissals[`${plantId}:${nextStage}`] = Date.now();
    window.localStorage.setItem(DISMISS_KEY, JSON.stringify(dismissals));
  } catch {
    // Sin almacenamiento (modo privado) la sugerencia vuelve a aparecer: no es grave.
  }
}

export default function StageSuggester({ plants }: StageSuggesterProps) {
  const [suggestion, setSuggestion] = useState<{ plant: Plant; nextStage: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (plants.length === 0) return;

    // Un segundo de demora para que no aparezca encima de la carga.
    const timer = setTimeout(() => {
      const dismissals = readDismissals();
      setSuggestion(getFirstSuggestion(plants, new Date(), (id, next) => Boolean(dismissals[`${id}:${next}`])));
    }, 1000);
    return () => clearTimeout(timer);
  }, [plants]);

  const handleDismiss = () => {
    if (suggestion) saveDismissal(suggestion.plant.id, suggestion.nextStage);
    setSuggestion(null);
  };

  const handleConfirm = async () => {
    if (!suggestion || saving) return;
    setSaving(true);

    // El mismo camino que el cambio de etapa en lote: escribe la etapa, su
    // fecha y `stage_updated_at`. Antes se cambiaba sólo `stage` y, en una
    // planta con fechas cargadas, la tarjeta seguía mostrando la etapa vieja.
    const result = await changePlantStage(suggestion.plant.id, suggestion.nextStage);
    setSaving(false);

    if (!result.success) {
      showToast(result.error || "No se pudo actualizar la etapa", "error");
      return;
    }

    showToast(`${suggestion.plant.name} pasó a ${suggestion.nextStage}`);
    setSuggestion(null);
    router.refresh();
  };

  if (!suggestion) return null;

  const age = getPlantMetrics(suggestion.plant).totalAge;

  return (
    <AnimatePresence>
      <motion.div
        role="status"
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        /* Va por encima del botón flotante, no a su misma altura. */
        className="fixed inset-x-4 bottom-[calc(var(--nav-bottom)+5.5rem+env(safe-area-inset-bottom))] z-50 mx-auto w-auto max-w-sm lg:inset-x-auto lg:bottom-7 lg:right-7 lg:mx-0 lg:w-[22rem]"
      >
        <div className="surface flex flex-col gap-3 rounded-[var(--radius-lg)] p-4 shadow-[var(--shadow-lg)]">
          <div className="flex items-start gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[color:var(--brand-text)]"
              aria-hidden="true"
            >
              <Sprout size={20} />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-fg">Sugerencia de cultivo</h3>
              <p className="mt-1 text-sm leading-snug text-fg-muted">
                <span className="font-semibold text-fg">{suggestion.plant.name}</span> cumplió{' '}
                {age} días. ¿La pasamos a {suggestion.nextStage}?
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={handleDismiss} className="btn btn-sm btn-ghost">
              Ahora no
            </button>
            <button type="button" onClick={handleConfirm} disabled={saving} className="btn btn-sm btn-primary">
              Sí, actualizar
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
