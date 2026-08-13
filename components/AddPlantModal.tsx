"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import { Plant, Cycle } from "@/app/lib/types";
import { Loader2, Sprout } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/app/context/ToastContext";

const SEED_STAGES = ['Germinación', 'Plántula', 'Vegetativo', 'Floración'];

export default function AddPlantModal() {
  const router = useRouter();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeCycles, setActiveCycles] = useState<Cycle[]>([]);
  const [potentialMothers, setPotentialMothers] = useState<Plant[]>([]);

  const [formData, setFormData] = useState({
    strain: "",
    name: "",
    breeder: "",
    source_type: "Semilla" as "Semilla" | "Esqueje",
    mother_id: "" as string | number,
    stage: "Germinación",
    cycle_id: "" as string | number,
    planted_at: new Date().toISOString().split("T")[0],
    quantity: 1
  });

  const [isNameManuallyEdited, setIsNameManuallyEdited] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        const { data: cyclesData } = await supabase
          .from('cycles')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (cyclesData) setActiveCycles(cyclesData as unknown as Cycle[]);

        const { data: plantsData } = await supabase
          .from('plants')
          .select('*')
          .order('name', { ascending: true });

        if (plantsData) setPotentialMothers(plantsData as unknown as Plant[]);
      };
      fetchData();
    }
  }, [isOpen]);

  // Nombre sugerido a partir de la genética, hasta que el usuario lo edite.
  useEffect(() => {
    if (!isNameManuallyEdited && formData.strain) {
      setFormData(prev => ({ ...prev, name: prev.strain }));
    }
  }, [formData.strain, isNameManuallyEdited]);

  // Al elegir madre, se heredan sus datos.
  useEffect(() => {
    if (formData.source_type === 'Esqueje' && formData.mother_id) {
      const mother = potentialMothers.find(p => p.id.toString() === formData.mother_id.toString());

      if (mother) {
        setFormData(prev => ({
          ...prev,
          strain: mother.strain || '',
          breeder: mother.breeder || '',
          name: mother.name || '',
        }));
        setIsNameManuallyEdited(true);
      }
    }
  }, [formData.mother_id, formData.source_type, potentialMothers]);

  useEffect(() => {
    if (formData.source_type === 'Esqueje') {
      setFormData(prev => ({ ...prev, stage: 'Enraizamiento' }));
    } else if (!SEED_STAGES.includes(formData.stage) && formData.stage !== 'Germinación') {
      setFormData(prev => ({ ...prev, stage: 'Germinación' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.source_type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.strain || !formData.cycle_id) {
      showToast("Completá la genética y el ciclo", "error");
      return;
    }

    setLoading(true);

    try {
      const plantsToInsert = [];
      const quantity = Math.max(1, Number(formData.quantity));

      for (let i = 0; i < quantity; i++) {
        let finalName = formData.name;
        if (quantity > 1) {
          finalName = `${formData.name} #${i + 1}`;
        }

        plantsToInsert.push({
          strain: formData.strain,
          name: finalName,
          breeder: formData.breeder || null,
          source_type: formData.source_type,
          mother_id: formData.source_type === 'Esqueje' && formData.mother_id ? Number(formData.mother_id) : null,
          stage: formData.stage,
          planted_at: formData.planted_at,
          cycle_id: Number(formData.cycle_id),
          last_water: 'Nunca'
        });
      }

      const { error } = await supabase
        .from('plants')
        .insert(plantsToInsert);

      if (error) throw error;

      setIsOpen(false);
      resetForm();
      showToast(quantity > 1 ? `${quantity} plantas creadas` : "Planta creada");
      router.refresh();

    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudieron crear las plantas", "error");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      strain: "",
      name: "",
      breeder: "",
      source_type: "Semilla",
      mother_id: "",
      stage: "Germinación",
      cycle_id: "",
      planted_at: new Date().toISOString().split("T")[0],
      quantity: 1
    });
    setIsNameManuallyEdited(false);
  };

  const sourceOptions: Array<"Semilla" | "Esqueje"> = ["Semilla", "Esqueje"];

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
        description="Registrá uno o varios ejemplares dentro de un ciclo activo."
        size="xl"
        dismissOnBackdrop={false}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setIsOpen(false)}>
              Cancelar
            </button>
            <button type="submit" form="add-plant-form" className="btn btn-primary" disabled={loading}>
              {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {loading
                ? "Guardando..."
                : formData.quantity > 1
                  ? `Crear ${formData.quantity} plantas`
                  : "Crear planta"}
            </button>
          </>
        }
      >
        <form id="add-plant-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="field">
              <label htmlFor="plant-cycle" className="field-label">
                Ciclo activo <span aria-hidden="true">*</span>
              </label>
              <select
                id="plant-cycle"
                data-autofocus
                required
                className="field-input"
                value={formData.cycle_id}
                onChange={(e) => setFormData({...formData, cycle_id: e.target.value})}
              >
                <option value="" disabled>Seleccionar ciclo...</option>
                {activeCycles.map(cycle => (
                  <option key={cycle.id} value={cycle.id}>{cycle.name}</option>
                ))}
              </select>
            </div>

            {/* Segmentado real: radiogroup navegable con flechas por el navegador */}
            <fieldset className="field">
              <legend className="field-label mb-2">Origen</legend>
              <div className="flex gap-2 rounded-[var(--radius-md)] border border-line bg-surface-2 p-1">
                {sourceOptions.map((option) => {
                  const checked = formData.source_type === option;
                  return (
                    <label
                      key={option}
                      className={`flex flex-1 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] px-3 py-2 text-sm font-semibold transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[color:var(--ring)] ${
                        checked
                          ? "bg-brand text-[color:var(--brand-fg)]"
                          : "text-fg-muted hover:text-fg"
                      }`}
                    >
                      <input
                        type="radio"
                        name="source_type"
                        value={option}
                        checked={checked}
                        onChange={() =>
                          setFormData({
                            ...formData,
                            source_type: option,
                            ...(option === "Semilla" ? { mother_id: "" } : {}),
                          })
                        }
                        className="sr-only"
                      />
                      {option}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>

          {formData.source_type === 'Esqueje' && (
            <div className="field rounded-[var(--radius-lg)] border border-line bg-brand-soft p-4">
              <label htmlFor="plant-mother" className="field-label">Planta madre (opcional)</label>
              <select
                id="plant-mother"
                className="field-input"
                value={formData.mother_id}
                onChange={(e) => setFormData({...formData, mother_id: e.target.value})}
              >
                <option value="">Sin madre asignada</option>
                {potentialMothers.map(plant => (
                  <option key={plant.id} value={plant.id}>{plant.name} ({plant.strain || 'sin genética'})</option>
                ))}
              </select>
              <p className="field-hint">Al elegirla se copian su genética, banco y nombre.</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="field">
              <label htmlFor="plant-strain" className="field-label">
                Genética <span aria-hidden="true">*</span>
              </label>
              <input
                id="plant-strain"
                type="text"
                required
                placeholder="Ej: Lemon Haze"
                className="field-input"
                value={formData.strain}
                onChange={(e) => setFormData({...formData, strain: e.target.value})}
              />
            </div>
            <div className="field">
              <label htmlFor="plant-breeder" className="field-label">Banco</label>
              <input
                id="plant-breeder"
                type="text"
                placeholder="Ej: Green House Seeds"
                className="field-input"
                value={formData.breeder}
                onChange={(e) => setFormData({...formData, breeder: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="field">
              <label htmlFor="plant-name" className="field-label">Nombre identificador</label>
              <input
                id="plant-name"
                type="text"
                required
                className="field-input"
                value={formData.name}
                onChange={(e) => {
                  setFormData({...formData, name: e.target.value});
                  setIsNameManuallyEdited(true);
                }}
              />
              <p className="field-hint">Se usa para etiquetar las plantas. Con cantidad mayor a 1 se numeran solas.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="field">
                <label htmlFor="plant-quantity" className="field-label">Cantidad</label>
                <input
                  id="plant-quantity"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  required
                  className="field-input"
                  value={formData.quantity}
                  onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 1})}
                />
              </div>
              <div className="field">
                <label htmlFor="plant-planted-at" className="field-label">Fecha inicio</label>
                <input
                  id="plant-planted-at"
                  type="date"
                  required
                  className="field-input"
                  value={formData.planted_at}
                  onChange={(e) => setFormData({...formData, planted_at: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div className="field">
            <label htmlFor="plant-stage" className="field-label">Etapa inicial</label>
            <select
              id="plant-stage"
              className="field-input"
              value={formData.stage}
              onChange={(e) => setFormData({...formData, stage: e.target.value})}
            >
              {formData.source_type === 'Semilla' ? (
                <>
                  <option value="Germinación">Germinación</option>
                  <option value="Plántula">Plántula</option>
                  <option value="Vegetativo">Vegetativo</option>
                  <option value="Floración">Floración</option>
                </>
              ) : (
                <>
                  <option value="Enraizamiento">Enraizamiento</option>
                  <option value="Vegetativo">Vegetativo</option>
                  <option value="Floración">Floración</option>
                </>
              )}
              <option value="Secado">Secado</option>
              <option value="Curado">Curado</option>
            </select>
          </div>
        </form>
      </Modal>
    </>
  );
}
