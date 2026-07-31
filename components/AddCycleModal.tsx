"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import { Space } from "@/app/lib/types";
import { Plus, Warehouse } from "lucide-react";
import EmptyState from "./EmptyState";
import CreateSpaceInlineModal from "./CreateSpaceInlineModal";

export default function AddCycleModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [showInlineSpaceModal, setShowInlineSpaceModal] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    startDate: new Date().toISOString().split('T')[0],
    spaceId: "",
  });

  const fetchSpaces = async () => {
    const { data } = await supabase.from('spaces').select('*');
    if (data) setSpaces(data as Space[]);
  };

  useEffect(() => {
    fetchSpaces();
  }, []);

  const handleSpaceCreated = async (newSpaceId: number) => {
    await fetchSpaces();
    setFormData(prev => ({ ...prev, spaceId: newSpaceId.toString() }));
    setShowInlineSpaceModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!formData.spaceId) {
      alert("Debes seleccionar un espacio");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('cycles')
        .insert([
          {
            name: formData.name,
            start_date: formData.startDate,
            space_id: Number(formData.spaceId),
            is_active: true,
            user_id: (await supabase.auth.getUser()).data.user?.id,
          },
        ]);

      if (error) throw error;

      setIsOpen(false);
      setFormData({ name: "", startDate: new Date().toISOString().split('T')[0], spaceId: "" });
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Error creando ciclo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-brand-primary hover:bg-brand-primary-hover text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm shadow-brand-primary/10 active:scale-95"
      >
        <Plus size={18} strokeWidth={2.5} />
        NUEVO CICLO
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-card-border w-full max-w-md rounded-2xl shadow-sm overflow-hidden animate-in zoom-in-95 duration-200 relative">
            
            <div className="bg-background/50 p-6 border-b border-card-border">
              <h2 className="text-xl font-bold text-foreground tracking-wide">Iniciar Nuevo Ciclo</h2>
              <p className="text-muted text-xs mt-1">Configura tu próximo cultivo</p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              
              <div>
                <label className="block text-muted mb-1.5 text-[10px] font-bold uppercase tracking-wider">Nombre del Ciclo</label>
                <input 
                  type="text"
                  placeholder="Ej: Verano 2024"
                  required
                  className="w-full bg-background border border-card-border rounded-xl p-3 text-foreground text-sm focus:border-brand-primary outline-none transition-colors"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-muted mb-1.5 text-[10px] font-bold uppercase tracking-wider">Espacio Asignado</label>

                {spaces.length > 0 ? (
                  <select
                    required
                    className="w-full bg-background border border-card-border rounded-xl p-3 text-foreground text-sm focus:border-brand-primary outline-none appearance-none transition-colors"
                    value={formData.spaceId}
                    onChange={(e) => setFormData({...formData, spaceId: e.target.value})}
                  >
                    <option value="">Seleccionar Espacio...</option>
                    {spaces.map(space => (
                      <option key={space.id} value={space.id}>
                         {space.type === 'Indoor' ? '🏠' : '☀️'} {space.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <EmptyState
                    title="Sin Espacios"
                    description="No tienes espacios creados aún."
                    icon={Warehouse}
                    className="p-4 py-6"
                    action={
                      <button
                        type="button"
                        onClick={() => setShowInlineSpaceModal(true)}
                        className="bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary px-4 py-2 rounded-xl text-xs font-bold transition-colors"
                      >
                        + Crear Espacio Rápido
                      </button>
                    }
                  />
                )}
              </div>

              <div>
                <label className="block text-muted mb-1.5 text-[10px] font-bold uppercase tracking-wider">Fecha de Inicio</label>
                <input 
                  type="date"
                  required
                  className="w-full bg-background border border-card-border rounded-xl p-3 text-foreground text-sm focus:border-brand-primary outline-none transition-colors scheme-light"
                  value={formData.startDate}
                  onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                />
              </div>

              <div className="flex gap-3 mt-8 pt-4 border-t border-card-border">
                <button 
                  type="button" 
                  onClick={() => setIsOpen(false)} 
                  className="flex-1 py-3 text-muted hover:text-foreground font-bold text-xs uppercase transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={loading || spaces.length === 0}
                  className="flex-1 bg-brand-primary hover:bg-brand-primary-hover text-white py-3 rounded-xl font-bold text-sm tracking-wide transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? "CREANDO..." : "CONFIRMAR"}
                </button>
              </div>
            </form>

            {showInlineSpaceModal && (
              <CreateSpaceInlineModal
                onSuccess={handleSpaceCreated}
                onCancel={() => setShowInlineSpaceModal(false)}
              />
            )}

          </div>
        </div>
      )}
    </>
  );
}
