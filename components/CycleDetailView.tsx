"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Plant, CycleImage } from "@/app/lib/types";
import { getPlantMetrics, getStageColor } from "@/app/lib/utils";
import { Thermometer, CloudRain, Activity, Droplets, ArrowRight, LayoutGrid, List as ListIcon, Camera, X, Trash2, Archive } from "lucide-react";
import BulkStageModal from "./BulkStageModal";
import BulkArchiveModal from "./BulkArchiveModal";
import MeasurementModal from "./MeasurementModal";
import { useToast } from "@/app/context/ToastContext";
import { uploadCycleImage, deleteCycleImages, updateCycleImage } from "@/app/cycles/actions";
import imageCompression from 'browser-image-compression';

interface CycleDetailViewProps {
  cycle: { id: number; name: string; start_date: string; spaces: { name: string; type: string }; };
  plants: Plant[];
  lastMeasurement?: { temperature: number; humidity: number; date: string } | null;
  history: any[];
  cycleImages?: CycleImage[];
}

export default function CycleDetailView({ cycle, plants, lastMeasurement, cycleImages = [] }: CycleDetailViewProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<CycleImage | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Gallery Selection State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ignoreNextClick = useRef(false);

  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [selectedPlants, setSelectedPlants] = useState<number[]>([]);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [isMeasureModalOpen, setIsMeasureModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const activePlants = plants.filter(p => !p.is_archived);

  const handleImageTouchStart = (imageId: string) => {
    if (isSelectionMode) return;
    longPressTimerRef.current = setTimeout(() => {
      setIsSelectionMode(true);
      setSelectedImages((prev) => [...prev, imageId]);
      ignoreNextClick.current = true;
    }, 500);
  };

  const handleImageTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleImageClick = (image: CycleImage) => {
    if (ignoreNextClick.current) {
      ignoreNextClick.current = false;
      return;
    }

    if (isSelectionMode) {
      if (selectedImages.includes(image.id)) {
        const newSelection = selectedImages.filter((id) => id !== image.id);
        setSelectedImages(newSelection);
        if (newSelection.length === 0) setIsSelectionMode(false);
      } else {
        setSelectedImages([...selectedImages, image.id]);
      }
    } else {
      setSelectedImage(image);
    }
  };

  const handleSaveImageDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedImage) return;

    const form = e.target as HTMLFormElement;
    const dateInput = form.elements.namedItem('date') as HTMLInputElement;
    const descInput = form.elements.namedItem('description') as HTMLTextAreaElement;

    // We append T12:00:00 to avoid timezone shift issues when saving only YYYY-MM-DD
    const newDate = new Date(`${dateInput.value}T12:00:00`);

    const result = await updateCycleImage(selectedImage.id, {
        taken_at: newDate.toISOString(),
        description: descInput.value
    });

    if (result.success) {
        showToast("Imagen actualizada", "success");
        setSelectedImage(null);
    } else {
        showToast("Error al actualizar", "error");
    }
  };

  const handleDeleteImages = async () => {
    if (!confirm("¿Estás seguro de eliminar las fotos seleccionadas?")) return;

    const result = await deleteCycleImages(selectedImages);
    if (result.success) {
        showToast("Fotos eliminadas", "success");
        setSelectedImages([]);
        setIsSelectionMode(false);
    } else {
        showToast("Error al eliminar", "error");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setIsUploading(true);

      try {
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        };

        const compressedFile = await imageCompression(file, options);

        const formData = new FormData();
        formData.append('file', compressedFile);

        const result = await uploadCycleImage(cycle.id, formData);

        if (result.error) throw new Error(result.error);

        showToast('Foto subida correctamente', 'success');

      } catch (error) {
        console.error(error);
        showToast('Error al subir la foto', 'error');
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  };

  const vpd = lastMeasurement 
    ? ((0.61078 * Math.exp((17.27 * lastMeasurement.temperature) / (lastMeasurement.temperature + 237.3))) * (1 - (lastMeasurement.humidity / 100))).toFixed(2)
    : "-";

  const toggleSelectAll = () => {
    selectedPlants.length === activePlants.length ? setSelectedPlants([]) : setSelectedPlants(activePlants.map(p => p.id));
  };

  const toggleSelectPlant = (id: number) => {
    selectedPlants.includes(id) ? setSelectedPlants(selectedPlants.filter(p => p !== id)) : setSelectedPlants([...selectedPlants, id]);
  };

  return (
    <div className="space-y-6">
      {/* 1. DASHBOARD AMBIENTAL (KPIs con Iconos) */}
      <div className="grid grid-cols-3 gap-2">
        {/* Temperatura */}
        <div onClick={() => setIsMeasureModalOpen(true)} className="bg-card border border-card-border p-5 rounded-2xl flex items-center justify-between cursor-pointer hover:border-brand-primary/50 transition-colors group">
            <div>
                <p className="text-muted text-[10px] uppercase tracking-widest font-bold mb-1">Temperatura</p>
                <div className="text-3xl font-light font-title text-foreground">
                    {lastMeasurement ? `${lastMeasurement.temperature}°C` : "--"}
                </div>
            </div>
            <Thermometer className="text-brand-primary w-8 h-8 opacity-80 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
        </div>

        {/* Humedad */}
        <div className="bg-card border border-card-border p-5 rounded-2xl flex items-center justify-between">
            <div>
                <p className="text-muted text-[10px] uppercase tracking-widest font-bold mb-1">Humedad</p>
                <div className="text-3xl font-light font-title text-foreground">
                    {lastMeasurement ? `${lastMeasurement.humidity}%` : "--"}
                </div>
            </div>
            <CloudRain className="text-blue-500 w-8 h-8 opacity-80" strokeWidth={1.5} />
        </div>

        {/* VPD */}
        <div className="bg-card border border-card-border p-5 rounded-2xl flex items-center justify-between">
            <div>
                <p className="text-muted text-[10px] uppercase tracking-widest font-bold mb-1">VPD (kPa)</p>
                <div className={`text-3xl font-light font-title ${!lastMeasurement ? 'text-muted' : parseFloat(vpd) < 0.4 || parseFloat(vpd) > 1.6 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {lastMeasurement ? `${vpd}` : "--"}
                </div>
            </div>
            <Activity className="text-purple-500 w-8 h-8 opacity-80" strokeWidth={1.5} />
        </div>
      </div>

      {/* 2. TOOLBAR & LISTA */}
      <div className="bg-card border border-card-border p-4 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4 sticky top-4 z-30 shadow-sm shadow-black/50">
        <div className="flex items-center gap-4 w-full md:w-auto overflow-x-auto">
            <h2 className="text-foreground font-bold whitespace-nowrap text-sm">{selectedPlants.length} seleccionadas</h2>
            <div className="h-6 w-px bg-card-border"></div>
            <div className="flex gap-2">
                <button disabled={selectedPlants.length === 0} onClick={() => setIsArchiveModalOpen(true)} className="bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors disabled:opacity-30 flex items-center gap-1">
                    <Archive size={12} /> Archivar
                </button>
                <button disabled={selectedPlants.length === 0} onClick={() => setIsStageModalOpen(true)} className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors disabled:opacity-30 flex items-center gap-1">
                    <ArrowRight size={12} /> Etapa
                </button>
            </div>
        </div>

        <div className="flex bg-background p-1 rounded-lg border border-card-border">
            <button onClick={() => setViewMode('table')} className={`p-2 rounded transition-all ${viewMode === 'table' ? 'bg-slate-50 text-foreground' : 'text-muted hover:text-foreground'}`}><ListIcon size={16} /></button>
            <button onClick={() => setViewMode('grid')} className={`p-2 rounded transition-all ${viewMode === 'grid' ? 'bg-slate-50 text-foreground' : 'text-muted hover:text-foreground'}`}><LayoutGrid size={16} /></button>
        </div>
      </div>

      {/* 3. LISTA (TABLE) */}
      {viewMode === 'table' ? (
        <div className="overflow-x-auto bg-card border border-card-border rounded-2xl">
            <table className="w-full text-left text-sm">
                <thead className="bg-background text-muted uppercase text-[10px] font-bold tracking-widest">
                    <tr>
                        <th className="p-4 w-10"><input type="checkbox" onChange={toggleSelectAll} checked={selectedPlants.length === activePlants.length && activePlants.length > 0} className="rounded border-card-border bg-slate-50 accent-brand-primary" /></th>
                        <th className="p-4">Planta</th>
                        <th className="p-4">Etapa</th>
                        <th className="p-4">Días en Etapa</th>
                        <th className="p-4 text-right">Acción</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {activePlants.map(plant => {
                        const { currentStage, daysInCurrentStage } = getPlantMetrics(plant);
                        const rawStage = currentStage || plant.stage;
                        const displayStage = (rawStage === 'Esqueje' || rawStage === 'Plántula') ? 'Plántula' : rawStage;
                        const stageInfo = getStageColor(displayStage);

                        return (
                            <tr key={plant.id} className={`hover:bg-card-border transition-colors ${selectedPlants.includes(plant.id) ? 'bg-brand-primary/5' : ''}`}>
                                <td className="p-4"><input type="checkbox" checked={selectedPlants.includes(plant.id)} onChange={() => toggleSelectPlant(plant.id)} className="rounded border-card-border bg-slate-50 accent-brand-primary" /></td>
                                <td className="p-4 font-bold text-foreground flex items-center gap-3">
                                    <Link href={`/plants/${plant.id}`} className="hover:text-brand-primary hover:underline">{plant.name}</Link>
                                </td>
                                <td className="p-4"><span className={`text-[10px] px-2 py-1 rounded border uppercase font-bold ${stageInfo.bgColor} ${stageInfo.textColor} ${stageInfo.borderColor}`}>{displayStage}</span></td>
                                <td className="p-4 text-muted font-body">{isMounted ? daysInCurrentStage : <span className="opacity-0">0</span>} d</td>
                                <td className="p-4 text-right"><Link href={`/plants/${plant.id}`} className="text-xs font-bold text-brand-primary hover:text-foreground flex items-center justify-end gap-1">VER <ArrowRight size={10} /></Link></td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {activePlants.map(plant => {
                const { currentStage } = getPlantMetrics(plant);
                const rawStage = currentStage || plant.stage;
                const displayStage = (rawStage === 'Esqueje' || rawStage === 'Plántula') ? 'Plántula' : rawStage;
                const stageInfo = getStageColor(displayStage);

                return (
                    <div key={plant.id} onClick={() => toggleSelectPlant(plant.id)} className={`relative group bg-card border rounded-2xl overflow-hidden cursor-pointer transition-all ${selectedPlants.includes(plant.id) ? 'border-brand-primary ring-1 ring-brand-primary' : 'border-card-border hover:border-slate-500'}`}>
                        <div className="absolute top-2 left-2 z-10"><input type="checkbox" checked={selectedPlants.includes(plant.id)} readOnly className="w-5 h-5 accent-brand-primary" /></div>
                        <div className="aspect-square bg-slate-50 relative">
                             {(plant as any).image_url ? (
                                <Image src={(plant as any).image_url} alt="" fill className="object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                             ) : (
                                <div className={`flex items-center justify-center h-full ${stageInfo.textColor} opacity-20`}><LayoutGrid size={32} /></div>
                             )}
                        </div>
                        <div className="p-3">
                            <p className="font-bold text-foreground text-sm truncate">{plant.name}</p>
                            <p className={`text-[10px] uppercase font-bold ${stageInfo.textColor}`}>{displayStage}</p>
                        </div>
                    </div>
                );
            })}
        </div>
      )}

      {/* 4. GALERÍA DE CICLO (NUEVA SECCIÓN) */}
      <div className="bg-card border border-card-border p-6 rounded-2xl">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-foreground font-bold text-lg">Seguimiento del Indoor</h3>
            <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary border border-brand-primary/20 p-2 rounded-lg transition-colors disabled:opacity-50"
            >
                {isUploading ? <Activity className="animate-spin" size={20} /> : <Camera size={20} />}
            </button>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
            />
        </div>

        {cycleImages && cycleImages.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {cycleImages.map((img) => (
                    <div
                        key={img.id}
                        onMouseDown={() => handleImageTouchStart(img.id)}
                        onTouchStart={() => handleImageTouchStart(img.id)}
                        onTouchEnd={handleImageTouchEnd}
                        onMouseUp={handleImageTouchEnd}
                        onClick={() => handleImageClick(img)}
                        className={`relative flex-shrink-0 w-40 md:w-48 aspect-[3/4] bg-black rounded-xl overflow-hidden border snap-center cursor-pointer group transition-all duration-300 ${selectedImages.includes(img.id) ? 'border-brand-primary ring-2 ring-brand-primary' : 'border-card-border hover:border-brand-primary/50'}`}
                    >
                         {/* Selection Overlay */}
                         {isSelectionMode && (
                            <div className="absolute top-2 left-2 z-20">
                                <input
                                    type="checkbox"
                                    checked={selectedImages.includes(img.id)}
                                    readOnly
                                    className="w-5 h-5 accent-brand-primary rounded border-slate-300 bg-black/50 backdrop-blur-sm"
                                />
                            </div>
                         )}

                         <Image
                                src={img.public_url}
                                alt={img.description || "Foto del ciclo"}
                                fill
                                className={`object-cover transition-transform duration-500 ${selectedImages.includes(img.id) ? 'scale-105 opacity-60' : 'group-hover:scale-105'}`}
                         />
                         <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                            <p className="text-foreground text-xs font-bold">{new Date(img.taken_at).toLocaleDateString()}</p>
                            <p className="text-muted text-[10px]">Día {Math.floor((new Date(img.taken_at).getTime() - new Date(cycle.start_date).getTime()) / (1000 * 60 * 60 * 24))}</p>
                         </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="text-center py-10 border border-dashed border-card-border rounded-xl bg-card-border flex flex-col items-center justify-center">
                <Camera className="text-muted mb-2 opacity-50" size={32} />
                <p className="text-muted text-sm mb-1 font-bold">Sin fotos del ciclo</p>
                <p className="text-muted text-xs">Sube una foto para ver el progreso visual</p>
            </div>
        )}
      </div>

      {/* Lightbox / Detail Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedImage(null)}>
            <div className="bg-card border border-card-border rounded-2xl w-[90%] md:w-full max-w-md md:max-w-5xl h-auto md:h-[80vh] max-h-[85vh] overflow-y-auto md:overflow-hidden flex flex-col md:flex-row shadow-sm" onClick={(e) => e.stopPropagation()}>

                {/* Image Section */}
                <div className="relative w-full md:w-2/3 h-64 md:h-full shrink-0 bg-black flex items-center justify-center">
                     <Image
                        src={selectedImage.public_url}
                        alt="Detail"
                        fill
                        className="object-contain"
                    />
                     <button type="button" onClick={() => setSelectedImage(null)} className="absolute top-4 right-4 bg-black/50 p-2 rounded-full text-foreground z-10 hover:bg-card-border transition-colors">
                        <X size={20} />
                     </button>
                </div>

                {/* Form Section */}
                <div className="w-full md:w-1/3 p-4 md:p-6 flex flex-col h-auto md:h-full bg-card border-l border-card-border">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-foreground font-bold text-lg font-title">Detalles de la Foto</h3>
                    </div>

                    <form onSubmit={handleSaveImageDetails} className="flex flex-col gap-6 flex-1 h-full">
                        <div>
                            <label className="text-muted text-[10px] uppercase font-bold tracking-widest mb-2 block">Fecha</label>
                            <input
                                type="date"
                                name="date"
                                defaultValue={new Date(selectedImage.taken_at).toLocaleDateString('en-CA')}
                                className="w-full bg-background border border-card-border rounded-xl p-4 text-foreground focus:outline-none focus:border-brand-primary/50 transition-colors font-body text-sm"
                            />
                        </div>

                        <div className="flex-1 flex flex-col">
                            <label className="text-muted text-[10px] uppercase font-bold tracking-widest mb-2 block">Notas / Descripción</label>
                            <textarea
                                name="description"
                                defaultValue={selectedImage.description || ''}
                                placeholder="Escribe una nota sobre esta foto..."
                                rows={3}
                                className="w-full h-20 md:h-auto md:flex-1 bg-background border border-card-border rounded-xl p-4 text-foreground focus:outline-none focus:border-brand-primary/50 transition-colors resize-none font-body text-sm leading-relaxed"
                            />
                        </div>

                        <button
                            type="submit"
                            className="bg-brand-primary hover:bg-brand-primary/80 text-foreground font-bold py-4 rounded-xl transition-colors w-full mt-auto shadow-sm shadow-brand-primary/20"
                        >
                            Guardar Cambios
                        </button>
                    </form>
                </div>
            </div>
        </div>
      )}

      {/* SELECTION FAB */}
      {isSelectionMode && (
        <div className="fixed bottom-24 md:bottom-12 left-0 right-0 z-50 flex justify-center px-4 animate-in slide-in-from-bottom-4 duration-300">
            <div className="bg-slate-50 border border-card-border shadow-sm shadow-black rounded-full px-6 py-3 flex items-center gap-6 backdrop-blur-md">
                <span className="text-foreground font-bold text-sm">{selectedImages.length} seleccionadas</span>
                <div className="h-4 w-px bg-card-border"></div>
                <button
                    onClick={() => { setIsSelectionMode(false); setSelectedImages([]); }}
                    className="text-muted hover:text-foreground transition-colors"
                >
                    <X size={20} />
                </button>
                <button
                    onClick={handleDeleteImages}
                    disabled={selectedImages.length === 0}
                    className="bg-red-500/10 hover:bg-red-500/20 text-red-500 p-2 rounded-full transition-colors"
                >
                    <Trash2 size={20} />
                </button>
            </div>
        </div>
      )}

      {/* Modales */}
      <BulkArchiveModal isOpen={isArchiveModalOpen} onClose={() => setIsArchiveModalOpen(false)} selectedIds={selectedPlants} onSuccess={() => setSelectedPlants([])} cycleId={cycle.id} />
      <BulkStageModal isOpen={isStageModalOpen} onClose={() => setIsStageModalOpen(false)} selectedIds={selectedPlants} onSuccess={() => setSelectedPlants([])} cycleId={cycle.id} />
      <MeasurementModal isOpen={isMeasureModalOpen} onClose={() => setIsMeasureModalOpen(false)} cycleId={cycle.id} />
    </div>
  );
}