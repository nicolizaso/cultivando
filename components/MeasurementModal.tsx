"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addMeasurement } from "@/app/cycles/actions";

interface MeasurementModalProps {
  isOpen: boolean;
  onClose: () => void;
  cycleId: number;
}

export default function MeasurementModal({ isOpen, onClose, cycleId }: MeasurementModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [temp, setTemp] = useState("");
  const [hum, setHum] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const res = await addMeasurement(
        cycleId, 
        parseFloat(temp), 
        parseFloat(hum), 
        date
    );

    setLoading(false);

    if (res?.success) {
      router.refresh();
      onClose();
      setTemp("");
      setHum("");
    } else {
      alert("Error: " + res?.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>

      <div className="relative bg-brand-card w-full max-w-xs rounded-2xl border border-card-border shadow-sm p-6 animate-in zoom-in duration-200">
        <h2 className="text-xl font-title text-brand-primary mb-4 uppercase text-center">
            🌡️ Registrar Clima
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div>
            <label className="block text-brand-muted mb-1 text-xs font-bold uppercase">Fecha</label>
            <input 
              type="date"
              required
              className="w-full bg-slate-50 border border-card-border rounded-lg p-3 text-foreground text-center focus:border-brand-primary outline-none"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
                <label className="block text-brand-muted mb-1 text-xs font-bold uppercase text-center">Temp (°C)</label>
                <input 
                type="number"
                step="0.1"
                required
                placeholder="24.5"
                className="w-full bg-slate-50 border border-card-border rounded-lg p-3 text-foreground text-center text-xl font-bold focus:border-brand-primary outline-none"
                value={temp}
                onChange={(e) => setTemp(e.target.value)}
                />
            </div>
            <div className="flex-1">
                <label className="block text-brand-muted mb-1 text-xs font-bold uppercase text-center">Humedad (%)</label>
                <input 
                type="number"
                step="0.1"
                required
                placeholder="60"
                className="w-full bg-slate-50 border border-card-border rounded-lg p-3 text-foreground text-center text-xl font-bold focus:border-brand-primary outline-none"
                value={hum}
                onChange={(e) => setHum(e.target.value)}
                />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-brand-primary hover:bg-brand-primary-hover text-brand-bg py-3 rounded-lg font-title tracking-wide transition disabled:opacity-50 mt-2"
          >
            {loading ? "..." : "GUARDAR"}
          </button>
          
          <button type="button" onClick={onClose} className="w-full text-xs text-brand-muted hover:text-foreground underline">
            Cancelar
          </button>

        </form>
      </div>
    </div>
  );
}