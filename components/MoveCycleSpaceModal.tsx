"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRightLeft, Loader2, Plus, Warehouse } from "lucide-react";

import { Space } from "@/app/lib/types";
import { moveCycleToSpace } from "@/app/cycles/actions";
import { useToast } from "@/app/context/ToastContext";
import CreateSpaceInlineModal from "./CreateSpaceInlineModal";
import EmptyState from "./EmptyState";
import Modal from "@/components/ui/Modal";

interface MoveCycleSpaceModalProps {
  cycleId: number;
  /** Espacio actual del ciclo: se excluye de la lista de destinos. */
  currentSpaceId: number | null;
  spaces: Pick<Space, 'id' | 'name' | 'type'>[];
  /** Plantas que se mudan junto al ciclo, para avisarlo antes de confirmar. */
  plantCount?: number;
}

/**
 * Mudar un ciclo de espacio sólo se podía haciendo una tarea de "Cambiar
 * ambiente" y completándola; cuando la carpa ya cambió (se rompió un extractor,
 * se pasó el cultivo al exterior) lo que hace falta es corregirlo y seguir.
 */
export default function MoveCycleSpaceModal({
  cycleId,
  currentSpaceId,
  spaces,
  plantCount = 0,
}: MoveCycleSpaceModalProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spaceId, setSpaceId] = useState("");
  const [showInlineSpaceModal, setShowInlineSpaceModal] = useState(false);

  const targets = spaces.filter(space => space.id !== currentSpaceId);

  const close = () => {
    if (loading) return;
    setIsOpen(false);
    setError(null);
    setSpaceId("");
  };

  const handleSpaceCreated = (newSpaceId: number) => {
    setShowInlineSpaceModal(false);
    setSpaceId(newSpaceId.toString());
    // El espacio recién creado todavía no está en las props; hace falta el
    // refresh del servidor para que aparezca en el desplegable.
    router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!spaceId) {
      setError("Elegí el espacio de destino");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await moveCycleToSpace(cycleId, Number(spaceId));

      if (result.success) {
        setIsOpen(false);
        setSpaceId("");
        showToast(`Ciclo mudado a ${result.spaceName}`);
        router.refresh();
      } else {
        setError(result.error ?? "No se pudo mover el ciclo de espacio");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="btn btn-sm btn-ghost">
        <ArrowRightLeft size={14} aria-hidden="true" />
        Cambiar espacio
      </button>

      <Modal
        isOpen={isOpen}
        onClose={close}
        title="Cambiar el ciclo de espacio"
        description="El ciclo y sus plantas pasan a la nueva carpa o lugar de cultivo."
        size="sm"
        dismissOnBackdrop={!loading}
        footer={
          targets.length > 0 ? (
            <>
              <button type="button" className="btn btn-ghost" onClick={close} disabled={loading}>
                Cancelar
              </button>
              <button type="submit" form="move-cycle-form" className="btn btn-primary" disabled={loading}>
                {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                {loading ? "Mudando..." : "Mudar ciclo"}
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={close}>
              Cerrar
            </button>
          )
        }
      >
        {targets.length > 0 ? (
          <form id="move-cycle-form" onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <p className="field-error" role="alert">
                <AlertCircle size={14} aria-hidden="true" />
                {error}
              </p>
            )}

            <div className="field">
              <label htmlFor="move-cycle-space" className="field-label">Nuevo espacio</label>
              <select
                id="move-cycle-space"
                data-autofocus
                required
                aria-invalid={error ? true : undefined}
                className="field-input"
                value={spaceId}
                onChange={(e) => {
                  setSpaceId(e.target.value);
                  setError(null);
                }}
              >
                <option value="">Seleccionar espacio...</option>
                {targets.map(space => (
                  <option key={space.id} value={space.id}>
                    {space.name} ({space.type})
                  </option>
                ))}
              </select>
            </div>

            <p className="text-sm leading-relaxed text-fg-muted">
              {plantCount > 0
                ? `Se mudan también las ${plantCount} plantas del ciclo. Las mediciones y fotos ya registradas quedan como están.`
                : 'Las mediciones y fotos ya registradas quedan como están.'}
            </p>
          </form>
        ) : (
          <EmptyState
            icon={Warehouse}
            title="No hay otro espacio"
            description="Este es el único espacio que tenés. Creá otro para poder mudar el ciclo."
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
