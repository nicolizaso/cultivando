"use client";

import { useRef, useState } from "react";
import { createSpaceInline } from "@/app/actions/spaces";
import type { SpaceType } from "@/app/lib/types";
import { Plus } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { ChoiceGroup, Field, FormActions, FormAlert, Input, SPACE_TYPE_OPTIONS, useFieldErrors } from "@/components/ui/form";

interface CreateSpaceInlineModalProps {
  onSuccess: (spaceId: number) => void;
  onCancel: () => void;
}

/** Crear un espacio sin salir del formulario que lo necesita (un ciclo, una mudanza). */
export default function CreateSpaceInlineModal({ onSuccess, onCancel }: CreateSpaceInlineModalProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const { errors, validate, clear } = useFieldErrors<'name'>();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<{ name: string; type: SpaceType }>({ name: "", type: "Indoor" });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate({ name: !formData.name.trim() && 'Ponele un nombre al espacio.' }, formRef.current)) return;

    setLoading(true);
    setError(null);

    try {
      const res = await createSpaceInline(formData.name, formData.type);
      if (res.success && res.spaceId) {
        onSuccess(res.spaceId);
      } else {
        setError(res.error || "No se pudo crear el espacio.");
      }
    } catch {
      setError("No hubo conexión. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onCancel}
      title="Nuevo espacio"
      dismissOnBackdrop={!loading}
      footer={
        <FormActions
          form="inline-space-form"
          onCancel={onCancel}
          icon={Plus}
          pending={loading}
          pendingLabel="Creando…"
          submitLabel="Crear y usar"
        />
      }
    >
      <form id="inline-space-form" ref={formRef} onSubmit={handleSubmit} className="space-y-6" noValidate>
        {error && <FormAlert>{error}</FormAlert>}

        <ChoiceGroup
          legend="Tipo"
          variant="tile"
          layout="grid grid-cols-1 gap-2 sm:grid-cols-3"
          options={SPACE_TYPE_OPTIONS}
          value={formData.type}
          onChange={(type) => setFormData({ ...formData, type })}
        />

        <Field label="Nombre" error={errors.name}>
          <Input
            data-autofocus
            type="text"
            autoComplete="off"
            placeholder={formData.type === "Outdoor" ? "Ej: Balcón" : "Ej: Carpa 80x80"}
            value={formData.name}
            onChange={(e) => { setFormData({ ...formData, name: e.target.value }); clear('name'); }}
          />
        </Field>
      </form>
    </Modal>
  );
}
