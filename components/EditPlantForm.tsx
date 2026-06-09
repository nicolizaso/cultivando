"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { Plant, Cycle } from "@/app/lib/types";
import { getStageColor } from "@/app/lib/utils";
import { Sprout, Leaf, Flower, Wind, Thermometer, Calendar, Save, ArrowLeft, Trash2, Dna } from "lucide-react";
import Link from "next/link";

interface EditPlantFormProps {
  plant: Plant;
  cycles: Cycle[];
}

const STAGE_CONFIG = [
  { key: 'date_germinacion', label: 'Germinación', icon: Sprout, value: 'Germinación' },
  { key: 'date_plantula', label: 'Plántula', icon: Sprout, value: 'Plántula' },
  { key: 'date_enraizamiento', label: 'Enraizamiento', icon: Dna, value: 'Enraizamiento' },
  { key: 'date_vegetativo', label: 'Vegetativo', icon: Leaf, value: 'Vegetativo' },
  { key: 'date_floracion', label: 'Floración', icon: Flower, value: 'Floración' },
  { key: 'date_secado', label: 'Secado', icon: Wind, value: 'Secado' },
  { key: 'date_curado', label: 'Curado', icon: Thermometer, value: 'Curado' },
];

export default function EditPlantForm({ plant, cycles }: EditPlantFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Basic Info State
  const [basicInfo, setBasicInfo] = useState({
    name: plant.name,
    strain: plant.strain || '',
    breeder: plant.breeder || '',
    source_type: plant.source_type || 'Semilla',
    cycle_id: plant.cycle_id,
  });

  // Dates State
  const [dates, setDates] = useState({
    date_germinacion: plant.date_germinacion || '',
    date_plantula: plant.date_plantula || '',
    date_enraizamiento: plant.date_enraizamiento || '',
    date_vegetativo: plant.date_vegetativo || '',
    date_floracion: plant.date_floracion || '',
    date_secado: plant.date_secado || '',
    date_curado: plant.date_curado || '',
  });

  const handleBasicChange = (field: string, value: any) => {
    setBasicInfo(prev => ({ ...prev, [field]: value }));
  };

  const handleDateChange = (key: string, value: string) => {
    setDates(prev => ({ ...prev, [key]: value }));
  };

  const activateStage = (key: string) => {
    if (dates[key as keyof typeof dates]) {
      // Deactivate/Toggle off
      handleDateChange(key, '');
    } else {
      const today = new Date().toISOString().split('T')[0];
      handleDateChange(key, today);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Determine current stage based on the latest date set
      let currentStage = plant.stage;
      const latestDate = '';

      // Simple logic: the last stage with a date is the current stage
      // However, user might just be editing dates.
      // Ideally, we respect the user's manual stage selection, but here we are timeline-driven.
      // For now, let's keep the stage logic simple or just update dates.
      // If we want to auto-update stage:
      for (const config of STAGE_CONFIG) {
          if (dates[config.key as keyof typeof dates]) {
              currentStage = config.value; // value matches DB constraints usually
          }
      }

      // Also update planted_at if germinacion is set
      const plantedAt = dates.date_germinacion || plant.planted_at;

      const updates = {
        name: basicInfo.name,
        strain: basicInfo.strain,
        breeder: basicInfo.breeder,
        source_type: basicInfo.source_type,
        cycle_id: basicInfo.cycle_id,
        // Dates
        date_germinacion: dates.date_germinacion || null,
        date_plantula: dates.date_plantula || null,
        date_vegetativo: dates.date_vegetativo || null,
        date_floracion: dates.date_floracion || null,
        date_secado: dates.date_secado || null,
        date_curado: dates.date_curado || null,
        // Computed/Logic
        planted_at: plantedAt,
        stage: currentStage
      };

      const { error } = await supabase
        .from('plants')
        .update(updates)
        .eq('id', plant.id);

      if (error) throw error;

      router.push(`/plants/${plant.id}`);
      router.refresh();
    } catch (error) {
      alert("Error al guardar: " + error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`¿Estás seguro de que deseas eliminar la planta "${plant.name}"? Esta acción no se puede deshacer.`)) return;

    setLoading(true);
    try {
        const { error } = await supabase
            .from('plants')
            .delete()
            .eq('id', plant.id);

        if (error) throw error;

        router.push('/plants'); // Redirect to inventory
        router.refresh();
    } catch (error) {
        alert("Error al eliminar: " + error);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

      <div className="flex items-center justify-between">
        <Link href={`/plants/${plant.id}`} className="text-muted hover:text-foreground flex items-center gap-2 text-sm font-bold uppercase tracking-wider transition-colors">
          <ArrowLeft size={16} /> Volver
        </Link>
        <button
            onClick={handleDelete}
            className="text-red-500 hover:text-red-400 flex items-center gap-2 text-sm font-bold uppercase tracking-wider transition-colors"
        >
            <Trash2 size={16} /> Eliminar
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-8">

        {/* TOP SECTION: Basic Info */}
        <section className="bg-card p-6 rounded-2xl border border-card-border space-y-4">
          <h2 className="text-lg font-title text-foreground mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-primary"></span>
            Información Básica
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-muted mb-1 text-xs font-bold uppercase tracking-wider">Nombre</label>
              <input
                type="text"
                required
                className="w-full bg-background border border-card-border rounded-xl p-3 text-foreground focus:border-brand-primary outline-none transition-colors"
                value={basicInfo.name}
                onChange={(e) => handleBasicChange('name', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-muted mb-1 text-xs font-bold uppercase tracking-wider">Genética (Strain)</label>
              <input
                type="text"
                className="w-full bg-background border border-card-border rounded-xl p-3 text-foreground focus:border-brand-primary outline-none transition-colors"
                value={basicInfo.strain}
                onChange={(e) => handleBasicChange('strain', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-muted mb-1 text-xs font-bold uppercase tracking-wider">Banco (Breeder)</label>
              <input
                type="text"
                className="w-full bg-background border border-card-border rounded-xl p-3 text-foreground focus:border-brand-primary outline-none transition-colors"
                value={basicInfo.breeder}
                onChange={(e) => handleBasicChange('breeder', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-muted mb-1 text-xs font-bold uppercase tracking-wider">Origen</label>
              <select
                className="w-full bg-background border border-card-border rounded-xl p-3 text-foreground focus:border-brand-primary outline-none transition-colors appearance-none"
                value={basicInfo.source_type}
                onChange={(e) => handleBasicChange('source_type', e.target.value)}
              >
                <option value="Semilla">Semilla</option>
                <option value="Esqueje">Esqueje</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-muted mb-1 text-xs font-bold uppercase tracking-wider">Ciclo / Armario</label>
              <select
                className="w-full bg-background border border-card-border rounded-xl p-3 text-foreground focus:border-brand-primary outline-none transition-colors appearance-none"
                value={basicInfo.cycle_id || ''}
                onChange={(e) => handleBasicChange('cycle_id', Number(e.target.value))}
              >
                {cycles.map(cycle => (
                  <option key={cycle.id} value={cycle.id}>
                    {cycle.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* TIMELINE SECTION */}
        <section className="bg-card p-6 rounded-2xl border border-card-border">
           <h2 className="text-lg font-title text-foreground mb-6 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-primary"></span>
            Línea de Tiempo
          </h2>

          <div className="relative space-y-6 before:absolute before:inset-0 before:ml-6 before:w-0.5 before:bg-card-border">
            {STAGE_CONFIG.filter(stage => {
              if (basicInfo.source_type === 'Esqueje') {
                return !['Germinación', 'Plántula'].includes(stage.label);
              } else {
                return stage.label !== 'Enraizamiento';
              }
            }).map((stage, index) => {
              const dateKey = stage.key as keyof typeof dates;
              const dateValue = dates[dateKey];
              const isActive = !!dateValue;
              const Icon = stage.icon;
              const colors = getStageColor(stage.label);

              return (
                <div key={stage.key} className={`relative pl-16 transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}>
                  {/* Icon Indicator */}
                  <button
                    type="button"
                    onClick={() => activateStage(dateKey)}
                    className={`absolute left-0 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center border-2 z-10 transition-all duration-300 ${
                        isActive
                        ? `${colors.bgColor} ${colors.textColor} ${colors.borderColor}`
                        : 'bg-background text-muted border-card-border hover:border-brand-primary/50 hover:text-brand-primary'
                    }`}
                  >
                    <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
                  </button>

                  {/* Content Row */}
                  <div
                    onClick={() => activateStage(dateKey)}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                        isActive
                        ? `bg-background ${colors.borderColor}`
                        : 'bg-transparent border-transparent hover:bg-card-border'
                    }`}
                  >
                    <div>
                        <span className={`text-sm font-bold uppercase tracking-wider block ${isActive ? 'text-foreground' : 'text-muted'}`}>
                            {stage.label}
                        </span>
                        {!isActive && <span className="text-[10px] text-muted">Click para activar</span>}
                    </div>

                    <div onClick={(e) => e.stopPropagation()}>
                        {isActive ? (
                             <input
                                type="date"
                                className="bg-card border border-card-border rounded-lg px-3 py-1 text-sm text-foreground focus:border-brand-primary outline-none w-36"
                                value={dateValue ? dateValue.split('T')[0] : ''}
                                onChange={(e) => handleDateChange(dateKey, e.target.value)}
                             />
                        ) : (
                            <Calendar className="text-foreground" size={20} />
                        )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-primary hover:bg-brand-primary-hover text-foreground p-4 rounded-xl font-bold uppercase tracking-widest transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
        >
            {loading ? "Guardando..." : <><Save size={18} /> Guardar Cambios</>}
        </button>

      </form>
    </div>
  );
}
