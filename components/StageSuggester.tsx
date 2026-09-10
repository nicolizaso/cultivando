"use client";

import { useEffect, useState } from "react";
import { Plant } from "@/app/lib/types";
import { supabase } from "@/app/lib/supabase";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sprout } from "lucide-react";
import { useToast } from "@/app/context/ToastContext";
import { useRouter } from "next/navigation";
import { getFirstSuggestion } from "@/app/lib/stage-logic";

interface StageSuggesterProps {
  plants: Plant[];
}

export default function StageSuggester({ plants }: StageSuggesterProps) {
  const [suggestion, setSuggestion] = useState<{ plant: Plant; nextStage: string } | null>(null);
  const router = useRouter();
  const { showToast } = useToast();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    // Check for suggestions
    // We check one by one. If multiple match, we just show the first one found.
    // In a real app we might want to queue them or show a list.

    const checkPlants = () => {
        // Check local storage to see if we dismissed this recently (optional requirement)
        // For now, I'll skip the "remembers not to ask again" part to keep it simple as per "optional".

        const foundSuggestion = getFirstSuggestion(plants);
        if (foundSuggestion) {
            setSuggestion(foundSuggestion);
        }
    };

    if (plants.length > 0) {
        // Add a small delay so it doesn't pop up immediately on load
        const timer = setTimeout(checkPlants, 1000);
        return () => clearTimeout(timer);
    }
  }, [plants]);

  const handleDismiss = () => {
    setSuggestion(null);
    // Here we could save to localStorage to ignore this plant for X days
  };

  const handleConfirm = async () => {
    if (!suggestion) return;

    try {
      const { error } = await supabase
        .from('plants')
        .update({ stage: suggestion.nextStage })
        .eq('id', suggestion.plant.id);

      if (error) throw error;

      // Ideally we should refresh the data.
      // Since this is a client component, we can use router.refresh() if available,
      // but passing a callback from parent would be better.
      // However, for simplicity, we'll just close it. The parent should eventually re-fetch.
      // Actually, updating Supabase directly won't update the UI until a refresh.

      // Use router.refresh() to re-fetch server components without full page reload
      router.refresh();
      // Also close the modal
      setSuggestion(null);

    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudo actualizar la etapa", "error");
    } finally {
      setSuggestion(null);
    }
  };

  if (!suggestion) return null;

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
                {suggestion.plant.current_age_days ?? suggestion.plant.days ?? 0} días.
                ¿La pasamos a {suggestion.nextStage}?
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={handleDismiss} className="btn btn-sm btn-ghost">
              Ahora no
            </button>
            <button type="button" onClick={handleConfirm} className="btn btn-sm btn-primary">
              Sí, actualizar
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
