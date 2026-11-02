"use client";

import { useRef, useState } from "react";
import { createSpaceInline } from "@/app/actions/spaces";
import type { SpaceType } from "@/app/lib/types";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/app/context/ToastContext";
import { ChoiceGroup, Field, FormActions, Input, SPACE_TYPE_OPTIONS, useFieldErrors } from "@/components/ui/form";

const EMPTY = { name: "", type: "Indoor" as SpaceType };

export default function AddSpaceModal() {
  const router = useRouter();
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const { errors, validate, clear } = useFieldErrors<'name'>();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(EMPTY);

  // Por la Server Action, que valida el nombre y el tipo y pone el dueño.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate({ name: !formData.name.trim() && 'Ponele un nombre al espacio.' }, formRef.current)) return;

    setLoading(true);
    const res = await createSpaceInline(formData.name, formData.type);
    setLoading(false);

    if (!res.success) {
      showToast(res.error || "No se pudo crear el espacio", "error");
      return;
    }

    setIsOpen(false);
    setFormData(EMPTY);
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
        title="Nuevo espacio"
        description="El lugar físico donde crecen tus ciclos."
        footer={
          <FormActions
            form="add-space-form"
            onCancel={() => setIsOpen(false)}
            icon={Plus}
            pending={loading}
            pendingLabel="Creando…"
            submitLabel="Crear espacio"
          />
        }
      >
        <form id="add-space-form" ref={formRef} onSubmit={handleSubmit} className="space-y-6" noValidate>
          <ChoiceGroup
            legend="Tipo"
            variant="tile"
            layout="grid grid-cols-1 gap-2 sm:grid-cols-3"
            options={SPACE_TYPE_OPTIONS}
            value={formData.type}
            onChange={(type) => setFormData({ ...formData, type })}
          />

          <Field label="Nombre" error={errors.name} hint="Uno que reconozcas de un vistazo.">
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
    </>
  );
}
