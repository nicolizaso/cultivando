"use client";

import { useState, useTransition, useId } from "react";
import { Field, FormActions, FormSection, Input } from "@/components/ui/form";
import { Space } from "@/app/lib/types";
import { updateSpace } from "@/app/actions/spaces";
import { Maximize, Sun, Wind, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/app/context/ToastContext";

interface SpaceConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  space: Space | null;
}

/** Lo que se edita: los números viajan como texto mientras se escriben. */
type SpaceForm = Partial<Record<keyof Space, string | number | null>>;

const NUMERIC_FIELDS = [
  'width', 'length', 'height', 'area_m2',
  'light_watts', 'light_ppfd',
  'vent_extraction', 'vent_intraction', 'pot_capacity',
] as const;

/**
 * Quien lo abre le pone `key={space.id}`: al cambiar de espacio el formulario
 * se arma de nuevo con sus datos, sin copiar props al estado en un efecto.
 */
export default function SpaceConfigModal({ isOpen, onClose, space }: SpaceConfigModalProps) {
  const [formData, setFormData] = useState<SpaceForm>(() => ({ ...(space ?? {}) }));
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();
  const listId = useId();

  if (!space) return null;

  const handleChange = (field: keyof Space, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    startTransition(async () => {
      const dataToSave: SpaceForm = { ...formData };

      // Un campo vacío es "sin dato"; el servidor valida el resto.
      for (const field of NUMERIC_FIELDS) {
        const value = dataToSave[field];
        if (typeof value !== 'string') continue;
        const trimmed = value.trim().replace(',', '.');
        dataToSave[field] = trimmed === '' ? null : Number.isNaN(parseFloat(trimmed)) ? value : parseFloat(trimmed);
      }

      const res = await updateSpace(space.id, dataToSave);
      if (res.success) {
        onClose();
        showToast("Configuración guardada");
        router.refresh();
      } else {
        showToast(res.error || "No se pudo guardar la configuración", "error");
      }
    });
  };

  // El área sale del ancho por el largo: se ofrece, no se impone.
  const num = (v: unknown) => {
    const n = Number(String(v ?? '').replace(',', '.'));
    return String(v ?? '').trim() !== '' && Number.isFinite(n) ? n : null;
  };
  const w = num(formData.width);
  const l = num(formData.length);
  const computedArea = w !== null && l !== null ? Math.round(w * l * 100) / 100 : null;
  const areaText = computedArea !== null ? computedArea.toLocaleString('es-AR') : null;
  const areaMatches = computedArea !== null && num(formData.area_m2) === computedArea;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Ficha técnica"
      description={space.name}
      size="xl"
      dismissOnBackdrop={false}
      footer={
        <FormActions onSubmit={handleSave} onCancel={onClose} icon={Save} pending={isPending} submitLabel="Guardar ficha" />
      }
    >
      <div className="space-y-6">
        <FormSection icon={<Maximize size={17} />} title="Medidas" description="Todo opcional: cargá lo que sepas.">
          <div className="grid grid-cols-3 gap-3">
            <InputGroup label="Ancho" suffix="m" value={formData.width} onChange={(v) => handleChange('width', v)} placeholder="0,8" />
            <InputGroup label="Largo" suffix="m" value={formData.length} onChange={(v) => handleChange('length', v)} placeholder="0,8" />
            <InputGroup label="Alto" suffix="m" value={formData.height} onChange={(v) => handleChange('height', v)} placeholder="1,6" />
          </div>
          <InputGroup
            label="Superficie"
            suffix="m²"
            value={formData.area_m2}
            onChange={(v) => handleChange('area_m2', v)}
            hint={areaText && !areaMatches ? `Ancho por largo da ${areaText} m².` : undefined}
            below={
              areaText && !areaMatches ? (
                <div>
                  <button type="button" className="choice choice-sm" onClick={() => handleChange('area_m2', areaText)}>
                    Usar {areaText} m²
                  </button>
                </div>
              ) : undefined
            }
          />
        </FormSection>

        <FormSection icon={<Sun size={17} />} title="Luz">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InputGroup
              label="Tipo"
              numeric={false}
              value={formData.light_type}
              onChange={(v) => handleChange('light_type', v)}
              placeholder="LED, HPS, CMH…"
              list={`${listId}-light`}
            />
            <InputGroup label="Marca o modelo" numeric={false} value={formData.light_brand_model} onChange={(v) => handleChange('light_brand_model', v)} />
            <InputGroup label="Potencia" suffix="W" value={formData.light_watts} onChange={(v) => handleChange('light_watts', v)} placeholder="240" />
            <InputGroup label="PPFD promedio" suffix="µmol" value={formData.light_ppfd} onChange={(v) => handleChange('light_ppfd', v)} placeholder="700" />
          </div>
          <datalist id={`${listId}-light`}>
            {['LED', 'HPS', 'CMH', 'CFL', 'Sol'].map((option) => <option key={option} value={option} />)}
          </datalist>
        </FormSection>

        <FormSection icon={<Wind size={17} />} title="Aire y capacidad">
          <div className="grid grid-cols-2 gap-3">
            <InputGroup label="Extracción" suffix="m³/h" value={formData.vent_extraction} onChange={(v) => handleChange('vent_extraction', v)} />
            <InputGroup label="Intracción" suffix="m³/h" value={formData.vent_intraction} onChange={(v) => handleChange('vent_intraction', v)} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InputGroup label="Filtro de carbón" numeric={false} value={formData.vent_filter_brand} onChange={(v) => handleChange('vent_filter_brand', v)} placeholder="Marca o modelo" />
            <InputGroup label="Equipamiento extra" numeric={false} value={formData.vent_extra_equipment} onChange={(v) => handleChange('vent_extra_equipment', v)} placeholder="Humidificador, aire…" />
          </div>
          <InputGroup label="Entran" suffix="macetas" value={formData.pot_capacity} onChange={(v) => handleChange('pot_capacity', v)} placeholder="4" />
        </FormSection>
      </div>
    </Modal>
  );
}

function InputGroup({ label, value, onChange, placeholder, suffix, numeric = true, hint, below, list }: {
  label: string;
  value: string | number | undefined | null;
  onChange: (val: string) => void;
  placeholder?: string;
  suffix?: string;
  /** Las medidas aceptan coma decimal: se escriben como texto y el guardado las convierte. */
  numeric?: boolean;
  hint?: string;
  below?: React.ReactNode;
  list?: string;
}) {
  return (
    <Field label={label} hint={hint} below={below}>
      <Input
        type="text"
        inputMode={numeric ? "decimal" : undefined}
        autoComplete="off"
        suffix={suffix}
        value={value == null ? "" : String(value).replace(/^(-?\d+)\.(\d+)$/, "$1,$2")}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        list={list}
      />
    </Field>
  );
}
