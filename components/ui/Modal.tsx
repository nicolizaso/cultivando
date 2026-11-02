"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { useIsClient } from "@/app/hooks/useIsClient";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

type ModalSize = "sm" | "md" | "lg" | "xl";

const SIZES: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** Texto de apoyo bajo el título. También se anuncia como descripción del diálogo. */
  description?: string;
  size?: ModalSize;
  children: React.ReactNode;
  /** Acciones fijas al pie, fuera del área con scroll. */
  footer?: React.ReactNode;
  /** Desactiva el cierre por clic en el fondo (útil en formularios largos). */
  dismissOnBackdrop?: boolean;
  /** Oculta el título visualmente pero lo mantiene para lectores de pantalla. */
  hideTitle?: boolean;
}

/**
 * Diálogo modal accesible:
 * role="dialog" + aria-modal, cierre con Escape, foco atrapado dentro del panel,
 * foco devuelto al disparador al cerrar y scroll del fondo bloqueado.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  size = "md",
  children,
  footer,
  dismissOnBackdrop = true,
  hideTitle = false,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const mounted = useIsClient();
  const titleId = useId();
  const descId = useId();

  // Guarda quién abrió el modal para devolverle el foco al cerrar.
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement | null;
    } else {
      triggerRef.current?.focus?.();
    }
  }, [isOpen]);

  // Bloquea el scroll del documento mientras el modal está abierto.
  useEffect(() => {
    if (!isOpen) return;
    const { overflow, paddingRight } = document.body.style;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
    };
  }, [isOpen]);

  // Foco inicial dentro del panel. En pantallas táctiles enfocar un campo de
  // texto abre el teclado, que tapa medio formulario antes de que se pueda
  // leer: ahí el foco va al diálogo mismo (el lector de pantalla lo anuncia
  // igual) y el teclado aparece recién cuando se toca un campo.
  useEffect(() => {
    if (!isOpen) return;
    const id = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const touch = window.matchMedia("(pointer: coarse)").matches;
      const preferred = panel.querySelector<HTMLElement>("[data-autofocus]");
      const opensKeyboard = preferred?.matches(
        'input:not([type="checkbox"]):not([type="radio"]):not([type="date"]), textarea'
      );
      const target =
        touch && (opensKeyboard || !preferred)
          ? panel
          : preferred ?? panel.querySelector<HTMLElement>(FOCUSABLE) ?? panel;
      target.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(id);
  }, [isOpen]);

  // El encabezado se separa del contenido con una línea sólo cuando hay algo
  // desplazado debajo; arriba de todo, título y formulario son un solo bloque.
  const [scrolled, setScrolled] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen || !mounted) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting), {
      root: sentinel.parentElement,
      threshold: 1,
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isOpen, mounted]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center p-0 sm:items-center sm:p-4"
      onKeyDown={handleKeyDown}
    >
      <div
        className="absolute inset-0 bg-[color:var(--scrim)] animate-fade-in"
        onClick={dismissOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`relative flex w-full ${SIZES[size]} max-h-[92dvh] flex-col overflow-clip rounded-t-[var(--radius-panel)] border border-line bg-surface shadow-[var(--shadow-overlay)] outline-none animate-sheet-in sm:rounded-[var(--radius-panel)] sm:animate-scale-in`}
      >
        {/* Asa de hoja: en el teléfono el diálogo sube desde abajo */}
        <span className="mx-auto mt-2 block h-1 w-10 shrink-0 rounded-full bg-[color:var(--border-strong)] sm:hidden" aria-hidden="true" />

        <header
          className={`flex items-start justify-between gap-4 border-b px-5 pb-3 pt-3 transition-colors sm:pt-5 ${
            scrolled ? "border-line" : "border-transparent"
          }`}
        >
          <div className={hideTitle ? "sr-only" : "min-w-0"}>
            <h2 id={titleId} className="font-title text-xl font-semibold tracking-tight text-fg">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-sm text-fg-muted">
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn-icon -mr-2 shrink-0"
            aria-label="Cerrar diálogo"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-2">
          <div ref={sentinelRef} className="h-px" aria-hidden="true" />
          {children}
        </div>

        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-line bg-surface px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
}
