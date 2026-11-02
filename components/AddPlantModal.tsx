"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plant, Cycle } from "@/app/lib/types";
import { Sprout } from "lucide-react";
import { createPlants } from "@/app/actions/plants";
import { todayForInput } from "@/app/lib/utils";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/app/context/ToastContext";
import {
  ChoiceGroup, ChoiceOrSelect, DateField, Field, FormActions, FormSection, Input, SOURCE_OPTIONS, Select,
  Stepper, stageOptions, useFieldErrors,
} from "@/components/ui/form";

const SEED_STAGES = ['Germinación', 'Plántula', 'Vegetativo', 'Floración'];
const CLONE_STAGES = ['Enraizamiento', 'Vegetativo', 'Floración'];
const LATE_STAGES = ['Secado', 'Curado'];

/** El servidor acepta hasta 100 por tanda. */
const MAX_QUANTITY = 100;

type CycleOption = Pick<Cycle, 'id' | 'name'>;
type MotherOption = Pick<Plant, 'id' | 'name' | 'strain' | 'breeder' | 'is_mother'>;

interface AddPlantModalProps {
  /** Ciclos activos, para elegir dónde va la planta. Los trae la página. */
  activeCycles: CycleOption[];
  /** Plantas que pueden dar esquejes: las no archivadas. */
  potentialMothers: MotherOption[];
}

const emptyForm = () => ({
  strain: "",
  name: "",
  breeder: "",
  source_type: "Semilla" as "Semilla" | "Esqueje",
  mother_id: "" as string | number,
  stage: "Germinación",
  cycle_id: (null as number | null),
  planted_at: todayForInput(),
  quantity: 1,
});

