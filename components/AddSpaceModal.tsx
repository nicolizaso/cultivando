"use client";

import { useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/app/context/ToastContext";

export default function AddSpaceModal() {
  const router = useRouter();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    type: "Indoor",
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
      showToast(`Espacio "${formData.name}" creado`);
      router.refresh();

    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudo crear el espacio", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="btn btn-primary">
        <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
        Nuevo espacio
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Crear espacio"
        description="Un espacio es el lugar físico donde viven tus ciclos."
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setIsOpen(false)}>
              Cancelar
            </button>
            <button type="submit" form="add-space-form" className="btn btn-primary" disabled={loading}>
              {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {loading ? "Creando..." : "Crear espacio"}
            </button>
          </>
        }
      >
        <form id="add-space-form" onSubmit={handleSubmit} className="space-y-5">
          <div className="field">
            <label htmlFor="space-name" className="field-label">Nombre</label>
            <input
              id="space-name"
              data-autofocus
              type="text"
              required
              className="field-input"
              placeholder="Ej: Armario 80x80"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
            />
            <p className="field-hint">Usá un nombre que reconozcas de un vistazo.</p>
          </div>

          <div className="field">
            <label htmlFor="space-type" className="field-label">Tipo</label>
            <select
              id="space-type"
              className="field-input"
              value={formData.type}
              onChange={(e) => setFormData({...formData, type: e.target.value})}
            >
              <option value="Indoor">Indoor</option>
              <option value="Outdoor">Outdoor (exterior)</option>
              <option value="Mixto">Mixto</option>
            </select>
          </div>
        </form>
      </Modal>
    </>
  );
}
