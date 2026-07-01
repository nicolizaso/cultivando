"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import { Space } from "@/app/lib/types";
import { Warehouse, Sun, Trash2, Tent, Maximize, Wind } from "lucide-react";

interface SpaceCardProps {
  space: Space;
  onClick?: () => void;
}

export default function SpaceCard({ space, onClick }: SpaceCardProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`¿Eliminar "${space.name}"?`)) return;
    setIsDeleting(true);
    try {
      await supabase.from('spaces').delete().eq('id', space.id);
      router.refresh();
    } catch (error) { alert("Error al eliminar"); setIsDeleting(false); }
  };

  if (isDeleting) return null;

  // Iconos dinámicos
  const getSpaceIcon = () => {
    switch(space.type) {
      case 'Indoor': return <Warehouse className="text-blue-400" size={24} />;
      case 'Outdoor': return <Sun className="text-amber-400" size={24} />;
      default: return <Tent className="text-purple-400" size={24} />;
    }
  };

  // Generate Summary Component
  const renderTechnicalSummary = () => {
    const hasLight = space.light_type || space.light_watts;
    const hasDims = space.width || space.length || space.area_m2;
    const hasVent = space.vent_extraction || space.vent_intraction;

    if (!hasLight && !hasDims && !hasVent) {
      return <p className="text-xs text-muted mt-1 font-body">Configurar espacio</p>;
    }

    return (
       <div className="flex flex-wrap gap-3 mt-2">
          {/* Light */}
          {hasLight && (
             <div className="flex items-center gap-1 text-amber-400/80" title="Iluminación">
                <Sun size={14} />
                <span className="text-xs font-mono">
                   {[space.light_type, space.light_watts ? `${space.light_watts}W` : ''].filter(Boolean).join(' ')}
                </span>
             </div>
          )}

          {/* Dimensions */}
          {hasDims && (
             <div className="flex items-center gap-1 text-brand-primary/80" title="Dimensiones">
                <Maximize size={14} />
                <span className="text-xs font-mono">
                   {space.width && space.length ? `${space.width}x${space.length}m` : `${space.area_m2}m²`}
                </span>
             </div>
          )}

          {/* Ventilation */}
           {hasVent && (
             <div className="flex items-center gap-1 text-blue-400/80" title="Ventilación">
                <Wind size={14} />
                <span className="text-xs font-mono">
                   {space.vent_extraction || space.vent_intraction}m³/h
                </span>
             </div>
          )}
       </div>
    );
  };

  return (
    <div
      onClick={onClick}
      className={`group bg-card dark:bg-[#12141C] border border-black/5 dark:border-card-border rounded-2xl p-6 hover:border-brand-primary/30 transition-all duration-300 relative overflow-hidden ${onClick ? 'cursor-pointer' : ''}`}
    >
        
        {/* Fondo decorativo */}
        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity z-20">
             <button onClick={handleDelete} className="p-2 bg-red-500/10 text-red-400 rounded-full hover:bg-red-500/20">
                <Trash2 size={16} />
             </button>
        </div>

        <div className="flex items-start gap-4 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-brand-bg border border-card-border dark:border-slate-800 flex items-center justify-center shrink-0">
             {getSpaceIcon()}
          </div>
          <div>
            <h3 className="text-xl font-light font-title text-brand-text">{space.name}</h3>
            {/* Summary Line */}
            {renderTechnicalSummary()}
          </div>
        </div>
        
        {/* Barra decorativa */}
        <div className="mt-6 pt-4 border-t border-card-border dark:border-slate-800 flex justify-between items-center">
             <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-brand-muted border border-card-border dark:border-slate-800 px-2 py-0.5 rounded-md">
                {space.type}
            </span>
            <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse"></div>
            </div>
        </div>
    </div>
  );
}