export default function AddPlantModal({ activeCycles, potentialMothers }: AddPlantModalProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const { errors, validate, clear } = useFieldErrors<'strain' | 'cycle'>();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Con un solo ciclo activo no hay nada que elegir: ya viene marcado.
  const [formData, setFormData] = useState(() => ({
    ...emptyForm(),
    cycle_id: activeCycles.length === 1 ? activeCycles[0].id : null,
  }));

  const [isNameManuallyEdited, setIsNameManuallyEdited] = useState(false);

  /** El nombre sugerido sigue a la genética hasta que el usuario lo edite. */
  const changeStrain = (strain: string) => {
    clear('strain');
    setFormData((prev) => ({ ...prev, strain, ...(isNameManuallyEdited ? {} : { name: strain }) }));
  };

  /** Al elegir madre, el esqueje hereda su genética, su banco y su nombre. */
  const changeMother = (motherId: string) => {
    const mother = potentialMothers.find((plant) => String(plant.id) === motherId);
    if (mother?.strain) clear('strain');
    setFormData((prev) => ({
      ...prev,
      mother_id: motherId,
      ...(mother ? { strain: mother.strain || '', breeder: mother.breeder || '', name: mother.name || '' } : {}),
    }));
    if (mother) setIsNameManuallyEdited(true);
  };

  /** Un esqueje arranca en Enraizamiento; una semilla, en una etapa de semilla. */
  const changeSource = (source: "Semilla" | "Esqueje") => {
    setFormData((prev) => ({
      ...prev,
      source_type: source,
      ...(source === "Semilla" ? { mother_id: "" } : {}),
      stage: source === "Esqueje" ? "Enraizamiento" : SEED_STAGES.includes(prev.stage) ? prev.stage : "Germinación",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = validate({
      cycle: !formData.cycle_id && 'Elegí en qué ciclo va.',
      strain: !formData.strain.trim() && 'Escribí la genética. Si no la sabés, poné “Desconocida”.',
    }, formRef.current);
    if (!ok) return;

    setLoading(true);

    try {
      // El servidor valida todo y anota la fecha de la etapa inicial: antes
      // las plantas nuevas quedaban en "0 días en etapa" para siempre.
      const result = await createPlants({
        strain: formData.strain,
        name: formData.name,
        breeder: formData.breeder,
        source_type: formData.source_type,
        mother_id: formData.mother_id || null,
        stage: formData.stage,
        cycle_id: formData.cycle_id,
        planted_at: formData.planted_at,
        quantity: formData.quantity,
      });

      if (!result.success) {
        showToast(result.error || "No se pudieron crear las plantas", "error");
        return;
      }

      const created = result.count ?? 1;
      setIsOpen(false);
      resetForm();
      showToast(created > 1 ? `${created} plantas creadas` : "Planta creada");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ ...emptyForm(), cycle_id: activeCycles.length === 1 ? activeCycles[0].id : null });
    setIsNameManuallyEdited(false);
  };

  const stages = [...(formData.source_type === 'Semilla' ? SEED_STAGES : CLONE_STAGES), ...LATE_STAGES];
  const mothers = potentialMothers.filter((plant) => plant.is_mother);
  const others = potentialMothers.filter((plant) => !plant.is_mother);

  // Cómo van a quedar etiquetadas, para no tener que adivinarlo.
  const baseName = (formData.name || formData.strain).trim();
  const namePreview = !baseName
    ? 'Se usa para reconocerla en las listas.'
    : formData.quantity > 1
      ? `Quedan como “${baseName} #1” a “${baseName} #${formData.quantity}”.`
      : `Queda como “${baseName}”.`;

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="btn btn-primary">
        <Sprout size={18} aria-hidden="true" />
        Nueva planta
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Nueva planta"
        description="Una o varias de la misma genética, en un ciclo activo."
        size="lg"
        dismissOnBackdrop={false}
        footer={
          <FormActions
            form="add-plant-form"
            onCancel={() => setIsOpen(false)}
            icon={Sprout}
            pending={loading}
            submitLabel={formData.quantity > 1 ? `Crear ${formData.quantity} plantas` : "Crear planta"}
          />
        }
      >
        <form id="add-plant-form" ref={formRef} onSubmit={handleSubmit} className="space-y-6" noValidate>
          <ChoiceGroup
            legend="Origen"
            variant="tile"
            layout="grid grid-cols-2 gap-2"
            options={SOURCE_OPTIONS}
            value={formData.source_type}
            onChange={changeSource}
          />

          {formData.source_type === 'Esqueje' && potentialMothers.length > 0 && (
            <div className="form-reveal">
              <Field label="Planta madre" optional hint="Copia su genética, banco y nombre.">
                <Select value={formData.mother_id} onChange={(e) => changeMother(e.target.value)}>
                  <option value="">Sin madre asignada</option>
                  {/* Las marcadas como madre van primero, en su propio grupo. */}
                  {mothers.length > 0 && (
                    <optgroup label="Madres">
                      {mothers.map(plant => (
                        <option key={plant.id} value={plant.id}>{plant.name} ({plant.strain || 'sin genética'})</option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label={mothers.length > 0 ? 'Otras plantas' : 'Plantas'}>
                    {others.map(plant => (
                      <option key={plant.id} value={plant.id}>{plant.name} ({plant.strain || 'sin genética'})</option>
                    ))}
                  </optgroup>
                </Select>
              </Field>
            </div>
          )}

          <FormSection title="La planta">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Genética" error={errors.strain}>
                <Input
                  type="text"
                  placeholder="Ej: Lemon Haze"
                  autoComplete="off"
                  autoCapitalize="words"
                  value={formData.strain}
                  onChange={(e) => changeStrain(e.target.value)}
                />
              </Field>
              <Field label="Banco" optional>
                <Input
                  type="text"
                  placeholder="Ej: Green House Seeds"
                  autoComplete="off"
                  autoCapitalize="words"
                  value={formData.breeder}
                  onChange={(e) => setFormData({ ...formData, breeder: e.target.value })}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_11rem]">
              <Field label="Nombre" hint={namePreview}>
                <Input
                  type="text"
                  autoComplete="off"
                  placeholder={formData.strain || 'Igual que la genética'}
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    setIsNameManuallyEdited(true);
                  }}
                />
              </Field>
              <Field label="Cantidad">
                <Stepper
                  value={formData.quantity}
                  onChange={(quantity) => setFormData({ ...formData, quantity })}
                  min={1}
                  max={MAX_QUANTITY}
                  unitName="planta"
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Dónde y desde cuándo">
            {activeCycles.length > 0 ? (
              <ChoiceOrSelect
                legend="Ciclo"
                placeholder="Elegir ciclo…"
                options={activeCycles.map((cycle) => ({ value: cycle.id, label: cycle.name }))}
                value={formData.cycle_id}
                onChange={(cycle_id) => { setFormData({ ...formData, cycle_id }); clear('cycle'); }}
                error={errors.cycle}
              />
            ) : (
              <p className="field-error">No hay ciclos activos. Creá uno desde Ciclos para sumarle plantas.</p>
            )}

            <DateField
              label={formData.source_type === 'Esqueje' ? 'Fecha del corte' : 'Fecha de siembra'}
              value={formData.planted_at}
              onChange={(planted_at) => setFormData({ ...formData, planted_at })}
            />

            <ChoiceGroup
              legend="Etapa en la que está"
              hint="Para sumar plantas que ya venían creciendo en otro lado."
              options={stageOptions(stages)}
              value={formData.stage}
              onChange={(stage) => setFormData({ ...formData, stage })}
              size="sm"
            />
          </FormSection>
        </form>
      </Modal>
    </>
  );
}
