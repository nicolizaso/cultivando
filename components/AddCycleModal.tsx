"use client";

import { useRef, useState } from "react";
import { createCycleWithSpace } from "@/app/cycles/actions";
import { useRouter } from "next/navigation";
import { Space } from "@/app/lib/types";
import { Plus, Warehouse } from "lucide-react";
import EmptyState from "./EmptyState";
import CreateSpaceInlineModal from "./CreateSpaceInlineModal";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/app/context/ToastContext";
import { todayForInput } from "@/app/lib/dates";
import { ChoiceOrSelect, DateField, Field, FormActions, Input, useFieldErrors } from "@/components/ui/form";
import SpaceTypeIcon from "./SpaceTypeIcon";

/** "Primavera 2026": la estación (del hemisferio sur) y el año de una fecha. */
function seasonName(key: string): string | null {
  const match = /^(\d{4})-(\d{2})/.exec(key);
  if (!match) return null;
  const month = Number(match[2]);
  const season =
    month === 12 || month <= 2 ? 'Verano' : month <= 5 ? 'Otoño' : month <= 8 ? 'Invierno' : 'Primavera';
  return `${season} ${match[1]}`;
}

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

  const formRef = useRef<HTMLFormElement>(null);
  const { errors, validate, clear } = useFieldErrors<'name' | 'space'>();
  // Con un solo espacio no hay nada que elegir: ya viene marcado.
  const initialForm = () => ({
    name: "",
    startDate: todayForInput(),
    spaceId: spaces.length === 1 ? String(spaces[0].id) : "",
  });
  const [formData, setFormData] = useState(initialForm);

  const handleSpaceCreated = (newSpaceId: number) => {
    setFormData(prev => ({ ...prev, spaceId: newSpaceId.toString() }));
    clear('space');
    setShowInlineSpaceModal(false);
    // El espacio nuevo llega en las props con el refresh del servidor.
    router.refresh();
  };

  // Se crea por la Server Action, que valida y pone el dueño: antes se
  // insertaba desde el navegador con el user_id que mandaba el cliente.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const ok = validate({
      name: !formData.name.trim() && 'Ponele un nombre para reconocerlo.',
      space: !formData.spaceId && 'Elegí dónde va a crecer.',
    }, formRef.current);
    if (!ok) return;

    setLoading(true);
    const res = await createCycleWithSpace(formData.name, formData.startDate, Number(formData.spaceId));
    setLoading(false);

    if (!res.success) {
      showToast(res.error || "No se pudo crear el ciclo", "error");
      return;
    }

    setIsOpen(false);
    setFormData(initialForm());
    showToast("Ciclo creado");
    router.refresh();
  };

  // Un nombre listo para usar: la temporada y el año del arranque.
  const suggestion = seasonName(formData.startDate);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="btn btn-primary">
        <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
        Nuevo ciclo
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Nuevo ciclo"
        description="Una tanda de plantas que arranca y termina junta."
        dismissOnBackdrop={false}
        footer={
          <FormActions
            form="add-cycle-form"
            onCancel={() => setIsOpen(false)}
            icon={Plus}
            pending={loading}
            pendingLabel="Creando…"
            submitLabel="Crear ciclo"
            disabled={spaces.length === 0}
          />
        }
      >
        <form id="add-cycle-form" ref={formRef} onSubmit={handleSubmit} className="space-y-6" noValidate>
          <Field
            label="Nombre"
            error={errors.name}
            below={
              suggestion && formData.name !== suggestion ? (
                <div>
                  <button
                    type="button"
                    className="choice choice-sm"
                    onClick={() => { setFormData({ ...formData, name: suggestion }); clear('name'); }}
                  >
                    Usar “{suggestion}”
                  </button>
                </div>
              ) : undefined
            }
          >
            <Input
              data-autofocus
              type="text"
              autoComplete="off"
              placeholder="Ej: Verano 2026"
              value={formData.name}
              onChange={(e) => { setFormData({ ...formData, name: e.target.value }); clear('name'); }}
            />
          </Field>

          {spaces.length > 0 ? (
            <ChoiceOrSelect
              legend="Espacio"
              placeholder="Elegir espacio…"
              options={spaces.map(space => ({
                value: String(space.id),
                label: space.name,
                icon: <SpaceTypeIcon type={space.type} />,
              }))}
              value={formData.spaceId || null}
              onChange={(spaceId) => { setFormData({ ...formData, spaceId }); clear('space'); }}
              error={errors.space}
              aside={
                <button
                  type="button"
                  className="text-[0.8125rem] font-semibold text-[color:var(--brand-text)] hover:underline"
                  onClick={() => setShowInlineSpaceModal(true)}
                >
                  + Nuevo espacio
                </button>
              }
            />
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
                  Crear espacio
                </button>
              }
            />
          )}

          <DateField
            label="Arranca"
            value={formData.startDate}
            onChange={(startDate) => setFormData({ ...formData, startDate })}
            hint="El día 1 del ciclo."
          />
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
