"use client";

import { useState } from "react";
import { createSpaceInline } from "@/app/actions/spaces";
import { Loader2 } from "lucide-react";

interface CreateSpaceInlineModalProps {
  onSuccess: (spaceId: number) => void;
  onCancel: () => void;
}

export default function CreateSpaceInlineModal({ onSuccess, onCancel }: CreateSpaceInlineModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: "", type: "Indoor" });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await createSpaceInline(formData.name, formData.type as 'Indoor' | 'Outdoor' | 'Mixto');
      if (res.success && res.spaceId) {
        onSuccess(res.spaceId);
      } else {
        setError(res.error || "Error al crear el espacio");
      }
    } catch (err) {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[60] bg-background/95 backdrop-blur-md flex flex-col justify-center items-center p-6 animate-in fade-in zoom-in-95 duration-200">
      <div className="w-full max-w-sm bg-card border border-card-border rounded-2xl shadow-xl p-6">
        <h3 className="text-lg font-bold font-title mb-4">Crear Espacio Rápido</h3>

        {error && (
          <div className="mb-4 p-3 rounded-xl text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-muted mb-1.5 text-[10px] font-bold uppercase tracking-wider">Nombre del Espacio</label>
            <input
              type="text"
              required
              placeholder="Ej: Carpa 80x80"
              className="w-full bg-background border border-card-border rounded-xl p-3 text-sm focus:border-brand-primary outline-none transition-colors"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-muted mb-1.5 text-[10px] font-bold uppercase tracking-wider">Tipo</label>
            <select
              className="w-full bg-background border border-card-border rounded-xl p-3 text-sm focus:border-brand-primary outline-none appearance-none transition-colors"
              value={formData.type}
              onChange={(e) => setFormData({...formData, type: e.target.value})}
            >
              <option value="Indoor">🏠 Indoor</option>
              <option value="Outdoor">☀️ Outdoor</option>
              <option value="Mixto">⛅ Mixto</option>
            </select>
          </div>

          <div className="flex gap-3 mt-6 pt-4 border-t border-card-border">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 text-muted hover:text-foreground font-bold text-xs uppercase transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-brand-primary hover:bg-brand-primary-hover text-white py-3 rounded-xl font-bold text-sm tracking-wide transition-all active:scale-[0.98] disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : "CREAR"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
