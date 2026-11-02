"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deletePlant, updatePlant } from "@/app/actions/plants";
import { Plant, Cycle } from "@/app/lib/types";
import { getStageColor, todayForInput } from "@/app/lib/utils";
import { dateKey as dayKeyOf } from "@/app/lib/dates";
import { STAGE_DATE_COLUMNS, STAGE_NAMES, StageName } from "@/app/lib/stage-logic";
import { Sprout, Leaf, Flower, Wind, Thermometer, Calendar, Save, ArrowLeft, Trash2, Dna, Loader2, GitBranch, LucideIcon } from "lucide-react";
import Link from "next/link";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/app/context/ToastContext";
import { ChoiceGroup, Field, Input, SOURCE_OPTIONS, Select, Switch } from "@/components/ui/form";

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
    is_mother: Boolean(plant.is_mother),
  });

  // Dates State
  const [dates, setDates] = useState<Record<string, string>>(() =>
    Object.fromEntries(STAGE_CONFIG.map((stage) => [stage.key, plant[stage.key] || '']))
  );

  const handleBasicChange = (field: string, value: string | number | boolean | null) => {
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
      // La etapa, `stage_updated_at` y `planted_at` los deduce el servidor de
      // la línea de tiempo, con la misma regla que el resto de la app.
      const result = await updatePlant(plant.id, {
        name: basicInfo.name,
        strain: basicInfo.strain,
        breeder: basicInfo.breeder,
        source_type: basicInfo.source_type,
        cycle_id: basicInfo.cycle_id,
        is_mother: basicInfo.is_mother,
        dates,
      });

      if (!result.success) {
        showToast(result.error || "No se pudieron guardar los cambios", "error");
        return;
      }

      showToast("Cambios guardados");
      router.push(`/plants/${plant.id}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      const result = await deletePlant(plant.id);
      if (!result.success) {
        showToast(result.error || "No se pudo eliminar la planta", "error");
        return;
      }

      showToast(`${plant.name} eliminada`);
      router.push('/plants');
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
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

      <form onSubmit={handleSave} className="space-y-6">
        <section aria-labelledby="info-basica" className="surface space-y-6 rounded-[var(--radius-lg)] p-5 md:p-6">
          <h2 id="info-basica" className="font-title text-lg font-semibold text-fg">La planta</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Nombre" className="md:col-span-2">
              <Input
                type="text"
                required
                autoComplete="off"
                value={basicInfo.name}
                onChange={(e) => handleBasicChange('name', e.target.value)}
              />
            </Field>

            <Field label="Genética">
              <Input
                type="text"
                autoComplete="off"
                autoCapitalize="words"
                value={basicInfo.strain}
                onChange={(e) => handleBasicChange('strain', e.target.value)}
              />
            </Field>

            <Field label="Banco" optional>
              <Input
                type="text"
                autoComplete="off"
                autoCapitalize="words"
                value={basicInfo.breeder}
                onChange={(e) => handleBasicChange('breeder', e.target.value)}
              />
            </Field>
          </div>

          <ChoiceGroup
            legend="Origen"
            variant="tile"
            layout="grid grid-cols-2 gap-2"
            options={SOURCE_OPTIONS}
            value={basicInfo.source_type as 'Semilla' | 'Esqueje'}
            onChange={(value) => handleBasicChange('source_type', value)}
          />

          {/* El ciclo actual aparece aunque esté cerrado: antes sólo se
              listaban los activos y una planta de un ciclo finalizado
              mostraba otro ciclo en el desplegable. */}
          <Field label="Ciclo">
            <Select
              value={basicInfo.cycle_id ?? ''}
              onChange={(e) => handleBasicChange('cycle_id', e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Sin ciclo</option>
              {cycles.map(cycle => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.name}{cycle.is_active ? '' : ' (finalizado)'}
                </option>
              ))}
            </Select>
          </Field>

          <div className="rounded-[var(--radius-md)] border border-line px-4 py-1">
            <Switch
              checked={basicInfo.is_mother}
              onChange={(value) => handleBasicChange('is_mother', value)}
              icon={<GitBranch size={17} />}
              label="Planta madre"
              description="La guardás para sacar esquejes: aparece primera al elegir madre."
            />
          </div>
        </section>

        <section aria-labelledby="linea-tiempo" className="surface rounded-[var(--radius-lg)] p-5 md:p-6">
          <h2 id="linea-tiempo" className="font-title text-lg font-semibold text-fg">Línea de tiempo</h2>
          <p className="mb-5 mt-1 text-sm text-fg-muted">
            Tocá cada etapa por la que pasó y poné el día en que empezó. La última con fecha es la etapa actual.
          </p>

          <ol className="relative space-y-2 before:absolute before:bottom-6 before:left-[calc(1.75rem+0.5px)] before:top-6 before:w-px before:bg-[color:var(--border-strong)]">
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
                <li
                  key={stage.key}
                  className={`relative flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border p-2.5 transition-colors ${
                    isActive ? 'border-line bg-surface' : 'border-transparent'
                  }`}
                >
                  {/* Un único control activa la etapa: antes el icono y la fila
                      disparaban la misma acción por separado. */}
                  <button
                    type="button"
                    onClick={() => activateStage(dateKey)}
                    aria-pressed={isActive}
                    className="flex min-h-[2.75rem] min-w-0 flex-1 items-center gap-3 rounded-[var(--radius-sm)] text-left"
                  >
                    <span
                      className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 bg-surface transition-colors ${
                        isActive
                          ? `${colors.bgColor} ${colors.textColor} ${colors.borderColor}`
                          : 'border-dashed border-line-strong text-fg-subtle'
                      }`}
                      aria-hidden="true"
                    >
                      <Icon size={16} strokeWidth={isActive ? 2.25 : 1.75} />
                    </span>

                    <span className="min-w-0">
                      <span className={`block text-sm font-semibold ${isActive ? 'text-fg' : 'text-fg-muted'}`}>
                        {stage.label}
                      </span>
                      <span className="block text-xs text-fg-subtle">
                        {isActive ? 'Tocá para quitarla' : 'No pasó por acá · tocá para sumarla'}
                      </span>
                    </span>
                  </button>

                  {isActive && (
                    <div className="w-full pl-12 sm:w-44 sm:pl-0">
                      <label htmlFor={`stage-${stage.key}`} className="sr-only">
                        Fecha de {stage.label}
                      </label>
                      <Input
                        id={`stage-${stage.key}`}
                        type="date"
                        leading={<Calendar size={16} />}
                        value={dayKeyOf(dateValue) ?? ''}
                        onChange={(e) => handleDateChange(dateKey, e.target.value)}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        {/* Guardar queda siempre a mano, por encima de la barra inferior */}
        <div className="sticky bottom-[calc(var(--nav-bottom)+0.75rem+env(safe-area-inset-bottom))] z-10 lg:bottom-4">
          <button type="submit" disabled={loading} className="btn btn-primary min-h-[3rem] w-full shadow-[var(--shadow-lg)]">
            {loading ? (
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            ) : (
              <Save size={18} aria-hidden="true" />
            )}
            {loading ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
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
