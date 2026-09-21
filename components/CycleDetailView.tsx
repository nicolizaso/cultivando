"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import imageCompression from 'browser-image-compression';
import {
  ArrowRight, ArrowUpRight, Camera, CloudRain, Droplets, LayoutGrid, Leaf,
  List as ListIcon, Loader2, Archive, Thermometer, Trash2, Gauge
} from "lucide-react";

import { Plant, CycleImage } from "@/app/lib/types";
import { getPlantMetrics, getStageColor } from "@/app/lib/utils";
import BulkStageModal from "./BulkStageModal";
import BulkArchiveModal from "./BulkArchiveModal";
import BulkWaterModal from "./BulkWaterModal";
import MeasurementModal from "./MeasurementModal";
import { useToast } from "@/app/context/ToastContext";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import SegmentedControl from "@/components/ui/SegmentedControl";
import SelectionBar from "@/components/ui/SelectionBar";
import { uploadCycleImage, deleteCycleImages, updateCycleImage } from "@/app/cycles/actions";

interface CycleDetailViewProps {
  cycle: { id: number; name: string; start_date: string; spaces: { name: string; type: string }; };
  plants: Plant[];
  lastMeasurement?: { temperature: number; humidity: number; date: string } | null;
  history: any[];
  cycleImages?: CycleImage[];
}

type ViewMode = 'table' | 'grid';

