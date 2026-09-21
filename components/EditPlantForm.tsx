"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { Plant, Cycle } from "@/app/lib/types";
import { getStageColor, todayForInput } from "@/app/lib/utils";
import { STAGE_DATE_COLUMNS, STAGE_NAMES, StageName } from "@/app/lib/stage-logic";
import { parseCultivationDate } from "@/app/lib/dates";
import { Sprout, Leaf, Flower, Wind, Thermometer, Calendar, Save, ArrowLeft, Trash2, Dna, Loader2, LucideIcon } from "lucide-react";
import Link from "next/link";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/app/context/ToastContext";

interface EditPlantFormProps {
  plant: Plant;
  cycles: Cycle[];
}

/** El icono con el que se dibuja cada etapa en la línea de tiempo. */
const STAGE_ICONS: Record<StageName, LucideIcon> = {
  'Germinación': Sprout,
  'Plántula': Sprout,
  'Enraizamiento': Dna,
  'Vegetativo': Leaf,
  'Floración': Flower,
  'Secado': Wind,
  'Curado': Thermometer,
};

/**
 * La línea de tiempo se arma desde la lista canónica de etapas en vez de
 * repetirla.
 *
 * Cuando era una copia a mano, el objeto que se guardaba enumeraba las
 * columnas de fecha una por una y se había quedado sin `date_enraizamiento`:
 * tocar esa fecha y guardar no hacía nada, sin ningún aviso. Como Supabase
 * sólo escribe las claves presentes, el dato viejo seguía en la base. Le
 * pegaba justo a los esquejes, que entran al cultivo por esa etapa.
 */
const STAGE_CONFIG = STAGE_NAMES.map((name) => ({
  key: STAGE_DATE_COLUMNS[name],
  label: name,
  value: name,
  icon: STAGE_ICONS[name],
}));

