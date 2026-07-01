"use client";

import { useEffect, useState } from "react";
import { Plant } from "@/app/lib/types";
import { supabase } from "@/app/lib/supabase";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { getFirstSuggestion } from "@/app/lib/stage-logic";

// I'll assume Toast.tsx is a component I can't just call imperatively unless it has a context or similar.
// Since I don't see a ToastContext, I'll build a simple dismissible alert inside this component
// and render it fixed on the screen.

interface StageSuggesterProps {
  plants: Plant[];
}

export default function StageSuggester({ plants }: StageSuggesterProps) {
  const [suggestion, setSuggestion] = useState<{ plant: Plant; nextStage: string } | null>(null);
  const router = useRouter();

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
      console.error("Error updating stage:", error);
      alert("Error al actualizar la etapa.");
    } finally {
      setSuggestion(null);
    }
  };

  if (!suggestion) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="fixed z-50 bottom-24 left-0 right-0 mx-auto w-[92%] md:bottom-8 md:right-8 md:left-auto md:mx-0 md:w-96"
      >
        <div className="bg-card border border-brand-primary/20 shadow-sm rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden">
            {/* Background effect */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>

            <div className="flex items-start gap-3 relative z-10">
                <div className="bg-brand-primary/20 p-2 rounded-full text-brand-primary">
                    <span className="text-xl">🌱</span>
                </div>
                <div>
                    <h3 className="font-bold text-foreground text-sm uppercase tracking-wide">Sugerencia de Cultivo</h3>
                    <p className="text-foreground text-sm mt-1">
                        <span className="text-brand-primary font-bold">{suggestion.plant.name}</span> ha cumplido <span className="font-bold text-foreground">{suggestion.plant.current_age_days ?? suggestion.plant.days ?? 0} días</span>.
                        <br/>
                        ¿Pasar a etapa <span className="font-bold text-foreground">{suggestion.nextStage}</span>?
                    </p>
                </div>
            </div>

            <div className="flex gap-2 justify-end mt-2 relative z-10">
                <button
                    onClick={handleDismiss}
                    className="px-4 py-2 rounded-lg text-xs font-bold text-muted hover:text-foreground hover:bg-card-border transition-colors uppercase"
                >
                    No, esperar
                </button>
                <button
                    onClick={handleConfirm}
                    className="bg-brand-primary hover:bg-brand-primary-hover text-brand-bg px-4 py-2 rounded-lg text-xs font-bold shadow-sm shadow-brand-primary/20 transition-colors uppercase"
                >
                    Sí, actualizar
                </button>
            </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );

}
