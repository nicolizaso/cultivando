"use client";

import { useState } from "react";
import { createSpaceInline } from "@/app/actions/spaces";
import { AlertCircle, Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";

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
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onCancel}
      title="Crear espacio rápido"
      size="sm"
      dismissOnBackdrop={!loading}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={loading}>
            Cancelar
          </button>
          <button type="submit" form="inline-space-form" className="btn btn-primary" disabled={loading}>
            {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {loading ? "Creando..." : "Crear"}
          </button>
        </>
      }
    >
      <form id="inline-space-form" onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <p className="field-error" role="alert">
            <AlertCircle size={14} aria-hidden="true" />
            {error}
          </p>
        )}

        <div className="field">
          <label htmlFor="inline-space-name" className="field-label">Nombre del espacio</label>
          <input
            id="inline-space-name"
            data-autofocus
            type="text"
            required
            aria-invalid={error ? true : undefined}
            placeholder="Ej: Carpa 80x80"
            className="field-input"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
          />
        </div>

        <div className="field">
          <label htmlFor="inline-space-type" className="field-label">Tipo</label>
          <select
            id="inline-space-type"
            className="field-input"
            value={formData.type}
            onChange={(e) => setFormData({...formData, type: e.target.value})}
          >
            <option value="Indoor">Indoor</option>
            <option value="Outdoor">Outdoor</option>
            <option value="Mixto">Mixto</option>
          </select>
        </div>
      </form>
    </Modal>
  );
}