export default function EditPlantForm({ plant, cycles }: EditPlantFormProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Basic Info State
  const [basicInfo, setBasicInfo] = useState({
    name: plant.name,
    strain: plant.strain || '',
    breeder: plant.breeder || '',
    source_type: plant.source_type || 'Semilla',
    cycle_id: plant.cycle_id,
  });

  // Dates State
  const [dates, setDates] = useState<Record<string, string>>(() =>
    Object.fromEntries(STAGE_CONFIG.map((stage) => [stage.key, plant[stage.key] || '']))
  );

  const handleBasicChange = (field: string, value: any) => {
    setBasicInfo(prev => ({ ...prev, [field]: value }));
  };

  const handleDateChange = (key: string, value: string) => {
    setDates(prev => ({ ...prev, [key]: value }));
  };

  const activateStage = (key: string) => {
    if (dates[key]) {
      // Deactivate/Toggle off
      handleDateChange(key, '');
    } else {
      handleDateChange(key, todayForInput());
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // La etapa la manda la línea de tiempo: es la última con fecha, y
      // STAGE_CONFIG viene en orden de cultivo.
      let currentStage = plant.stage;
      for (const config of STAGE_CONFIG) {
          if (dates[config.key]) {
              currentStage = config.value;
          }
      }

      // Also update planted_at if germinacion is set
      const plantedAt = dates.date_germinacion || plant.planted_at;

      // Las siete columnas de fecha salen de la misma lista que dibuja la
      // línea de tiempo, así que no puede volver a faltar ninguna.
      //
      // Se anclan al mediodía igual que el cambio de etapa en lote: el input
      // devuelve un "YYYY-MM-DD" pelado, que la base guarda como medianoche
      // UTC, y al oeste de Greenwich la etapa arrancaba el día anterior. Una
      // fecha que el usuario no tocó llega con su hora original y no se mueve.
      const stageDates = Object.fromEntries(
        STAGE_CONFIG.map((stage) => {
          const value = dates[stage.key];
          return [stage.key, value ? parseCultivationDate(value)?.toISOString() ?? null : null];
        })
      );

      const updates = {
        name: basicInfo.name,
        strain: basicInfo.strain,
        breeder: basicInfo.breeder,
        source_type: basicInfo.source_type,
        cycle_id: basicInfo.cycle_id,
        ...stageDates,
        // Computed/Logic
        planted_at: plantedAt,
        stage: currentStage
      };

      const { error } = await supabase
        .from('plants')
        .update(updates)
        .eq('id', plant.id);

      if (error) throw error;

      showToast("Cambios guardados");
      router.push(`/plants/${plant.id}`);
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudieron guardar los cambios", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
        const { error } = await supabase
            .from('plants')
            .delete()
            .eq('id', plant.id);

        if (error) throw error;

        showToast(`${plant.name} eliminada`);
        router.push('/plants');
        router.refresh();
    } catch (error) {
        showToast(error instanceof Error ? error.message : "No se pudo eliminar la planta", "error");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/plants/${plant.id}`} className="btn btn-sm btn-ghost">
          <ArrowLeft size={16} aria-hidden="true" />
          Volver
        </Link>
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="btn btn-sm btn-danger"
        >
          <Trash2 size={16} aria-hidden="true" />
          Eliminar
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        <section aria-labelledby="info-basica" className="surface space-y-5 rounded-[var(--radius-lg)] p-5 md:p-6">
          <h2 id="info-basica" className="font-title text-lg font-semibold text-fg">Información básica</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="field">
              <label htmlFor="edit-plant-name" className="field-label">Nombre</label>
              <input
                id="edit-plant-name"
                type="text"
                required
                className="field-input"
                value={basicInfo.name}
                onChange={(e) => handleBasicChange('name', e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="edit-plant-strain" className="field-label">Genética</label>
              <input
                id="edit-plant-strain"
                type="text"
                className="field-input"
                value={basicInfo.strain}
                onChange={(e) => handleBasicChange('strain', e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="edit-plant-breeder" className="field-label">Banco</label>
              <input
                id="edit-plant-breeder"
                type="text"
                className="field-input"
                value={basicInfo.breeder}
                onChange={(e) => handleBasicChange('breeder', e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="edit-plant-source" className="field-label">Origen</label>
              <select
                id="edit-plant-source"
                className="field-input"
                value={basicInfo.source_type}
                onChange={(e) => handleBasicChange('source_type', e.target.value)}
              >
                <option value="Semilla">Semilla</option>
                <option value="Esqueje">Esqueje</option>
              </select>
            </div>

            <div className="field md:col-span-2">
              <label htmlFor="edit-plant-cycle" className="field-label">Ciclo</label>
              <select
                id="edit-plant-cycle"
                className="field-input"
                value={basicInfo.cycle_id || ''}
                onChange={(e) => handleBasicChange('cycle_id', Number(e.target.value))}
              >
                {cycles.map(cycle => (
                  <option key={cycle.id} value={cycle.id}>{cycle.name}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section aria-labelledby="linea-tiempo" className="surface rounded-[var(--radius-lg)] p-5 md:p-6">
          <h2 id="linea-tiempo" className="mb-2 font-title text-lg font-semibold text-fg">Línea de tiempo</h2>
          <p className="mb-6 text-sm text-fg-muted">
            Activá cada etapa para registrar la fecha en la que empezó.
          </p>

          <div className="space-y-3">
            {STAGE_CONFIG.filter(stage => {
              // Una etapa con fecha se muestra siempre, aunque no sea la que
              // le toca al origen: si no, queda un dato que el usuario no
              // puede ver ni corregir, pero que igual decide su etapa actual.
              if (dates[stage.key]) return true;

              if (basicInfo.source_type === 'Esqueje') {
                return !['Germinación', 'Plántula'].includes(stage.label);
              } else {
                return stage.label !== 'Enraizamiento';
              }
            }).map((stage) => {
              const dateKey = stage.key;
              const dateValue = dates[dateKey];
              const isActive = !!dateValue;
              const Icon = stage.icon;
              const colors = getStageColor(stage.label);

              return (
                <div
                  key={stage.key}
                  className={`flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border p-3 transition-colors ${
                    isActive ? `border-line bg-surface-2` : 'border-dashed border-line-strong'
                  }`}
                >
                  {/* Un único control activa la etapa: antes el icono y la fila
                      disparaban la misma acción por separado. */}
                  <button
                    type="button"
                    onClick={() => activateStage(dateKey)}
                    aria-pressed={isActive}
                    className={`flex min-w-0 flex-1 items-center gap-3 text-left ${isActive ? '' : 'opacity-80'}`}
                  >
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 ${
                        isActive
                          ? `${colors.bgColor} ${colors.textColor} ${colors.borderColor}`
                          : 'border-line-strong text-fg-muted'
                      }`}
                      aria-hidden="true"
                    >
                      <Icon size={18} strokeWidth={isActive ? 2 : 1.5} />
                    </span>

                    <span className="min-w-0">
                      <span className={`block text-sm font-semibold ${isActive ? 'text-fg' : 'text-fg-muted'}`}>
                        {stage.label}
                      </span>
                      {!isActive && <span className="block text-xs text-fg-subtle">Tocá para activarla</span>}
                    </span>
                  </button>

                  {isActive ? (
                    <>
                      <label htmlFor={`stage-${stage.key}`} className="sr-only">
                        Fecha de {stage.label}
                      </label>
                      <input
                        id={`stage-${stage.key}`}
                        type="date"
                        className="field-input w-40"
                        value={dateValue ? dateValue.split('T')[0] : ''}
                        onChange={(e) => handleDateChange(dateKey, e.target.value)}
                      />
                    </>
                  ) : (
                    <Calendar className="text-fg-subtle" size={20} aria-hidden="true" />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? (
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          ) : (
            <Save size={18} aria-hidden="true" />
          )}
          {loading ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Eliminar planta"
        description={`Se eliminará "${plant.name}" y su historial. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
      />
    </div>
  );
}
