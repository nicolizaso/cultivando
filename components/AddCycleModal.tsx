"use client";

import { useState } from "react";
import { createCycleWithSpace } from "@/app/cycles/actions";
import { useRouter } from "next/navigation";
import { Space } from "@/app/lib/types";
import { Loader2, Plus, Warehouse } from "lucide-react";
import EmptyState from "./EmptyState";
import CreateSpaceInlineModal from "./CreateSpaceInlineModal";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/app/context/ToastContext";
import { todayForInput } from "@/app/lib/dates";

interface AddCycleModalProps {
  /** Los espacios del usuario: los trae la página, no el navegador. */
  spaces: Pick<Space, 'id' | 'name' | 'type'>[];
}

export default function AddCycleModal({ spaces }: AddCycleModalProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showInlineSpaceModal, setShowInlineSpaceModal] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    startDate: todayForInput(),
    spaceId: "",
  });

  const handleSpaceCreated = (newSpaceId: number) => {
    setFormData(prev => ({ ...prev, spaceId: newSpaceId.toString() }));
    setShowInlineSpaceModal(false);
    // El espacio nuevo llega en las props con el refresh del servidor.
    router.refresh();
  };

  // Se crea por la Server Action, que valida y pone el dueño: antes se
  // insertaba desde el navegador con el user_id que mandaba el cliente.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.spaceId) {
      showToast("Elegí un espacio para el ciclo", "error");
      return;
    }

    setLoading(true);
    const res = await createCycleWithSpace(formData.name, formData.startDate, Number(formData.spaceId));
    setLoading(false);

    if (!res.success) {
      showToast(res.error || "No se pudo crear el ciclo", "error");
      return;
    }

    setIsOpen(false);
    setFormData({ name: "", startDate: todayForInput(), spaceId: "" });
    showToast("Ciclo creado");
    router.refresh();
  };

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="btn btn-primary">
        <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
        Nuevo ciclo
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Iniciar nuevo ciclo"
        description="Configurá tu próximo cultivo."
        dismissOnBackdrop={false}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setIsOpen(false)}>
              Cancelar
            </button>
            <button
              type="submit"
              form="add-cycle-form"
              className="btn btn-primary"
              disabled={loading || spaces.length === 0}
            >
              {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {loading ? "Creando..." : "Crear ciclo"}
            </button>
          </>
        }
      >
        <form id="add-cycle-form" onSubmit={handleSubmit} className="space-y-5">
          <div className="field">
            <label htmlFor="cycle-name" className="field-label">Nombre del ciclo</label>
            <input
              id="cycle-name"
              data-autofocus
              type="text"
              placeholder="Ej: Verano 2026"
              required
              className="field-input"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
            />
          </div>

          <div className="field">
            <label htmlFor="cycle-space" className="field-label">Espacio asignado</label>

            {spaces.length > 0 ? (
              <select
                id="cycle-space"
                required
                className="field-input"
                value={formData.spaceId}
                onChange={(e) => setFormData({...formData, spaceId: e.target.value})}
              >
                <option value="">Seleccionar espacio...</option>
                {spaces.map(space => (
                  <option key={space.id} value={space.id}>
                    {space.name} ({space.type})
                  </option>
                ))}
              </select>
            ) : (
              <EmptyState
                title="Sin espacios"
                description="Todavía no creaste ningún espacio donde alojar el ciclo."
                icon={Warehouse}
                className="p-5"
                action={
                  <button
                    type="button"
                    onClick={() => setShowInlineSpaceModal(true)}
                    className="btn btn-secondary"
                  >
                    <Plus size={16} aria-hidden="true" />
                    Crear espacio rápido
                  </button>
                }
              />
            )}
          </div>

          <div className="field">
            <label htmlFor="cycle-start" className="field-label">Fecha de inicio</label>
            <input
              id="cycle-start"
              type="date"
              required
              className="field-input"
              value={formData.startDate}
              onChange={(e) => setFormData({...formData, startDate: e.target.value})}
            />
          </div>
        </form>
      </Modal>

      {showInlineSpaceModal && (
        <CreateSpaceInlineModal
          onSuccess={handleSpaceCreated}
          onCancel={() => setShowInlineSpaceModal(false)}
        />
      )}
    </>
  );
}
