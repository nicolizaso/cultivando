"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSpaceInline } from "@/app/actions/spaces";
import { createCycleWithSpace } from "@/app/cycles/actions";
import { createPlantsBulk } from "@/app/actions/plants";
import { Loader2, Warehouse, RefreshCw, Leaf } from "lucide-react";

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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-card border border-card-border w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-brand-primary/10 p-6 flex flex-col items-center justify-center border-b border-card-border text-center">
            <h2 className="text-xl font-bold text-foreground font-title tracking-wide mb-1">¡Bienvenido a Cultivapp!</h2>
            <p className="text-xs text-muted font-body">Configuremos tu entorno inicial</p>
        </div>

        {/* Progress Tracker */}
        <div className="flex items-center justify-center p-4 gap-2 border-b border-card-border/50 bg-background/50">
            {[1,2,3].map(s => (
                <div key={s} className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${step >= s ? 'bg-brand-primary text-white' : 'bg-card-border text-muted'}`}>
                        {s}
                    </div>
                    {s < 3 && <div className={`w-6 h-px ${step > s ? 'bg-brand-primary' : 'bg-card-border'}`} />}
                </div>
            ))}
        </div>

        <div className="p-6">
            {error && (
                <div className="mb-4 p-3 rounded-xl text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 text-center">
                {error}
                </div>
            )}

            {/* STEP 1 */}
            {step === 1 && (
                <div className="space-y-4 animate-in slide-in-from-right-4">
                    <div className="flex items-center gap-2 mb-4 text-brand-primary">
                        <Warehouse size={18} />
                        <h3 className="font-bold text-sm">Paso 1: Tu Espacio</h3>
                    </div>
                    <div>
                        <label className="block text-muted mb-1.5 text-[10px] font-bold uppercase tracking-wider">Nombre</label>
                        <input type="text" className="w-full bg-background border border-card-border rounded-xl p-3 text-sm focus:border-brand-primary outline-none" value={spaceForm.name} onChange={e => setSpaceForm({...spaceForm, name: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-muted mb-1.5 text-[10px] font-bold uppercase tracking-wider">Tipo</label>
                        <select className="w-full bg-background border border-card-border rounded-xl p-3 text-sm focus:border-brand-primary outline-none appearance-none" value={spaceForm.type} onChange={e => setSpaceForm({...spaceForm, type: e.target.value})}>
                            <option value="Indoor">Indoor</option>
                            <option value="Outdoor">Outdoor</option>
                            <option value="Mixto">Mixto</option>
                        </select>
                    </div>
                </div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
                <div className="space-y-4 animate-in slide-in-from-right-4">
                    <div className="flex items-center gap-2 mb-4 text-brand-primary">
                        <RefreshCw size={18} />
                        <h3 className="font-bold text-sm">Paso 2: Tu Primer Ciclo</h3>
                    </div>
                    <div>
                        <label className="block text-muted mb-1.5 text-[10px] font-bold uppercase tracking-wider">Nombre del Ciclo</label>
                        <input type="text" className="w-full bg-background border border-card-border rounded-xl p-3 text-sm focus:border-brand-primary outline-none" value={cycleForm.name} onChange={e => setCycleForm({...cycleForm, name: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-muted mb-1.5 text-[10px] font-bold uppercase tracking-wider">Fecha de Inicio</label>
                        <input type="date" className="w-full bg-background border border-card-border rounded-xl p-3 text-sm focus:border-brand-primary outline-none" value={cycleForm.startDate} onChange={e => setCycleForm({...cycleForm, startDate: e.target.value})} />
                    </div>
                </div>
            )}

            {/* STEP 3 */}
            {step === 3 && (
                <div className="space-y-4 animate-in slide-in-from-right-4">
                    <div className="flex items-center gap-2 mb-4 text-brand-primary">
                        <Leaf size={18} />
                        <h3 className="font-bold text-sm">Paso 3: Tus Plantas</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-muted mb-1.5 text-[10px] font-bold uppercase tracking-wider">Cantidad</label>
                            <input type="number" min="1" max="50" className="w-full bg-background border border-card-border rounded-xl p-3 text-sm focus:border-brand-primary outline-none" value={plantsForm.count} onChange={e => setPlantsForm({...plantsForm, count: Number(e.target.value)})} />
                        </div>
                        <div>
                            <label className="block text-muted mb-1.5 text-[10px] font-bold uppercase tracking-wider">Origen</label>
                            <select className="w-full bg-background border border-card-border rounded-xl p-3 text-sm focus:border-brand-primary outline-none appearance-none" value={plantsForm.source} onChange={e => setPlantsForm({...plantsForm, source: e.target.value})}>
                                <option value="Semilla">Semilla</option>
                                <option value="Esqueje">Esqueje</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-muted mb-1.5 text-[10px] font-bold uppercase tracking-wider">Genética (Nombre)</label>
                        <input type="text" className="w-full bg-background border border-card-border rounded-xl p-3 text-sm focus:border-brand-primary outline-none" value={plantsForm.strain} onChange={e => setPlantsForm({...plantsForm, strain: e.target.value})} />
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-8 pt-4 border-t border-card-border">
                <button
                    type="button"
                    onClick={handleSkip}
                    className="flex-1 py-3 text-muted hover:text-foreground font-bold text-xs uppercase transition-colors"
                >
                    Omitir por ahora
                </button>
                <button
                    type="button"
                    onClick={handleNext}
                    disabled={loading}
                    className="flex-1 bg-brand-primary hover:bg-brand-primary-hover text-white py-3 rounded-xl font-bold text-sm tracking-wide transition-all active:scale-[0.98] disabled:opacity-50 flex justify-center items-center gap-2"
                >
                    {loading ? <Loader2 className="animate-spin" size={16} /> : step === 3 ? "FINALIZAR" : "SIGUIENTE"}
                </button>
            </div>
        </div>

      </div>
    </div>
  );
}
