"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import { PlayCircle, StopCircle, Trash2, MapPin, Calendar, ArrowRight } from "lucide-react";

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
  const [loading, setLoading] = useState(false);
  const latestImage = cycle.cycle_images?.[0]?.public_url;

  const handleCardClick = () => {
    router.push(`/cycles/${cycle.id}`);
  };

  const toggleStatus = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Evita entrar al ciclo al hacer click
    setLoading(true);
    try {
      await supabase.from('cycles').update({ is_active: !cycle.is_active }).eq('id', cycle.id);
      router.refresh();
    } catch (error) { alert("Error al actualizar estado"); } finally { setLoading(false); }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Evita entrar al ciclo
    if (!confirm("¿Eliminar ciclo y su historial?")) return;
    try { await supabase.from('cycles').delete().eq('id', cycle.id); router.refresh(); } catch (e) { alert("Error"); }
  };

  return (
    <div 
        onClick={handleCardClick}
        className={`group relative rounded-2xl p-6 border transition-all duration-300 cursor-pointer overflow-hidden ${
        cycle.is_active 
        ? 'bg-card dark:bg-[#12141C] border-black/5 dark:border-card-border hover:border-brand-primary/30 dark:hover:border-brand-primary/30'
        : 'bg-brand-bg border-black/5 dark:border-card-border opacity-60 hover:opacity-100'
    }`}>
      
      {latestImage && (
        <>
          <img
            src={latestImage}
            alt={cycle.name}
            className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-70 transition-opacity z-0"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0C10] via-[#0B0C10]/95 to-black/30 z-0" />
        </>
      )}

      {/* Botón Eliminar (Flotante) */}
      <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 z-20">
        <button onClick={handleDelete} className="p-2 bg-red-500/10 text-red-400 rounded-full hover:bg-red-500/20" title="Eliminar">
            <Trash2 size={16} />
        </button>
      </div>

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border flex items-center gap-1 ${
              cycle.is_active
              ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/20'
              : 'bg-slate-800 text-muted border-card-border dark:border-slate-700'
          }`}>
              {cycle.is_active ? <PlayCircle size={10} /> : <StopCircle size={10} />}
              {cycle.is_active ? 'Activo' : 'Archivado'}
          </span>
        </div>

        <h3 className={`text-2xl font-light font-title mb-2 group-hover:text-brand-primary transition-colors ${latestImage ? 'text-white' : 'text-brand-text'}`}>
            {cycle.name}
        </h3>

        <div className="space-y-2 mb-6">
            <div className={`flex items-center gap-2 text-xs font-body ${latestImage ? 'text-slate-300' : 'text-brand-muted'}`}>
                <MapPin size={14} />
                <span>{cycle.spaces?.name || "Sin espacio"}</span>
            </div>
            <div className={`flex items-center gap-2 text-xs font-body ${latestImage ? 'text-slate-300' : 'text-brand-muted'}`}>
                <Calendar size={14} />
                <span>Inicio: {new Date(cycle.start_date).toLocaleDateString()}</span>
            </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-brand-primary uppercase tracking-wider group-hover:translate-x-1 transition-transform">
            Entrar al Panel <ArrowRight size={14} />
        </div>

        {/* Acciones Rápidas Inferiores */}
        <div className="mt-4 pt-4 border-t border-card-border dark:border-slate-800 flex justify-end">
          <button
              onClick={toggleStatus}
              disabled={loading}
              className={`text-[10px] font-bold uppercase hover:text-brand-primary flex items-center gap-1 transition-colors ${latestImage ? 'text-muted hover:text-white' : 'text-brand-muted hover:text-brand-text'}`}
          >
              {cycle.is_active ? <StopCircle size={12} /> : <PlayCircle size={12} />}
              {cycle.is_active ? "Finalizar Ciclo" : "Reactivar Ciclo"}
          </button>
        </div>
      </div>
    </div>
  );
}