"use client";

import React, { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import Modal from "./Modal";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "brand";
}

/**
 * Reemplazo accesible de window.confirm: el navegador no permite estilar ni
 * traducir ese diálogo, y bloquea el hilo principal.
 */
export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "danger",
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      dismissOnBackdrop={!loading}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={tone === "danger" ? "btn btn-danger" : "btn btn-primary"}
            onClick={handleConfirm}
            disabled={loading}
            data-autofocus
          >
            {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {loading ? "Procesando..." : confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex gap-4">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          style={{
            backgroundColor: tone === "danger" ? "var(--danger-soft)" : "var(--brand-soft)",
            color: tone === "danger" ? "var(--danger)" : "var(--brand-text)",
          }}
          aria-hidden="true"
        >
          <AlertTriangle size={20} />
        </span>
        <p className="text-sm leading-relaxed text-fg-muted">{description}</p>
      </div>
    </Modal>
  );
}
