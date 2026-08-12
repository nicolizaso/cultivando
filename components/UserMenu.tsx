"use client";

import { useState, useRef, useEffect } from "react";
import { signout } from "@/app/login/actions";
import { LogOut, User, ChevronDown } from "lucide-react";

export default function UserMenu({ email }: { email?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Al abrir con teclado, el foco entra en la primera opción del menú.
  useEffect(() => {
    if (isOpen) menuRef.current?.querySelector<HTMLElement>("button")?.focus();
  }, [isOpen]);

  const initial = email ? email[0].toUpperCase() : "U";

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={email ? `Cuenta de ${email}` : "Menú de cuenta"}
        className={`flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 transition-colors ${
          isOpen
            ? "border-[color:var(--brand)] bg-surface text-fg"
            : "border-line bg-surface text-fg-muted hover:border-line-strong hover:text-fg"
        }`}
      >
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-[color:var(--brand-fg)]"
          aria-hidden="true"
        >
          {initial}
        </span>
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Opciones de cuenta"
          className="animate-scale-in absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface shadow-[var(--shadow-lg)]"
        >
          <div className="border-b border-line bg-surface-2 p-4">
            <div className="mb-1.5 flex items-center gap-2">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] bg-brand-soft text-[color:var(--brand-text)]"
                aria-hidden="true"
              >
                <User size={15} />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-widest text-fg-subtle">Cuenta</span>
            </div>
            <p className="truncate text-sm font-medium text-fg" title={email}>
              {email || "Usuario"}
            </p>
          </div>

          <div className="p-2">
            <button
              type="button"
              role="menuitem"
              onClick={() => signout()}
              className="group flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-left text-sm font-medium text-[color:var(--danger)] transition-colors hover:bg-[color:var(--danger-soft)]"
            >
              <LogOut size={16} className="transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