export default function CycleDetailView({ cycle, plants, lastMeasurement, cycleImages = [] }: CycleDetailViewProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<CycleImage | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Gallery Selection State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ignoreNextClick = useRef(false);

  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedPlants, setSelectedPlants] = useState<number[]>([]);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [isWaterModalOpen, setIsWaterModalOpen] = useState(false);
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

  /** Lo que hacen las acciones en lote al terminar bien. */
  const handleBulkSuccess = () => {
    setSelectedPlants([]);
    router.refresh();
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
        const compressedFile = await imageCompression(file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        });

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

  const vpdValue = lastMeasurement
    ? (0.61078 * Math.exp((17.27 * lastMeasurement.temperature) / (lastMeasurement.temperature + 237.3))) *
      (1 - lastMeasurement.humidity / 100)
    : null;

  // El rango sano se dice con palabras además de con color: quien no distingue
  // el verde del rojo tiene que poder leer el diagnóstico igual.
  const vpdStatus = vpdValue === null
    ? { label: 'Sin medición', tone: 'text-fg-muted' }
    : vpdValue < 0.4
      ? { label: 'Bajo, riesgo de hongos', tone: 'text-[color:var(--danger)]' }
      : vpdValue > 1.6
        ? { label: 'Alto, la planta transpira de más', tone: 'text-[color:var(--danger)]' }
        : { label: 'En rango', tone: 'text-[color:var(--success)]' };

  const toggleSelectAll = () => {
    setSelectedPlants(
      selectedPlants.length === activePlants.length ? [] : activePlants.map(p => p.id)
    );
  };

  const toggleSelectPlant = (id: number) => {
    setSelectedPlants(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const allPlantsSelected = activePlants.length > 0 && selectedPlants.length === activePlants.length;

  return (
    <div className="space-y-8">
      {/* 1. Clima del espacio */}
      <section aria-labelledby="clima" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="clima" className="section-title">Clima del espacio</h2>
          <button
            type="button"
            onClick={() => setIsMeasureModalOpen(true)}
            className="btn btn-sm btn-secondary"
          >
            <Thermometer size={15} aria-hidden="true" />
            Registrar medición
          </button>
        </div>

        {/* Los tres indicadores se leen igual: antes sólo el primero era
            clicable y no había forma de saber por qué. Ahora ninguno lo es y
            la acción vive en la cabecera de la sección. */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <div className="surface rounded-[var(--radius-lg)] p-4 sm:p-5">
            <p className="metric-label flex items-center gap-1.5">
              <Thermometer size={13} className="text-[color:var(--accent-rose)]" aria-hidden="true" />
              Temperatura
            </p>
            <p className="metric mt-2 text-3xl text-fg">
              {lastMeasurement ? `${lastMeasurement.temperature}°` : '--'}
            </p>
            <p className="mt-1 text-xs text-fg-subtle">Celsius</p>
          </div>

          <div className="surface rounded-[var(--radius-lg)] p-4 sm:p-5">
            <p className="metric-label flex items-center gap-1.5">
              <CloudRain size={13} className="text-[color:var(--accent-cyan)]" aria-hidden="true" />
              Humedad
            </p>
            <p className="metric mt-2 text-3xl text-fg">
              {lastMeasurement ? `${lastMeasurement.humidity}%` : '--'}
            </p>
            <p className="mt-1 text-xs text-fg-subtle">Relativa</p>
          </div>

          <div className="surface col-span-2 rounded-[var(--radius-lg)] p-4 sm:p-5 lg:col-span-1">
            <p className="metric-label flex items-center gap-1.5">
              <Gauge size={13} className="text-[color:var(--accent-violet)]" aria-hidden="true" />
              VPD
            </p>
            <p className="metric mt-2 text-3xl text-fg">
              {vpdValue !== null ? vpdValue.toFixed(2) : '--'}
              {vpdValue !== null && <span className="ml-1 text-sm font-medium text-fg-muted">kPa</span>}
            </p>
            <p className={`mt-1 text-xs font-medium ${vpdStatus.tone}`}>{vpdStatus.label}</p>
          </div>
        </div>
      </section>

      {/* 2. Plantas del ciclo */}
      <section aria-labelledby="plantas" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="plantas" className="section-title">
            Plantas del ciclo
            <span className="mono ml-2 text-sm font-medium text-fg-muted">{activePlants.length}</span>
          </h2>

          <div className="flex items-center gap-2">
            {activePlants.length > 0 && (
              <button type="button" onClick={toggleSelectAll} className="btn btn-sm btn-ghost">
                {allPlantsSelected ? 'Quitar todas' : 'Seleccionar todas'}
              </button>
            )}

            <SegmentedControl<ViewMode>
              label="Modo de vista"
              value={viewMode}
              onChange={setViewMode}
              iconOnly
              options={[
                { value: 'table', label: 'Lista', icon: ListIcon, srLabel: 'Ver como lista' },
                { value: 'grid', label: 'Cuadrícula', icon: LayoutGrid, srLabel: 'Ver como cuadrícula' },
              ]}
            />
          </div>
        </div>

        {activePlants.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-line-strong bg-surface py-12 text-center">
            <Leaf className="h-7 w-7 text-fg-subtle" aria-hidden="true" />
            <p className="text-sm font-semibold text-fg">Este ciclo no tiene plantas activas</p>
            <p className="text-xs text-fg-muted">Agregá plantas desde la sección Plantas y asignalas a este ciclo.</p>
          </div>
        ) : viewMode === 'table' ? (
          <div className="surface overflow-x-auto rounded-[var(--radius-lg)]">
            <table className="w-full min-w-[540px] text-left text-sm">
              <caption className="sr-only">Plantas activas del ciclo {cycle.name}</caption>
              <thead className="border-b border-line bg-surface-2 text-xs font-semibold text-fg-muted">
                <tr>
                  <th scope="col" className="w-12 p-3.5">
                    <input
                      type="checkbox"
                      onChange={toggleSelectAll}
                      checked={allPlantsSelected}
                      aria-label="Seleccionar todas las plantas"
                      className="field-check"
                    />
                  </th>
                  <th scope="col" className="p-3.5">Planta</th>
                  <th scope="col" className="p-3.5">Etapa</th>
                  <th scope="col" className="p-3.5 text-right">En etapa</th>
                  <th scope="col" className="p-3.5 text-right">Edad</th>
                  <th scope="col" className="w-12 p-3.5"><span className="sr-only">Abrir ficha</span></th>
                </tr>
              </thead>
              <tbody>
                {activePlants.map(plant => {
                  const { currentStage, daysInCurrentStage, totalAge } = getPlantMetrics(plant);
                  const rawStage = currentStage || plant.stage;
                  const displayStage = (rawStage === 'Esqueje' || rawStage === 'Plántula') ? 'Plántula' : rawStage;
                  const stageInfo = getStageColor(displayStage);
                  const isSelected = selectedPlants.includes(plant.id);

                  return (
                    <tr
                      key={plant.id}
                      className={`border-b border-line last:border-0 transition-colors ${
                        isSelected ? 'bg-brand-soft' : 'hover:bg-surface-2'
                      }`}
                    >
                      <td className="p-3.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectPlant(plant.id)}
                          aria-label={`Seleccionar ${plant.name}`}
                          className="field-check"
                        />
                      </td>
                      <td className="p-3.5">
                        <Link href={`/plants/${plant.id}`} className="font-semibold text-fg hover:text-[color:var(--brand-text)]">
                          {plant.name}
                        </Link>
                        {plant.strain && <p className="text-xs text-fg-subtle">{plant.strain}</p>}
                      </td>
                      <td className="p-3.5">
                        <span className={`chip ${stageInfo.bgColor} ${stageInfo.textColor} ${stageInfo.borderColor}`}>
                          {stageInfo.icon}
                          {displayStage}
                        </span>
                      </td>
                      <td className="mono p-3.5 text-right text-fg-muted" suppressHydrationWarning>
                        {isMounted ? `${daysInCurrentStage} d` : '– d'}
                      </td>
                      <td className="mono p-3.5 text-right text-fg-muted" suppressHydrationWarning>
                        {isMounted ? `${totalAge} d` : '– d'}
                      </td>
                      <td className="p-3.5 text-right">
                        <Link
                          href={`/plants/${plant.id}`}
                          className="btn-icon btn-icon-sm"
                          aria-label={`Abrir la ficha de ${plant.name}`}
                        >
                          <ArrowUpRight size={16} aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {activePlants.map(plant => {
              const { currentStage, daysInCurrentStage } = getPlantMetrics(plant);
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
                    <span
                      className={`absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-[6px] border transition-colors ${
                        isSelected ? 'border-[color:var(--brand)] bg-brand' : 'border-line-strong bg-surface'
                      }`}
                      aria-hidden="true"
                    >
                      {isSelected && <span className="h-2.5 w-2.5 rounded-[2px] bg-[color:var(--brand-fg)]" />}
                    </span>

                    <span className={`relative block aspect-square ${stageInfo.bgColor}`}>
                      {(plant as any).image_url ? (
                        <Image src={(plant as any).image_url} alt="" fill sizes="220px" className="object-cover" />
                      ) : (
                        <span className={`flex h-full items-center justify-center text-3xl ${stageInfo.textColor}`}>
                          {stageInfo.icon}
                        </span>
                      )}
                    </span>

                    <span className="block p-3">
                      <span className="block truncate text-sm font-semibold text-fg">{plant.name}</span>
                      <span className={`block truncate text-xs font-semibold ${stageInfo.textColor}`}>
                        {displayStage}
                        <span className="mono ml-1 font-normal text-fg-subtle" suppressHydrationWarning>
                          {isMounted ? `${daysInCurrentStage} d` : ''}
                        </span>
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 3. Galería del ciclo */}
      <section aria-labelledby="galeria" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="galeria" className="section-title">Seguimiento visual</h2>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="btn btn-sm btn-secondary"
          >
            {isUploading
              ? <Loader2 className="animate-spin" size={15} aria-hidden="true" />
              : <Camera size={15} aria-hidden="true" />}
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
          <ul className="custom-scrollbar flex snap-x gap-3 overflow-x-auto pb-3">
            {cycleImages.map((img) => {
              const isSelected = selectedImages.includes(img.id);
              const dayNumber = Math.max(0, Math.floor(
                (new Date(img.taken_at).getTime() - new Date(cycle.start_date).getTime()) / (1000 * 60 * 60 * 24)
              ));

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
                    className={`group relative block aspect-[3/4] w-36 overflow-hidden rounded-[var(--radius-md)] border transition-colors sm:w-44 ${
                      isSelected
                        ? 'border-[color:var(--brand)] ring-2 ring-[color:var(--brand)]'
                        : 'border-line hover:border-line-strong'
                    }`}
                  >
                    {isSelectionMode && (
                      <span
                        className={`absolute left-2 top-2 z-20 flex h-5 w-5 items-center justify-center rounded-[6px] border ${
                          isSelected ? 'border-[color:var(--brand)] bg-brand' : 'border-line-strong bg-surface'
                        }`}
                        aria-hidden="true"
                      >
                        {isSelected && <span className="h-2.5 w-2.5 rounded-[2px] bg-[color:var(--brand-fg)]" />}
                      </span>
                    )}

                    <Image
                      src={img.public_url}
                      alt={img.description || ""}
                      fill
                      sizes="176px"
                      className={`object-cover transition-transform duration-500 ${isSelected ? 'scale-105 opacity-70' : 'group-hover:scale-105'}`}
                    />

                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2.5 text-left">
                      <span className="mono block text-[11px] font-semibold text-white">Día {dayNumber}</span>
                      <span className="block text-[10px] text-white/75">
                        {new Date(img.taken_at).toLocaleDateString('es-AR')}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-line-strong bg-surface py-12 text-center">
            <Camera className="h-7 w-7 text-fg-subtle" aria-hidden="true" />
            <p className="text-sm font-semibold text-fg">Sin fotos de este ciclo</p>
            <p className="max-w-xs text-xs text-fg-muted">
              Subí una foto por semana y vas a tener la evolución completa del cultivo en una tira.
            </p>
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

      {/* Una sola barra flotante, compartida por plantas y fotos: nunca hay dos
          selecciones activas a la vez. */}
      <SelectionBar
        count={selectedPlants.length}
        onClear={() => setSelectedPlants([])}
        label="Acciones sobre las plantas seleccionadas"
      >
        <button
          type="button"
          onClick={() => setIsStageModalOpen(true)}
          className="btn btn-sm btn-secondary rounded-full"
        >
          <ArrowRight size={15} aria-hidden="true" />
          Cambiar etapa
        </button>
        <button
          type="button"
          onClick={() => setIsWaterModalOpen(true)}
          className="btn btn-sm btn-secondary rounded-full"
        >
          <Droplets size={15} aria-hidden="true" />
          Regar
        </button>
        <button
          type="button"
          onClick={() => setIsArchiveModalOpen(true)}
          className="btn btn-sm btn-secondary rounded-full"
        >
          <Archive size={15} aria-hidden="true" />
          Archivar
        </button>
      </SelectionBar>

      <SelectionBar
        count={isSelectionMode ? selectedImages.length : 0}
        onClear={() => { setIsSelectionMode(false); setSelectedImages([]); }}
        label="Acciones sobre las fotos seleccionadas"
      >
        <button
          type="button"
          onClick={() => setShowDeleteImagesConfirm(true)}
          className="btn btn-sm btn-danger rounded-full"
        >
          <Trash2 size={15} aria-hidden="true" />
          Eliminar
        </button>
      </SelectionBar>

      <ConfirmDialog
        isOpen={showDeleteImagesConfirm}
        onClose={() => setShowDeleteImagesConfirm(false)}
        onConfirm={handleDeleteImages}
        title="Eliminar fotos"
        description={`Se eliminarán ${selectedImages.length} fotos del ciclo. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
      />

      <BulkArchiveModal isOpen={isArchiveModalOpen} onClose={() => setIsArchiveModalOpen(false)} selectedIds={selectedPlants} onSuccess={handleBulkSuccess} />
      <BulkStageModal isOpen={isStageModalOpen} onClose={() => setIsStageModalOpen(false)} selectedIds={selectedPlants} onSuccess={handleBulkSuccess} />
      <BulkWaterModal isOpen={isWaterModalOpen} onClose={() => setIsWaterModalOpen(false)} selectedIds={selectedPlants} onSuccess={handleBulkSuccess} />
      <MeasurementModal isOpen={isMeasureModalOpen} onClose={() => setIsMeasureModalOpen(false)} cycleId={cycle.id} />
    </div>
  );
}
