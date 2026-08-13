"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSpaceInline } from "@/app/actions/spaces";
import { createCycleWithSpace } from "@/app/cycles/actions";
import { createPlantsBulk } from "@/app/actions/plants";
import { AlertCircle, Loader2, Warehouse, RefreshCw, Leaf } from "lucide-react";
import Modal from "@/components/ui/Modal";

export default function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data
  const [spaceId, setSpaceId] = useState<number | null>(null);
  const [cycleId, setCycleId] = useState<number | null>(null);

  // Forms
  const [spaceForm, setSpaceForm] = useState({ name: "Mi Primer Espacio", type: "Indoor" });
  const [cycleForm, setCycleForm] = useState({ name: "Ciclo Inicial", startDate: new Date().toISOString().split('T')[0] });
  const [plantsForm, setPlantsForm] = useState({ count: 1, strain: "Genética", source: "Semilla" });

  const [isOpen, setIsOpen] = useState(true);

  if (!isOpen) return null;

  const handleNext = async () => {
    setLoading(true);
    setError(null);
    try {
      if (step === 1) {
        const res = await createSpaceInline(spaceForm.name, spaceForm.type as any);
        if (res.success && res.spaceId) {
          setSpaceId(res.spaceId);
          setStep(2);
        } else throw new Error(res.error || "Error creando espacio");
      } else if (step === 2) {
        if (!spaceId) throw new Error("Falta el espacio");
        const res = await createCycleWithSpace(cycleForm.name, cycleForm.startDate, spaceId);
        if (res.success && res.cycleId) {
          setCycleId(res.cycleId);
          setStep(3);
        } else throw new Error(res.error || "Error creando ciclo");
      } else if (step === 3) {
        if (!cycleId) throw new Error("Falta el ciclo");
        const res = await createPlantsBulk(plantsForm.count, plantsForm.strain, plantsForm.source as any, cycleId);
        if (res.success) {
          setIsOpen(false);
          router.refresh();
        } else throw new Error(res.error || "Error creando plantas");
      }
    } catch (err: any) {
      setError(err.message || "Ocurrió un error");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    setIsOpen(false);
    router.refresh();
  };

  const stepTitles = ['Tu espacio', 'Tu primer ciclo', 'Tus plantas'];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleSkip}
      title="Bienvenido a Cultiva con el Primo"
      description="Configuremos tu entorno inicial en tres pasos."
      dismissOnBackdrop={false}
      footer={
        <>
          <button type="button" onClick={handleSkip} className="btn btn-ghost">
            Omitir por ahora
          </button>
          <button type="button" onClick={handleNext} disabled={loading} className="btn btn-primary">
            {loading && <Loader2 className="animate-spin" size={16} aria-hidden="true" />}
            {loading ? 'Guardando...' : step === 3 ? 'Finalizar' : 'Siguiente'}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Progreso: lista ordenada, no una fila de círculos decorativos */}
        <ol className="flex items-center gap-2" aria-label={`Paso ${step} de 3: ${stepTitles[step - 1]}`}>
          {[1, 2, 3].map(s => (
            <li key={s} className="flex flex-1 items-center gap-2">
              <span
                aria-current={step === s ? 'step' : undefined}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  step >= s
                    ? 'bg-brand text-[color:var(--brand-fg)]'
                    : 'bg-surface-3 text-fg-muted'
                }`}
              >
                {s}
              </span>
              {s < 3 && (
                <span
                  className={`h-px flex-1 ${step > s ? 'bg-[color:var(--brand)]' : 'bg-[color:var(--border)]'}`}
                  aria-hidden="true"
                />
              )}
            </li>
          ))}
        </ol>

        {error && (
          <p className="field-error" role="alert">
            <AlertCircle size={14} aria-hidden="true" />
            {error}
          </p>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[color:var(--brand-text)]">
              <Warehouse size={16} aria-hidden="true" />
              Paso 1: tu espacio
            </h3>

            <div className="field">
              <label htmlFor="onb-space-name" className="field-label">Nombre</label>
              <input
                id="onb-space-name"
                data-autofocus
                type="text"
                className="field-input"
                value={spaceForm.name}
                onChange={e => setSpaceForm({...spaceForm, name: e.target.value})}
              />
            </div>

            <div className="field">
              <label htmlFor="onb-space-type" className="field-label">Tipo</label>
              <select
                id="onb-space-type"
                className="field-input"
                value={spaceForm.type}
                onChange={e => setSpaceForm({...spaceForm, type: e.target.value})}
              >
                <option value="Indoor">Indoor</option>
                <option value="Outdoor">Outdoor</option>
                <option value="Mixto">Mixto</option>
              </select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[color:var(--brand-text)]">
              <RefreshCw size={16} aria-hidden="true" />
              Paso 2: tu primer ciclo
            </h3>

            <div className="field">
              <label htmlFor="onb-cycle-name" className="field-label">Nombre del ciclo</label>
              <input
                id="onb-cycle-name"
                data-autofocus
                type="text"
                className="field-input"
                value={cycleForm.name}
                onChange={e => setCycleForm({...cycleForm, name: e.target.value})}
              />
            </div>

            <div className="field">
              <label htmlFor="onb-cycle-date" className="field-label">Fecha de inicio</label>
              <input
                id="onb-cycle-date"
                type="date"
                className="field-input"
                value={cycleForm.startDate}
                onChange={e => setCycleForm({...cycleForm, startDate: e.target.value})}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[color:var(--brand-text)]">
              <Leaf size={16} aria-hidden="true" />
              Paso 3: tus plantas
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="field">
                <label htmlFor="onb-plants-count" className="field-label">Cantidad</label>
                <input
                  id="onb-plants-count"
                  data-autofocus
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="50"
                  className="field-input"
                  value={plantsForm.count}
                  onChange={e => setPlantsForm({...plantsForm, count: Number(e.target.value)})}
                />
              </div>

              <div className="field">
                <label htmlFor="onb-plants-source" className="field-label">Origen</label>
                <select
                  id="onb-plants-source"
                  className="field-input"
                  value={plantsForm.source}
                  onChange={e => setPlantsForm({...plantsForm, source: e.target.value})}
                >
                  <option value="Semilla">Semilla</option>
                  <option value="Esqueje">Esqueje</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label htmlFor="onb-plants-strain" className="field-label">Genética</label>
              <input
                id="onb-plants-strain"
                type="text"
                className="field-input"
                value={plantsForm.strain}
                onChange={e => setPlantsForm({...plantsForm, strain: e.target.value})}
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
