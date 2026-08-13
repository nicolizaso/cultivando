"use client";

import { useState, useTransition, useEffect, useId } from "react";
import { Space } from "@/app/lib/types";
import { updateSpace } from "@/app/actions/spaces";
import { Maximize, Sun, Wind, Save, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/app/context/ToastContext";

interface SpaceConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  space: Space | null;
}

export default function SpaceConfigModal({ isOpen, onClose, space }: SpaceConfigModalProps) {
  // Los campos numéricos se editan como texto y se parsean al guardar.
  const [formData, setFormData] = useState<any>({});
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    if (space) {
      setFormData(space);
    }
  }, [space]);

  if (!space) return null;

  const handleChange = (field: keyof Space, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    startTransition(async () => {
      const dataToSave = { ...formData };
      const numericFields = [
        'width', 'length', 'height', 'area_m2',
        'light_watts', 'light_ppfd',
        'vent_extraction', 'vent_intraction', 'pot_capacity'
      ];

      numericFields.forEach(field => {
        if (typeof dataToSave[field] === 'string') {
          const val = dataToSave[field].trim();
          if (val === '') {
            dataToSave[field] = null;
          } else {
            const parsed = parseFloat(val);
            if (!isNaN(parsed)) {
              dataToSave[field] = parsed;
            }
          }
        }
      });

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Configuración técnica"
      description={space.name}
      size="xl"
      dismissOnBackdrop={false}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" onClick={handleSave} disabled={isPending} className="btn btn-primary">
            {isPending ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Save size={16} aria-hidden="true" />
            )}
            {isPending ? "Guardando..." : "Guardar configuración"}
          </button>
        </>
      }
    >
      <div className="space-y-8">
        <Section icon={<Maximize size={18} aria-hidden="true" />} title="Dimensiones">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <InputGroup label="Ancho (m)" type="number" value={formData.width} onChange={(v) => handleChange('width', v)} step="0.01" autoFocus />
            <InputGroup label="Largo (m)" type="number" value={formData.length} onChange={(v) => handleChange('length', v)} step="0.01" />
            <InputGroup label="Alto (m)" type="number" value={formData.height} onChange={(v) => handleChange('height', v)} step="0.01" />
            <InputGroup label="Área (m²)" type="number" value={formData.area_m2} onChange={(v) => handleChange('area_m2', v)} step="0.01" />
          </div>
        </Section>

        <Section icon={<Sun size={18} aria-hidden="true" />} title="Iluminación">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InputGroup label="Tipo de luz" type="text" value={formData.light_type} onChange={(v) => handleChange('light_type', v)} placeholder="Ej: LED, HPS" />
            <InputGroup label="Marca o modelo" type="text" value={formData.light_brand_model} onChange={(v) => handleChange('light_brand_model', v)} />
            <InputGroup label="Potencia (watts)" type="number" value={formData.light_watts} onChange={(v) => handleChange('light_watts', v)} />
            <InputGroup label="PPFD promedio" type="number" value={formData.light_ppfd} onChange={(v) => handleChange('light_ppfd', v)} />
          </div>
        </Section>

        <Section icon={<Wind size={18} aria-hidden="true" />} title="Clima y capacidad">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InputGroup label="Extracción (m³/h)" type="number" value={formData.vent_extraction} onChange={(v) => handleChange('vent_extraction', v)} />
            <InputGroup label="Intracción (m³/h)" type="number" value={formData.vent_intraction} onChange={(v) => handleChange('vent_intraction', v)} />
            <InputGroup label="Filtro de carbón" type="text" value={formData.vent_filter_brand} onChange={(v) => handleChange('vent_filter_brand', v)} placeholder="Marca o modelo" />
            <InputGroup label="Equipamiento extra" type="text" value={formData.vent_extra_equipment} onChange={(v) => handleChange('vent_extra_equipment', v)} placeholder="Humidificador, aire acondicionado" />
            <div className="md:col-span-2">
              <InputGroup label="Capacidad de macetas" type="number" value={formData.pot_capacity} onChange={(v) => handleChange('pot_capacity', v)} />
            </div>
          </div>
        </Section>
      </div>
    </Modal>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-4 flex items-center gap-2 font-title text-base font-semibold text-fg">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-[color:var(--brand-text)]">
          {icon}
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function InputGroup({ label, type, value, onChange, placeholder, step, autoFocus }: {
  label: string;
  type: "text" | "number";
  value: string | number | undefined | null;
  onChange: (val: string) => void;
  placeholder?: string;
  step?: string;
  autoFocus?: boolean;
}) {
  const id = useId();

  return (
    <div className="field">
      <label htmlFor={id} className="field-label">{label}</label>
      <input
        id={id}
        data-autofocus={autoFocus || undefined}
        type={type}
        inputMode={type === "number" ? "decimal" : undefined}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        step={step}
        className="field-input"
      />
    </div>
  );
}
