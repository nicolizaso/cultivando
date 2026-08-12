"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import UserMenu from "@/components/UserMenu";
import ThemeToggle from "@/components/ThemeToggle";
import { Menu, X, FlaskConical, LogOut } from "lucide-react";
import Logo from "@/components/Logo";
import { signout } from "@/app/login/actions";

interface GlobalHeaderProps {
  title?: string;
  subtitle?: string;
  userEmail?: string;
}

export default function GlobalHeader({ title, subtitle, userEmail }: GlobalHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Escape cierra el panel y el fondo no debe hacer scroll mientras está abierto.
  useEffect(() => {
    if (!isMenuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <header className="mb-8 flex items-start justify-between gap-4 pt-1">
      <div className="min-w-0">
        {/* El lockup de marca sólo aparece en móvil: en escritorio ya está en la barra superior */}
        <div className="mb-1.5 flex items-center gap-2 md:hidden">
          <Logo className="h-6 w-6 text-[color:var(--brand-text)]" strokeWidth={2} aria-hidden="true" />
          <span className="font-title text-[15px] font-semibold tracking-tight text-fg">
            Cultiva con el Primo
          </span>
        </div>

        {title && (
          <h1 className="font-title text-2xl font-semibold tracking-tight text-fg md:text-[28px]">
            {title}
          </h1>
        )}
        {subtitle && <p className="mt-1 text-sm text-fg-muted">{subtitle}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <div className="hidden items-center gap-1 md:flex">
          <ThemeToggle />
          <UserMenu email={userEmail} />
        </div>

        <button
          type="button"
          className="btn-icon md:hidden"
          onClick={() => setIsMenuOpen(true)}
          aria-label="Abrir menú"
          aria-expanded={isMenuOpen}
          aria-haspopup="dialog"
        >
          <Menu size={22} aria-hidden="true" />
        </button>
      </div>

      {mounted &&
        isMenuOpen &&
        createPortal(
          <div className="fixed inset-0 z-[120] md:hidden">
            <div
              className="absolute inset-0 bg-[color-mix(in_srgb,var(--fg)_55%,transparent)] animate-fade-in"
              onClick={() => setIsMenuOpen(false)}
              aria-hidden="true"
            />

            <div
              role="dialog"
              aria-modal="true"
              aria-label="Menú"
              className="animate-scale-in absolute inset-y-0 right-0 flex w-[86%] max-w-sm flex-col border-l border-line bg-surface shadow-[var(--shadow-overlay)]"
            >
              <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
                <div className="flex items-center gap-2">
                  <Logo className="h-6 w-6 text-[color:var(--brand-text)]" strokeWidth={2} aria-hidden="true" />
                  <span className="font-title text-[15px] font-semibold text-fg">Cultiva con el Primo</span>
                </div>
                <button
                  type="button"
                  className="btn-icon -mr-2"
                  onClick={() => setIsMenuOpen(false)}
                  aria-label="Cerrar menú"
                  autoFocus
                >
                  <X size={22} aria-hidden="true" />
                </button>
              </div>

              <div className="custom-scrollbar flex-1 space-y-7 overflow-y-auto p-5">
                <section className="space-y-3">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-fg-subtle">Secciones</h2>
                  <Link
                    href="/fertilizers"
                    onClick={() => setIsMenuOpen(false)}
                    className="surface-interactive flex items-center gap-3 rounded-[var(--radius-lg)] p-4 text-fg"
                  >
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-[color:var(--brand-text)]"
                      aria-hidden="true"
                    >
                      <FlaskConical size={20} />
                    </span>
                    <span className="font-medium">Nutrición</span>
                  </Link>
                </section>

                <section className="space-y-3">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-fg-subtle">Preferencias</h2>
                  <div className="surface flex items-center justify-between rounded-[var(--radius-lg)] py-2 pl-4 pr-2">
                    <span className="font-medium text-fg">Tema visual</span>
                    <ThemeToggle />
                  </div>
                </section>
              </div>

              <div className="border-t border-line bg-surface-2 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                <div className="mb-4 flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-[color:var(--brand-fg)]"
                    aria-hidden="true"
                  >
                    {userEmail ? userEmail[0].toUpperCase() : "U"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg" title={userEmail}>
                      {userEmail || "Usuario"}
                    </p>
                    <p className="text-xs text-fg-muted">Cuenta activa</p>
                  </div>
                </div>

                <button type="button" onClick={() => signout()} className="btn btn-danger w-full">
                  <LogOut size={18} aria-hidden="true" />
                  Cerrar sesión
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </header>
  );
}
