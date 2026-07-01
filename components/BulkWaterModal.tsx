"use client";

import { useState } from "react";
import { bulkWaterPlants } from "@/app/cycles/actions";

interface BulkWaterModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: number[];
  onSuccess: () => void; // Para limpiar la selección después
  cycleId: number;
}

export default function BulkWaterModal({ isOpen, onClose, selectedIds, onSuccess, cycleId }: BulkWaterModalProps) {
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState("");
  const [nutrients, setNutrients] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Construimos una nota automática con los detalles
    const noteDetails = `Riego registrado para ${selectedIds.length} plantas.\nCantidad: ${amount || 'No especificada'}\nNutrientes: ${nutrients || 'Solo agua'}`;

    const res = await bulkWaterPlants(selectedIds, new Date(date).toISOString(), noteDetails, cycleId);

    setLoading(false);

    if (res?.success) {
      onSuccess(); // Limpia selección y cierra
      onClose();
      // Reset form
      setAmount("");
      setNutrients("");
    } else {
      alert("Error al guardar");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop oscuro */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>

      <div className="relative bg-brand-card w-full max-w-sm rounded-2xl border border-card-border shadow-sm p-6 animate-in zoom-in duration-200">
        <h2 className="text-xl font-title text-blue-400 mb-1 uppercase">Riego Masivo</h2>
        <p className="text-xs text-brand-muted mb-6">
            Aplicando a <span className="font-bold text-foreground">{selectedIds.length} plantas</span> seleccionadas.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div>
            <label className="block text-brand-muted mb-1 text-xs font-bold uppercase">Fecha</label>
            <input 
              type="date"
              required
              className="w-full bg-slate-50 border border-card-border rounded-lg p-3 text-foreground focus:border-brand-primary outline-none"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-brand-muted mb-1 text-xs font-bold uppercase">Cantidad (Lts / ml)</label>
            <input 
              type="text"
              placeholder="Ej: 50 Litros totales"
              className="w-full bg-slate-50 border border-card-border rounded-lg p-3 text-foreground focus:border-brand-primary outline-none"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-brand-muted mb-1 text-xs font-bold uppercase">Nutrientes / Notas</label>
            <textarea 
              rows={3}
              placeholder="Ej: Base A+B (2ml/L), CalMag..."
              className="w-full bg-slate-50 border border-card-border rounded-lg p-3 text-foreground focus:border-brand-primary outline-none resize-none"
              value={nutrients}
              onChange={(e) => setNutrients(e.target.value)}
            />
          </div>

          <div className="flex gap-3 mt-6 pt-2">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-3 text-brand-muted hover:text-foreground font-bold text-xs uppercase"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-foreground py-3 rounded-lg font-title tracking-wide transition disabled:opacity-50"
            >
              {loading ? "REGISTRANDO..." : "REGISTRAR RIEGO"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}