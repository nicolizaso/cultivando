"use client";

import { useState, useTransition, useEffect } from "react";
import { Space } from "@/app/lib/types";
import { updateSpace } from "@/app/actions/spaces";
import { Maximize, Sun, Wind, X, Save } from "lucide-react";
import { useRouter } from "next/navigation";

interface SpaceConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  space: Space | null;
}

export default function SpaceConfigModal({ isOpen, onClose, space }: SpaceConfigModalProps) {
  // Use 'any' to allow string inputs for numeric fields during editing
  const [formData, setFormData] = useState<any>({});
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (space) {
      setFormData(space);
    }
  }, [space]);

  if (!isOpen || !space) return null;

  // Helper to handle value updates
  const handleChange = (field: keyof Space, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    startTransition(async () => {
      // Parse numeric fields before saving
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
        router.refresh();
      } else {
        alert(res.error || "Error al guardar");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="bg-card border border-card-border rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto flex flex-col shadow-sm">

        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-card-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="text-xl font-light text-foreground flex items-center gap-2">
              Configuración Técnica <span className="text-muted text-base">| {space.name}</span>
            </h2>
          </div>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">

          {/* Dimensions */}
          <section>
            <div className="flex items-center gap-2 mb-4 text-brand-primary">
              <Maximize size={20} />
              <h3 className="font-semibold text-lg text-foreground">Dimensiones</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <InputGroup
                label="Ancho (m)"
                type="number"
                value={formData.width}
                onChange={(v) => handleChange('width', v)}
                step="0.01"
              />
              <InputGroup
                label="Largo (m)"
                type="number"
                value={formData.length}
                onChange={(v) => handleChange('length', v)}
                step="0.01"
              />
              <InputGroup
                label="Alto (m)"
                type="number"
                value={formData.height}
                onChange={(v) => handleChange('height', v)}
                step="0.01"
              />
              <InputGroup
                label="Área (m²)"
                type="number"
                value={formData.area_m2}
                onChange={(v) => handleChange('area_m2', v)}
                step="0.01"
              />
            </div>
          </section>

          {/* Lighting */}
          <section>
            <div className="flex items-center gap-2 mb-4 text-amber-400">
              <Sun size={20} />
              <h3 className="font-semibold text-lg text-foreground">Iluminación</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <InputGroup
                 label="Tipo de Luz"
                 type="text"
                 value={formData.light_type}
                 onChange={(v) => handleChange('light_type', v)}
                 placeholder="Ej: LED, HPS"
               />
               <InputGroup
                 label="Marca / Modelo"
                 type="text"
                 value={formData.light_brand_model}
                 onChange={(v) => handleChange('light_brand_model', v)}
               />
               <InputGroup
                 label="Potencia (Watts)"
                 type="number"
                 value={formData.light_watts}
                 onChange={(v) => handleChange('light_watts', v)}
               />
               <InputGroup
                 label="PPFD Promedio"
                 type="number"
                 value={formData.light_ppfd}
                 onChange={(v) => handleChange('light_ppfd', v)}
               />
            </div>
          </section>

          {/* Climate */}
          <section>
            <div className="flex items-center gap-2 mb-4 text-blue-400">
              <Wind size={20} />
              <h3 className="font-semibold text-lg text-foreground">Clima y Capacidad</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <InputGroup
                 label="Extracción (m³/h)"
                 type="number"
                 value={formData.vent_extraction}
                 onChange={(v) => handleChange('vent_extraction', v)}
               />
               <InputGroup
                 label="Intracción (m³/h)"
                 type="number"
                 value={formData.vent_intraction}
                 onChange={(v) => handleChange('vent_intraction', v)}
               />
               <InputGroup
                 label="Filtro de Carbón"
                 type="text"
                 value={formData.vent_filter_brand}
                 onChange={(v) => handleChange('vent_filter_brand', v)}
                 placeholder="Marca/Modelo"
               />
               <InputGroup
                 label="Equipamiento Extra"
                 type="text"
                 value={formData.vent_extra_equipment}
                 onChange={(v) => handleChange('vent_extra_equipment', v)}
                 placeholder="Humidificador, AC..."
               />
               <div className="md:col-span-2">
                 <InputGroup
                   label="Capacidad de Macetas"
                   type="number"
                   value={formData.pot_capacity}
                   onChange={(v) => handleChange('pot_capacity', v)}
                 />
               </div>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-card-border bg-background flex justify-end gap-3 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-muted hover:text-foreground transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="px-6 py-2 bg-brand-primary hover:bg-brand-primary/80 text-foreground rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
          >
            {isPending ? "Guardando..." : <><Save size={18} /> Guardar Configuración</>}
          </button>
        </div>

      </div>
    </div>
  );
}

function InputGroup({ label, type, value, onChange, placeholder, step }: {
  label: string;
  type: "text" | "number";
  value: string | number | undefined | null;
  onChange: (val: string) => void;
  placeholder?: string;
  step?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold text-muted uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        step={step}
        className="bg-background border border-card-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-brand-primary/50 transition-colors"
      />
    </div>
  );
}
