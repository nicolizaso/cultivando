"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import { Plant, Cycle } from "@/app/lib/types";
import { Sprout, Fingerprint, Calendar, Layers, Hash } from "lucide-react";

const BASE_INPUT_CLASSES = "w-full bg-background rounded-lg p-3 text-foreground focus:border-brand-primary outline-none transition";
const INPUT_CLASSES = `${BASE_INPUT_CLASSES} border border-card-border`;

export default function AddPlantModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeCycles, setActiveCycles] = useState<Cycle[]>([]);
  const [potentialMothers, setPotentialMothers] = useState<Plant[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    strain: "",
    name: "",
    breeder: "",
    source_type: "Semilla" as "Semilla" | "Esqueje",
    mother_id: "" as string | number, // Store as string for select, convert to number on submit
    stage: "Germinación",
    cycle_id: "" as string | number,
    planted_at: new Date().toISOString().split("T")[0],
    quantity: 1
  });

  const [isNameManuallyEdited, setIsNameManuallyEdited] = useState(false);

  const SEED_STAGES = ['Germinación', 'Plántula', 'Vegetativo', 'Floración'];
  const CLONE_STAGES = ['Enraizamiento', 'Vegetativo', 'Floración'];

  // Fetch data on mount (or when modal opens)
  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        // Fetch active cycles
        const { data: cyclesData } = await supabase
          .from('cycles')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (cyclesData) setActiveCycles(cyclesData as unknown as Cycle[]);

        // Fetch potential mothers (all plants)
        // Optimization: Could filter only those in Veg/Flower, but "existing plants" is the request.
        const { data: plantsData } = await supabase
          .from('plants')
          .select('*')
          .order('name', { ascending: true });

        if (plantsData) setPotentialMothers(plantsData as unknown as Plant[]);
      };
      fetchData();
    }
  }, [isOpen]);

  // Smart Naming Effect
  useEffect(() => {
    if (!isNameManuallyEdited && formData.strain) {
      setFormData(prev => ({ ...prev, name: prev.strain }));
    }
  }, [formData.strain, isNameManuallyEdited]);

  // Preload Mother Data when a mother is selected
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
        // Prevent smart naming from overwriting the mother's name
        setIsNameManuallyEdited(true);
      }
    }
  }, [formData.mother_id, formData.source_type, potentialMothers]);

  // Stage Switch Effect based on Source Type
  useEffect(() => {
    if (formData.source_type === 'Esqueje') {
      setFormData(prev => ({ ...prev, stage: 'Enraizamiento' }));
    } else {
       // Reset to Germinación if switching back to seed and current stage is not valid for seed?
       // Or just default to Germinación.
       if (!SEED_STAGES.includes(formData.stage) && formData.stage !== 'Germinación') {
          setFormData(prev => ({ ...prev, stage: 'Germinación' }));
       }
    }
  }, [formData.source_type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.strain || !formData.cycle_id) {
      alert("Por favor completa los campos requeridos (Genética, Ciclo).");
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

      // Success
      setIsOpen(false);
      resetForm();
      router.refresh();

    } catch (error: any) {
      alert("Error al crear plantas: " + error.message);
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

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="bg-brand-primary hover:bg-brand-primary-hover text-brand-bg px-4 py-2 rounded-lg font-title tracking-wide transition-colors text-sm md:text-base shadow-sm shadow-brand-primary/20 flex items-center gap-2"
      >
        <Sprout size={18} />
        NUEVA PLANTA
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
          ></div>

          <div className="relative bg-card w-full max-w-2xl rounded-2xl border border-card-border shadow-sm p-6 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            
            <h2 className="text-2xl font-title text-brand-primary mb-1 uppercase flex items-center gap-2">
              <Sprout className="text-brand-primary" /> Nueva Planta
            </h2>
            <p className="text-xs text-muted mb-6">Completa los datos para registrar nuevos ejemplares.</p>

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* SECTION 1: ORIGEN & CICLO */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Ciclo (Required) */}
                <div>
                  <label className="block text-muted mb-1 text-xs font-bold uppercase">Ciclo Activo *</label>
                  <div className="relative">
                    <select 
                      required
                      className={`${INPUT_CLASSES} appearance-none`}
                      value={formData.cycle_id}
                      onChange={(e) => setFormData({...formData, cycle_id: e.target.value})}
                    >
                      <option value="" disabled>Seleccionar Ciclo...</option>
                      {activeCycles.map(cycle => (
                        <option key={cycle.id} value={cycle.id}>{cycle.name}</option>
                      ))}
                    </select>
                    <Layers className="absolute right-3 top-3 text-muted pointer-events-none" size={16} />
                  </div>
                </div>

                 {/* Origen */}
                 <div>
                  <label className="block text-muted mb-1 text-xs font-bold uppercase">Origen</label>
                  <div className="flex bg-brand-bg p-1 rounded-lg border border-card-border">
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, source_type: 'Semilla', mother_id: ""})}
                      className={`flex-1 py-2 rounded text-xs font-bold uppercase transition-all ${formData.source_type === 'Semilla' ? 'bg-brand-primary text-brand-bg shadow' : 'text-muted hover:text-foreground'}`}
                    >
                      Semilla
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, source_type: 'Esqueje'})}
                      className={`flex-1 py-2 rounded text-xs font-bold uppercase transition-all ${formData.source_type === 'Esqueje' ? 'bg-brand-primary text-brand-bg shadow' : 'text-muted hover:text-foreground'}`}
                    >
                      Esqueje
                    </button>
                  </div>
                </div>
              </div>

              {/* Si es Esqueje, mostrar Planta Madre */}
              {formData.source_type === 'Esqueje' && (
                <div className="bg-brand-primary/5 p-4 rounded-xl border border-brand-primary/10">
                  <label className="block text-brand-primary mb-1 text-xs font-bold uppercase">Planta Madre (Opcional)</label>
                  <select
                    className={`${BASE_INPUT_CLASSES} border border-brand-primary/20`}
                    value={formData.mother_id}
                    onChange={(e) => setFormData({...formData, mother_id: e.target.value})}
                  >
                    <option value="">-- Sin Madre Asignada --</option>
                    {potentialMothers.map(plant => (
                      <option key={plant.id} value={plant.id}>{plant.name} ({plant.strain || '?'})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* SECTION 2: GENÉTICA */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-muted mb-1 text-xs font-bold uppercase">Genética (Strain) *</label>
                  <div className="relative">
                    <input 
                      type="text"
                      required
                      placeholder="Ej: Lemon Haze"
                      className={`${INPUT_CLASSES} pl-10`}
                      value={formData.strain}
                      onChange={(e) => setFormData({...formData, strain: e.target.value})}
                    />
                    <Fingerprint className="absolute left-3 top-3 text-muted" size={16} />
                  </div>
                </div>
                <div>
                  <label className="block text-muted mb-1 text-xs font-bold uppercase">Banco (Breeder)</label>
                  <input
                    type="text"
                    placeholder="Ej: Green House Seeds"
                    className={INPUT_CLASSES}
                    value={formData.breeder}
                    onChange={(e) => setFormData({...formData, breeder: e.target.value})}
                  />
                </div>
              </div>

              {/* SECTION 3: DATOS INDIVIDUALES */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-muted mb-1 text-xs font-bold uppercase">Nombre Identificador</label>
                  <input
                    type="text"
                    required
                    className={INPUT_CLASSES}
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({...formData, name: e.target.value});
                      setIsNameManuallyEdited(true);
                    }}
                  />
                  <p className="text-[10px] text-muted mt-1">Se usará para etiquetar las plantas.</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                   <div>
                      <label className="block text-muted mb-1 text-xs font-bold uppercase">Cantidad</label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          required
                          className={`${INPUT_CLASSES} pl-9`}
                          value={formData.quantity}
                          onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value)})}
                        />
                        <Hash className="absolute left-3 top-3 text-muted" size={16} />
                      </div>
                   </div>
                   <div>
                      <label className="block text-muted mb-1 text-xs font-bold uppercase">Fecha Inicio</label>
                      <input
                        type="date"
                        required
                        className={INPUT_CLASSES}
                        value={formData.planted_at}
                        onChange={(e) => setFormData({...formData, planted_at: e.target.value})}
                      />
                   </div>
                </div>
              </div>

              <div>
                <label className="block text-muted mb-1 text-xs font-bold uppercase">Etapa Inicial</label>
                <select
                  className={INPUT_CLASSES}
                  value={formData.stage}
                  onChange={(e) => setFormData({...formData, stage: e.target.value})}
                >
                  {formData.source_type === 'Semilla' ? (
                     <>
                        <option value="Germinación">🌱 Germinación</option>
                        <option value="Plántula">🌱 Plántula</option>
                        <option value="Vegetativo">🌿 Vegetativo</option>
                        <option value="Floración">🌸 Floración</option>
                     </>
                  ) : (
                     <>
                        <option value="Enraizamiento">🧬 Enraizamiento</option>
                        <option value="Vegetativo">🌿 Vegetativo</option>
                        <option value="Floración">🌸 Floración</option>
                     </>
                  )}
                  <option value="Secado">🍂 Secado</option>
                  <option value="Curado">🏺 Curado</option>
                </select>
              </div>

              {/* ACTIONS */}
              <div className="flex gap-3 mt-6 pt-4 border-t border-card-border">
                <button 
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 py-3 text-muted hover:text-foreground font-bold text-xs uppercase transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-brand-primary hover:bg-brand-primary-hover text-brand-bg py-3 rounded-lg font-title tracking-wide transition disabled:opacity-50 shadow-sm shadow-brand-primary/20"
                >
                  {loading ? "GUARDANDO..." : `CREAR ${formData.quantity > 1 ? `(${formData.quantity})` : ''}`}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </>
  );
}
