"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Check, MoreVertical, Trash2, Droplet, Pencil } from "lucide-react";
import { Plant } from "@/app/lib/types";
import { getStageColor, getPlantMetrics } from "@/app/lib/utils";

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
  const [isWatered, setIsWatered] = useState(lastWater === "Hoy");
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Lógica de Riego
  const handleWater = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('plants')
        .update({ last_water: 'Hoy' }) 
        .eq('id', id);
      if (error) throw error;
      setIsWatered(true);
      setTimeout(() => setIsWatered(false), 2000);
    } catch (error) {
      console.error("Error al regar:", error);
      alert("Hubo un error al guardar el riego");
    } finally {
      setLoading(false);
    }
  };

  // Borrar Planta
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const confirm = window.confirm(`¿Seguro que quieres eliminar a ${name}? Esta acción no se puede deshacer.`);
    
    if (!confirm) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('plants')
        .delete()
        .eq('id', id);

      if (error) throw error;
      router.refresh(); 
    } catch (error) {
      alert("Error al eliminar");
      setIsDeleting(false);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (selectionMode && onToggleSelection) {
        e.preventDefault();
        onToggleSelection();
    }
  };

  if (isDeleting) return null;

  const { currentStage, daysInCurrentStage, totalAge } = getPlantMetrics(plant);

  const rawStage = currentStage || stage;
  const displayStage = (rawStage === 'Esqueje' || rawStage === 'Plántula') ? 'Plántula' : rawStage;
  const stageInfo = getStageColor(displayStage);

  // Content wrapper to handle Link vs Div based on selection mode
  const ContentWrapper = ({ children }: { children: React.ReactNode }) => {
    if (selectionMode) {
        return <div onClick={handleCardClick} className="flex-1 flex flex-col p-3 min-w-0">{children}</div>;
    }
    return (
        <Link href={`/plants/${id}`} className="flex-1 flex flex-col p-3 min-w-0 hover:bg-slate-50 dark:hover:bg-card-border transition-colors">
            {children}
        </Link>
    );
  };

  return (
    <motion.div 
      className={`group relative flex flex-row bg-card dark:bg-[#12141C] border rounded-xl overflow-hidden h-28 transition-all duration-300 ${
        selectionMode && isSelected
          ? 'border-brand-primary ring-1 ring-brand-primary bg-brand-primary/5'
          : 'border-black/5 dark:border-card-border hover:border-brand-primary dark:hover:border-brand-primary'
      }`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      layout
      onClick={handleCardClick}
    >
        {/* Left Side: Image/Icon */}
        <div className="w-24 md:w-28 relative shrink-0 border-r border-card-border dark:border-slate-800 bg-black/20">
            {imageUrl ? (
                <Image
                    src={imageUrl}
                    alt={name}
                    fill
                    sizes="120px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
            ) : (
                <div className={`w-full h-full flex items-center justify-center ${stageInfo.bgColor}`}>
                    <span className="text-3xl">{stageInfo.icon}</span>
                </div>
            )}

            {/* Selection Overlay (Image Area) */}
            {selectionMode && (
                <div className={`absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-[1px] transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <div className={`rounded-full p-1 ${isSelected ? 'bg-brand-primary text-foreground' : 'border-2 border-card-border text-transparent'}`}>
                        <Check size={16} strokeWidth={3} />
                    </div>
                </div>
            )}
        </div>

        {/* Right Side: Info */}
        <div className="flex-1 flex flex-col min-w-0 relative">

            {/* Main Content */}
            <ContentWrapper>
                {/* Header: Name + Strain */}
                <div className="flex justify-between items-start gap-2 pr-6">
                    <div className="min-w-0">
                        <h3 className="font-bold text-brand-text text-base leading-tight truncate">{name}</h3>
                        {strain && (
                            <p className="text-xs text-brand-muted truncate mt-0.5">{strain}</p>
                        )}
                    </div>
                </div>

                {/* Badges: Stage */}
                <div className="mt-2">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${stageInfo.bgColor} ${stageInfo.textColor} ${stageInfo.borderColor}`}>
                        {stageInfo.icon} {displayStage}
                    </span>
                </div>

                {/* Metrics: Age & Cycle */}
                <div className="mt-auto pt-2 flex flex-col gap-1 text-xs text-brand-muted">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 font-medium text-foreground dark:text-slate-300">
                            📅 {isMounted ? totalAge : <span className="opacity-0">0</span>} días
                        </span>
                        {cycleName && (
                            <span className="truncate border-l border-card-border dark:border-slate-700 pl-3">
                                {cycleName}
                            </span>
                        )}
                    </div>
                    <span className="text-[10px] text-brand-muted">
                       en etapa de {displayStage} hace {isMounted ? daysInCurrentStage : <span className="opacity-0">0</span>} días
                    </span>
                </div>
            </ContentWrapper>

            {/* Actions (Absolute Top Right) - Only show if not in selection mode */}
            {!selectionMode && (
                <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1">
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowMenu(!showMenu);
                        }}
                        className="p-1.5 text-muted hover:text-foreground hover:bg-card-border rounded-lg transition-colors"
                    >
                        <MoreVertical size={16} />
                    </button>

                    <AnimatePresence>
                        {showMenu && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: -10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: -10 }}
                                className="absolute top-full right-0 mt-1 bg-card border border-card-border rounded-lg shadow-sm py-1 min-w-[120px] flex flex-col z-50 overflow-hidden"
                            >
                                <button
                                    onClick={handleWater}
                                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-card-border hover:text-blue-400 w-full text-left transition-colors"
                                >
                                    <Droplet size={14} className={isWatered ? "text-blue-500" : ""} />
                                    {isWatered ? 'Regada' : 'Regar'}
                                </button>

                                <Link
                                    href={`/plants/${id}`}
                                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-card-border hover:text-brand-primary w-full text-left transition-colors"
                                >
                                    <Pencil size={14} />
                                    Detalles
                                </Link>

                                <div className="h-px bg-card-border my-1" />

                                <button
                                    onClick={handleDelete}
                                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 w-full text-left transition-colors"
                                >
                                    <Trash2 size={14} />
                                    Eliminar
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
            
            {/* Overlay to close menu when clicking outside */}
            {showMenu && (
                <div
                    className="fixed inset-0 z-0"
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                    }}
                />
            )}
        </div>
    </motion.div>
  );
}
