"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";
import { Space } from "@/app/lib/types";
import { Loader2, Plus, Warehouse } from "lucide-react";
import EmptyState from "./EmptyState";
import CreateSpaceInlineModal from "./CreateSpaceInlineModal";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/app/context/ToastContext";

export default function AddCycleModal() {
  const router = useRouter();
  const { showToast } = useToast();
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

    if (!formData.spaceId) {
      showToast("Elegí un espacio para el ciclo", "error");
      return;
    }

    setLoading(true);

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
      showToast("Ciclo creado");
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No se pudo crear el ciclo", "error");
    } finally {
      setLoading(false);
    }
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
