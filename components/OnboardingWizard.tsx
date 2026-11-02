"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSpaceInline } from "@/app/actions/spaces";
import { createCycleWithSpace } from "@/app/cycles/actions";
import { createPlantsBulk } from "@/app/actions/plants";
import { ArrowRight, Check } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { todayForInput } from "@/app/lib/dates";
import { ONBOARDING_SKIPPED_COOKIE, ONBOARDING_SKIPPED_MAX_AGE } from "@/app/lib/onboarding";
import type { SpaceType } from "@/app/lib/types";
import { ChoiceGroup, DateField, Field, FormActions, FormAlert, Input, SOURCE_OPTIONS, SPACE_TYPE_OPTIONS, Stepper } from "@/components/ui/form";

export default function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data
  const [spaceId, setSpaceId] = useState<number | null>(null);
  const [cycleId, setCycleId] = useState<number | null>(null);

  // Forms
  const [spaceForm, setSpaceForm] = useState<{ name: string; type: SpaceType }>({ name: "Mi primer espacio", type: "Indoor" });
  const [cycleForm, setCycleForm] = useState({ name: "Primer ciclo", startDate: todayForInput() });
  const [plantsForm, setPlantsForm] = useState<{ count: number; strain: string; source: "Semilla" | "Esqueje" }>({ count: 1, strain: "", source: "Semilla" });

  const [isOpen, setIsOpen] = useState(true);

  if (!isOpen) return null;

  const handleNext = async () => {
    setLoading(true);
    setError(null);
    try {
      if (step === 1) {
        const res = await createSpaceInline(spaceForm.name, spaceForm.type);
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
        const res = await createPlantsBulk(plantsForm.count, plantsForm.strain.trim() || "Sin especificar", plantsForm.source, cycleId);
        if (res.success) {
          setIsOpen(false);
          router.refresh();
        } else throw new Error(res.error || "Error creando plantas");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error");
    } finally {
      setLoading(false);
    }
  };

  // Omitir queda recordado: antes el asistente volvía a abrirse en cada visita
  // al panel hasta crear un espacio y un ciclo.
  const handleSkip = () => {
    document.cookie = `${ONBOARDING_SKIPPED_COOKIE}=1; path=/; max-age=${ONBOARDING_SKIPPED_MAX_AGE}; samesite=lax`;
    setIsOpen(false);
    router.refresh();
  };

  const stepTitles = ['Dónde cultivás', 'Tu primer ciclo', 'Tus plantas'];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleSkip}
      title="Bienvenido a Cultivando"
      description="Tres pasos y queda todo listo para empezar a registrar."
      dismissOnBackdrop={false}
      footer={
        <FormActions
          onSubmit={handleNext}
          pending={loading}
          icon={step === 3 ? Check : ArrowRight}
          submitLabel={step === 3 ? 'Empezar' : 'Siguiente'}
          extra={
            <button type="button" onClick={handleSkip} className="btn btn-ghost" disabled={loading}>
              Omitir
            </button>
          }
        />
      }
    >
      <div className="space-y-6">
        {/* Progreso: tres tramos con nombre, no una fila de círculos */}
        <ol className="grid grid-cols-3 gap-2" aria-label={`Paso ${step} de 3: ${stepTitles[step - 1]}`}>
          {stepTitles.map((title, i) => {
            const s = i + 1;
            return (
              <li key={title} aria-current={step === s ? 'step' : undefined} className="space-y-1.5">
                <span
                  className={`block h-1.5 rounded-full transition-colors duration-300 ${
                    step >= s ? 'bg-brand' : 'bg-surface-3'
                  }`}
                  aria-hidden="true"
                />
                <span className={`block text-xs font-semibold ${step === s ? 'text-fg' : 'text-fg-subtle'}`}>
                  {title}
                </span>
              </li>
            );
          })}
        </ol>

        {error && <FormAlert>{error}</FormAlert>}

        {step === 1 && (
          <div key="step-1" className="space-y-6 animate-slide-in-right">
            <ChoiceGroup
              legend="¿Dónde cultivás?"
              variant="tile"
              layout="grid grid-cols-1 gap-2 sm:grid-cols-3"
              options={SPACE_TYPE_OPTIONS}
              value={spaceForm.type}
              onChange={(type) => setSpaceForm({ ...spaceForm, type })}
            />
            <Field label="Nombre del espacio" hint="Después podés sumar más.">
              <Input
                type="text"
                autoComplete="off"
                value={spaceForm.name}
                onChange={e => setSpaceForm({ ...spaceForm, name: e.target.value })}
              />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div key="step-2" className="space-y-6 animate-slide-in-right">
            <Field label="Nombre del ciclo" hint="Un ciclo es una tanda de plantas que arranca junta.">
              <Input
                type="text"
                autoComplete="off"
                value={cycleForm.name}
                onChange={e => setCycleForm({ ...cycleForm, name: e.target.value })}
              />
            </Field>
            <DateField
              label="Arranca"
              value={cycleForm.startDate}
              onChange={startDate => setCycleForm({ ...cycleForm, startDate })}
            />
          </div>
        )}

        {step === 3 && (
          <div key="step-3" className="space-y-6 animate-slide-in-right">
            <ChoiceGroup
              legend="Origen"
              variant="tile"
              layout="grid grid-cols-2 gap-2"
              options={SOURCE_OPTIONS}
              value={plantsForm.source}
              onChange={(source) => setPlantsForm({ ...plantsForm, source })}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_11rem]">
              <Field label="Genética" optional>
                <Input
                  type="text"
                  autoComplete="off"
                  autoCapitalize="words"
                  placeholder="Northern Lights, Critical…"
                  value={plantsForm.strain}
                  onChange={e => setPlantsForm({ ...plantsForm, strain: e.target.value })}
                />
              </Field>
              <Field label="Cuántas">
                <Stepper
                  value={plantsForm.count}
                  onChange={count => setPlantsForm({ ...plantsForm, count })}
                  min={1}
                  max={50}
                  unitName="planta"
                />
              </Field>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
