"use client";

import { useState } from "react";
import { createSpaceInline } from "@/app/actions/spaces";
import type { SpaceType } from "@/app/lib/types";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/app/context/ToastContext";

export default function AddSpaceModal() {
  const router = useRouter();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<{ name: string; type: SpaceType }>({
    name: "",
    type: "Indoor",
  });

  // Por la Server Action, que valida el nombre y el tipo y pone el dueño.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await createSpaceInline(formData.name, formData.type);
    setLoading(false);

    if (!res.success) {
      showToast(res.error || "No se pudo crear el espacio", "error");
      return;
    }

    setIsOpen(false);
    setFormData({ name: "", type: "Indoor" });
    showToast(`Espacio "${formData.name.trim()}" creado`);
    router.refresh();
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
              onChange={(e) => setFormData({...formData, type: e.target.value as SpaceType})}
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
