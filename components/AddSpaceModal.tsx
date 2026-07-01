"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";

export default function AddSpaceModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    type: "Indoor", // Valor por defecto
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('spaces')
        .insert([{ 
            name: formData.name, 
            type: formData.type 
        }]);

      if (error) throw error;

      setIsOpen(false);
      setFormData({ name: "", type: "Indoor" });
      router.refresh();

    } catch (error) {
      alert("Error al crear espacio: " + error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="bg-brand-primary hover:bg-brand-primary-hover text-brand-bg px-4 py-2 rounded-lg font-title tracking-wide transition-colors shadow-sm shadow-brand-primary/20"
      >
        + NUEVO ESPACIO
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsOpen(false)}></div>
          
          <div className="relative bg-brand-card w-full max-w-sm rounded-2xl border border-card-border shadow-sm p-6 animate-in zoom-in duration-200">
            <h2 className="text-2xl font-title text-brand-primary mb-4 uppercase">Crear Espacio</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-brand-muted mb-1 text-xs font-bold uppercase">Nombre</label>
                <input 
                  autoFocus
                  type="text"
                  required
                  className="w-full bg-slate-50 border border-card-border rounded-lg p-3 text-foreground focus:border-brand-primary outline-none"
                  placeholder="Ej: Armario 80x80"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-brand-muted mb-1 text-xs font-bold uppercase">Tipo</label>
                <select 
                  className="w-full bg-slate-50 border border-card-border rounded-lg p-3 text-foreground focus:border-brand-primary outline-none cursor-pointer"
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                >
                  <option value="Indoor">🏠 Indoor</option>
                  <option value="Outdoor">☀️ Outdoor (Exterior)</option>
                  <option value="Mixto">🔄 Mixto</option>
                </select>
              </div>

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setIsOpen(false)} className="flex-1 py-3 text-brand-muted hover:text-foreground font-bold text-xs uppercase">Cancelar</button>
                <button type="submit" disabled={loading} className="flex-1 bg-brand-primary hover:bg-brand-primary-hover text-brand-bg py-3 rounded-lg font-title tracking-wide transition disabled:opacity-50">
                  {loading ? "CREANDO..." : "CREAR"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}