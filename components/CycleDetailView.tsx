"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Plant, CycleImage } from "@/app/lib/types";
import { getPlantMetrics, getStageColor } from "@/app/lib/utils";
import { Thermometer, CloudRain, Activity, ArrowRight, LayoutGrid, List as ListIcon, Camera, X, Trash2, Archive, Loader2 } from "lucide-react";
import BulkStageModal from "./BulkStageModal";
import BulkArchiveModal from "./BulkArchiveModal";
import MeasurementModal from "./MeasurementModal";
import { useToast } from "@/app/context/ToastContext";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
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
  const [showDeleteImagesConfirm, setShowDeleteImagesConfirm] = useState(false);

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
      {/* 1. Clima del espacio */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => setIsMeasureModalOpen(true)}
          className="surface-interactive flex items-center justify-between gap-3 rounded-[var(--radius-lg)] p-5 text-left"
        >
          <span>
            <span className="mb-1 block text-xs font-semibold text-fg-muted">Temperatura</span>
            <span className="block font-title text-3xl font-semibold text-fg">
              {lastMeasurement ? `${lastMeasurement.temperature}°C` : "--"}
            </span>
          </span>
          <Thermometer className="h-7 w-7 shrink-0 text-[color:var(--brand-text)]" strokeWidth={1.5} aria-hidden="true" />
        </button>

        <div className="surface flex items-center justify-between gap-3 rounded-[var(--radius-lg)] p-5">
          <div>
            <p className="mb-1 text-xs font-semibold text-fg-muted">Humedad</p>
            <p className="font-title text-3xl font-semibold text-fg">
              {lastMeasurement ? `${lastMeasurement.humidity}%` : "--"}
            </p>
          </div>
          <CloudRain className="h-7 w-7 shrink-0 text-[color:var(--info)]" strokeWidth={1.5} aria-hidden="true" />
        </div>

        <div className="surface flex items-center justify-between gap-3 rounded-[var(--radius-lg)] p-5">
          <div>
            <p className="mb-1 text-xs font-semibold text-fg-muted">VPD (kPa)</p>
            <p
              className={`font-title text-3xl font-semibold ${
                !lastMeasurement
                  ? 'text-fg-muted'
                  : parseFloat(vpd) < 0.4 || parseFloat(vpd) > 1.6
                    ? 'text-[color:var(--danger)]'
                    : 'text-[color:var(--success)]'
              }`}
            >
              {lastMeasurement ? `${vpd}` : "--"}
            </p>
          </div>
          <Activity className="h-7 w-7 shrink-0 text-[color:var(--stage-bloom)]" strokeWidth={1.5} aria-hidden="true" />
        </div>
      </div>

      {/* 2. Barra de acciones sobre la selección */}
      <div className="surface sticky top-20 z-30 flex flex-col items-stretch justify-between gap-3 rounded-[var(--radius-lg)] p-3 md:flex-row md:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <p className="px-1 text-sm font-semibold text-fg" aria-live="polite">
            {selectedPlants.length} seleccionadas
          </p>

          <button
            type="button"
            disabled={selectedPlants.length === 0}
            onClick={() => setIsArchiveModalOpen(true)}
            className="btn btn-secondary h-10 min-h-10 px-3 text-xs"
          >
            <Archive size={14} aria-hidden="true" />
            Archivar
          </button>
          <button
            type="button"
            disabled={selectedPlants.length === 0}
            onClick={() => setIsStageModalOpen(true)}
            className="btn btn-secondary h-10 min-h-10 px-3 text-xs"
          >
            <ArrowRight size={14} aria-hidden="true" />
            Cambiar etapa
          </button>
        </div>

        <div role="group" aria-label="Modo de vista" className="flex gap-1 self-end rounded-[var(--radius-md)] border border-line bg-surface-2 p-1">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            aria-pressed={viewMode === 'table'}
            aria-label="Ver como lista"
            className={`flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] transition-colors ${
              viewMode === 'table' ? 'bg-brand text-[color:var(--brand-fg)]' : 'text-fg-muted hover:text-fg'
            }`}
          >
            <ListIcon size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            aria-pressed={viewMode === 'grid'}
            aria-label="Ver como cuadrícula"
            className={`flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] transition-colors ${
              viewMode === 'grid' ? 'bg-brand text-[color:var(--brand-fg)]' : 'text-fg-muted hover:text-fg'
            }`}
          >
            <LayoutGrid size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* 3. Plantas del ciclo */}
      {viewMode === 'table' ? (
        <div className="surface overflow-x-auto rounded-[var(--radius-lg)]">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Plantas activas del ciclo {cycle.name}</caption>
            <thead className="border-b border-line bg-surface-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">
              <tr>
                <th scope="col" className="w-12 p-4">
                  <input
                    type="checkbox"
                    onChange={toggleSelectAll}
                    checked={selectedPlants.length === activePlants.length && activePlants.length > 0}
                    aria-label="Seleccionar todas las plantas"
                    className="h-4 w-4 accent-[color:var(--brand)]"
                  />
                </th>
                <th scope="col" className="p-4">Planta</th>
                <th scope="col" className="p-4">Etapa</th>
                <th scope="col" className="p-4">Días en etapa</th>
                <th scope="col" className="p-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {activePlants.map(plant => {
                const { currentStage, daysInCurrentStage } = getPlantMetrics(plant);
                const rawStage = currentStage || plant.stage;
                const displayStage = (rawStage === 'Esqueje' || rawStage === 'Plántula') ? 'Plántula' : rawStage;
                const stageInfo = getStageColor(displayStage);

                return (
                  <tr
                    key={plant.id}
                    className={`border-b border-line last:border-0 ${
                      selectedPlants.includes(plant.id) ? 'bg-brand-soft' : ''
                    }`}
                  >
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedPlants.includes(plant.id)}
                        onChange={() => toggleSelectPlant(plant.id)}
                        aria-label={`Seleccionar ${plant.name}`}
                        className="h-4 w-4 accent-[color:var(--brand)]"
                      />
                    </td>
                    <td className="p-4 font-semibold text-fg">
                      <Link href={`/plants/${plant.id}`} className="hover:text-[color:var(--brand-text)] hover:underline">
                        {plant.name}
                      </Link>
                    </td>
                    <td className="p-4">
                      <span className={`chip ${stageInfo.bgColor} ${stageInfo.textColor} ${stageInfo.borderColor}`}>
                        {stageInfo.icon}
                        {displayStage}
                      </span>
                    </td>
                    <td className="p-4 text-fg-muted">
                      {isMounted ? `${daysInCurrentStage} d` : <span className="opacity-0">0 d</span>}
                    </td>
                    <td className="p-4 text-right">
                      <Link
                        href={`/plants/${plant.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--brand-text)] hover:underline"
                      >
                        Ver
                        <ArrowRight size={12} aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
          {activePlants.map(plant => {
            const { currentStage } = getPlantMetrics(plant);
            const rawStage = currentStage || plant.stage;
            const displayStage = (rawStage === 'Esqueje' || rawStage === 'Plántula') ? 'Plántula' : rawStage;
            const stageInfo = getStageColor(displayStage);
            const isSelected = selectedPlants.includes(plant.id);

            return (
              <li key={plant.id}>
                {/* Casilla real envolviendo la tarjeta: seleccionable con teclado */}
                <label
                  className={`group relative block cursor-pointer overflow-hidden rounded-[var(--radius-lg)] border bg-surface transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[color:var(--ring)] ${
                    isSelected ? 'border-[color:var(--brand)] ring-1 ring-[color:var(--brand)]' : 'border-line hover:border-line-strong'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelectPlant(plant.id)}
                    className="sr-only"
                  />
                  <span className="absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded border border-line-strong bg-surface" aria-hidden="true">
                    {isSelected && <span className="h-3 w-3 rounded-sm bg-brand" />}
                  </span>

                  <span className={`relative block aspect-square ${stageInfo.bgColor}`}>
                    {(plant as any).image_url ? (
                      <Image src={(plant as any).image_url} alt="" fill sizes="200px" className="object-cover" />
                    ) : (
                      <span className={`flex h-full items-center justify-center ${stageInfo.textColor}`}>
                        <LayoutGrid size={28} aria-hidden="true" />
                      </span>
                    )}
                  </span>

                  <span className="block p-3">
                    <span className="block truncate text-sm font-semibold text-fg">{plant.name}</span>
                    <span className={`block text-xs font-semibold ${stageInfo.textColor}`}>{displayStage}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {/* 4. Galería del ciclo */}
      <section aria-labelledby="galeria" className="surface rounded-[var(--radius-lg)] p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 id="galeria" className="font-title text-lg font-semibold text-fg">Seguimiento visual</h3>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="btn btn-secondary h-10 min-h-10 px-3 text-xs"
          >
            {isUploading ? (
              <Loader2 className="animate-spin" size={16} aria-hidden="true" />
            ) : (
              <Camera size={16} aria-hidden="true" />
            )}
            {isUploading ? 'Subiendo...' : 'Subir foto'}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="sr-only"
            aria-label="Subir foto del ciclo"
          />
        </div>

        {cycleImages && cycleImages.length > 0 ? (
          <ul className="custom-scrollbar flex snap-x gap-4 overflow-x-auto pb-3">
            {cycleImages.map((img) => {
              const isSelected = selectedImages.includes(img.id);
              const dayNumber = Math.floor((new Date(img.taken_at).getTime() - new Date(cycle.start_date).getTime()) / (1000 * 60 * 60 * 24));

              return (
                <li key={img.id} className="shrink-0 snap-center">
                  <button
                    type="button"
                    onMouseDown={() => handleImageTouchStart(img.id)}
                    onTouchStart={() => handleImageTouchStart(img.id)}
                    onTouchEnd={handleImageTouchEnd}
                    onMouseUp={handleImageTouchEnd}
                    onClick={() => handleImageClick(img)}
                    aria-pressed={isSelectionMode ? isSelected : undefined}
                    aria-label={
                      isSelectionMode
                        ? `Seleccionar foto del día ${dayNumber}`
                        : `Ver foto del día ${dayNumber}`
                    }
                    className={`group relative block aspect-[3/4] w-40 overflow-hidden rounded-[var(--radius-md)] border transition-colors md:w-48 ${
                      isSelected
                        ? 'border-[color:var(--brand)] ring-2 ring-[color:var(--brand)]'
                        : 'border-line hover:border-line-strong'
                    }`}
                  >
                    {isSelectionMode && (
                      <span
                        className="absolute left-2 top-2 z-20 flex h-5 w-5 items-center justify-center rounded border border-line-strong bg-surface"
                        aria-hidden="true"
                      >
                        {isSelected && <span className="h-3 w-3 rounded-sm bg-brand" />}
                      </span>
                    )}

                    <Image
                      src={img.public_url}
                      alt={img.description || ""}
                      fill
                      sizes="192px"
                      className={`object-cover transition-transform duration-500 ${isSelected ? 'scale-105 opacity-70' : 'group-hover:scale-105'}`}
                    />

                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3 text-left">
                      <span className="block text-xs font-semibold text-white">
                        {new Date(img.taken_at).toLocaleDateString('es-AR')}
                      </span>
                      <span className="block text-[11px] text-white/80">Día {dayNumber}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-[var(--radius-md)] border border-dashed border-line-strong py-10 text-center">
            <Camera className="mb-2 text-fg-subtle" size={28} aria-hidden="true" />
            <p className="text-sm font-semibold text-fg">Sin fotos del ciclo</p>
            <p className="mt-1 text-xs text-fg-muted">Subí una foto para seguir el progreso visual.</p>
          </div>
        )}
      </section>

      {/* Detalle de la foto */}
      <Modal
        isOpen={!!selectedImage}
        onClose={() => setSelectedImage(null)}
        title="Detalles de la foto"
        size="xl"
        footer={
          <button type="submit" form="image-details-form" className="btn btn-primary">
            Guardar cambios
          </button>
        }
      >
        {selectedImage && (
          <div className="space-y-5">
            <div className="relative h-64 w-full overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface-2 md:h-80">
              <Image
                src={selectedImage.public_url}
                alt={selectedImage.description || "Foto del ciclo"}
                fill
                sizes="(min-width: 768px) 640px, 100vw"
                className="object-contain"
              />
            </div>

            <form id="image-details-form" onSubmit={handleSaveImageDetails} className="space-y-5">
              <div className="field">
                <label htmlFor="image-date" className="field-label">Fecha</label>
                <input
                  id="image-date"
                  type="date"
                  name="date"
                  data-autofocus
                  defaultValue={new Date(selectedImage.taken_at).toLocaleDateString('en-CA')}
                  className="field-input"
                />
              </div>

              <div className="field">
                <label htmlFor="image-description" className="field-label">Notas</label>
                <textarea
                  id="image-description"
                  name="description"
                  defaultValue={selectedImage.description || ''}
                  placeholder="Escribí una nota sobre esta foto"
                  rows={3}
                  className="field-input resize-none"
                />
              </div>
            </form>
          </div>
        )}
      </Modal>

      {/* Barra de selección de fotos */}
      {isSelectionMode && (
        <div
          role="toolbar"
          aria-label="Acciones sobre las fotos seleccionadas"
          className="animate-sheet-in surface fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full py-2 pl-4 pr-2 shadow-[var(--shadow-lg)] md:bottom-10"
        >
          <span className="whitespace-nowrap text-sm font-semibold text-fg" aria-live="polite">
            {selectedImages.length} seleccionadas
          </span>

          <button
            type="button"
            onClick={() => { setIsSelectionMode(false); setSelectedImages([]); }}
            className="btn-icon h-10 min-h-10 w-10 min-w-10"
            aria-label="Salir del modo selección"
          >
            <X size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteImagesConfirm(true)}
            disabled={selectedImages.length === 0}
            className="btn-icon h-10 min-h-10 w-10 min-w-10 text-[color:var(--danger)]"
            aria-label={`Eliminar ${selectedImages.length} fotos`}
          >
            <Trash2 size={18} aria-hidden="true" />
          </button>
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteImagesConfirm}
        onClose={() => setShowDeleteImagesConfirm(false)}
        onConfirm={handleDeleteImages}
        title="Eliminar fotos"
        description={`Se eliminarán ${selectedImages.length} fotos del ciclo. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
      />

      <BulkArchiveModal isOpen={isArchiveModalOpen} onClose={() => setIsArchiveModalOpen(false)} selectedIds={selectedPlants} onSuccess={() => setSelectedPlants([])} cycleId={cycle.id} />
      <BulkStageModal isOpen={isStageModalOpen} onClose={() => setIsStageModalOpen(false)} selectedIds={selectedPlants} onSuccess={() => setSelectedPlants([])} cycleId={cycle.id} />
      <MeasurementModal isOpen={isMeasureModalOpen} onClose={() => setIsMeasureModalOpen(false)} cycleId={cycle.id} />
    </div>
  );
}
