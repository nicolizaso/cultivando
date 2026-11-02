"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Droplet, Thermometer, TriangleAlert } from "lucide-react";
import { addMeasurement } from "@/app/cycles/actions";
import { DEFAULT_VPD_RANGE, vpd, vpdLevel } from "@/app/lib/climate";
import type { VpdRange } from "@/app/lib/climate";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/app/context/ToastContext";
import { todayForInput } from "@/app/lib/dates";
import { DateField, Field, FormActions, Input, useFieldErrors } from "@/components/ui/form";

interface MeasurementModalProps {
  isOpen: boolean;
  onClose: () => void;
  cycleId: number;
  /** Rango sano de VPD para la etapa del ciclo, y el nombre de esa etapa. */
  vpdRange?: VpdRange;
  stage?: string | null;
}

const toNumber = (value: string) => {
  const parsed = Number(value.replace(",", ".").trim());
  return value.trim() === "" || !Number.isFinite(parsed) ? null : parsed;
};

const fmt = (n: number, digits = 1) => n.toLocaleString("es-AR", { maximumFractionDigits: digits });

export default function MeasurementModal({ isOpen, onClose, cycleId, vpdRange = DEFAULT_VPD_RANGE, stage }: MeasurementModalProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const { errors, validate, clear } = useFieldErrors<'temp' | 'hum'>();
  const [loading, setLoading] = useState(false);
  const [temp, setTemp] = useState("");
  const [hum, setHum] = useState("");
  const [date, setDate] = useState(() => todayForInput());

  const t = toNumber(temp);
  const h = toNumber(hum);

  // El VPD se ve mientras se escribe: es el dato que se mira para decidir si
  // hay que subir la humedad o ventilar, antes de guardar nada.
  const vpdValue = t !== null && h !== null ? vpd(t, h) : null;
  const level = vpdLevel(vpdValue, vpdRange);
  const range = `${fmt(vpdRange.min)} a ${fmt(vpdRange.max)} kPa${stage ? ` en ${stage.toLowerCase()}` : ""}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = validate({
      temp: t === null ? "Cargá la temperatura." : (t < -10 || t > 60) && "Revisá el número: está fuera de lo posible.",
      hum: h === null ? "Cargá la humedad." : (h < 0 || h > 100) && "La humedad va de 0 a 100.",
    }, formRef.current);
    if (!ok || t === null || h === null) return;

    setLoading(true);
    const res = await addMeasurement(cycleId, t, h, date);
    setLoading(false);

    if (res?.success) {
      router.refresh();
      onClose();
      setTemp("");
      setHum("");
      showToast("Medición guardada");
    } else {
      showToast(res?.error || "No se pudo guardar la medición", "error");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar clima"
      description="Lo que marca el termohigrómetro del espacio."
      footer={
        <FormActions form="measurement-form" onCancel={onClose} pending={loading} submitLabel="Guardar medición" />
      }
    >
      <form id="measurement-form" ref={formRef} onSubmit={handleSubmit} className="space-y-6" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Temperatura" error={errors.temp}>
            <Input
              data-autofocus
              type="text"
              inputMode="decimal"
              placeholder="24,5"
              suffix="°C"
              leading={<Thermometer size={18} />}
              className="metric text-xl"
              value={temp}
              onChange={(e) => { setTemp(e.target.value); clear("temp"); }}
            />
          </Field>
          <Field label="Humedad" error={errors.hum}>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="60"
              suffix="%"
              leading={<Droplet size={18} />}
              className="metric text-xl"
              value={hum}
              onChange={(e) => { setHum(e.target.value); clear("hum"); }}
            />
          </Field>
        </div>

        {/* Diagnóstico en vivo, en palabras y no sólo en color */}
        <div
          role="status"
          className={`rounded-[var(--radius-lg)] border p-4 transition-colors ${
            level === "ok"
              ? "border-[color:color-mix(in_srgb,var(--success)_35%,transparent)] bg-[color:var(--success-soft)]"
              : level === "unknown"
                ? "border-dashed border-line-strong bg-surface-2"
                : "border-[color:color-mix(in_srgb,var(--warning)_35%,transparent)] bg-[color:var(--warning-soft)]"
          }`}
        >
          <p className="flex items-baseline justify-between gap-3">
            <span className="metric-label">VPD</span>
            <span className="metric text-2xl text-fg">{vpdValue !== null ? `${fmt(vpdValue, 2)} kPa` : "–"}</span>
          </p>
          <p
            className={`mt-2 flex items-start gap-1.5 text-[0.8125rem] font-semibold leading-snug ${
              level === "ok" ? "text-[color:var(--success)]" : level === "unknown" ? "text-fg-muted" : "text-[color:var(--warning)]"
            }`}
          >
            {level === "ok" && <CheckCircle2 size={15} className="mt-px shrink-0" aria-hidden="true" />}
            {(level === "low" || level === "high") && <TriangleAlert size={15} className="mt-px shrink-0" aria-hidden="true" />}
            <span>
              {level === "unknown" && "Se calcula solo al cargar temperatura y humedad."}
              {level === "ok" && `En rango: ideal ${range}.`}
              {level === "low" && `Bajo, hay riesgo de hongos. Ideal ${range}.`}
              {level === "high" && `Alto, la planta transpira de más. Ideal ${range}.`}
            </span>
          </p>
        </div>

        <DateField label="Fecha de la lectura" value={date} onChange={setDate} />
      </form>
    </Modal>
  );
}
