"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import Modal from "@/components/ui/Modal";
import ThemeToggle from "@/components/ThemeToggle";
import { SECONDARY_NAV, isNavItemActive } from "@/app/lib/navigation";
import { signout } from "@/app/login/actions";

interface MoreSheetProps {
  isOpen: boolean;
  onClose: () => void;
  email?: string;
}

/**
 * Hoja "Más" de la barra de pestañas: las secciones de configuración del
 * cultivo, el tema y la cuenta.
 *
 * Se monta sobre el mismo `Modal` accesible que el resto de la app, así que
 * hereda foco atrapado, cierre con Escape y bloqueo del scroll de fondo. La
 * versión anterior era un panel a mano dentro de la cabecera con su propio
 * manejo de teclado, duplicado y a medias.
 */
export default function MoreSheet({ isOpen, onClose, email }: MoreSheetProps) {
  const pathname = usePathname();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Más" description="Configuración del cultivo y de tu cuenta">
      <div className="space-y-7">
        <section className="space-y-2">
          <h3 className="section-title text-sm">Secciones</h3>

          <ul className="space-y-2">
            {SECONDARY_NAV.map((item) => {
              const Icon = item.icon;
              const isActive = isNavItemActive(pathname, item.href);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center gap-3.5 rounded-[var(--radius-lg)] border p-3.5 transition-colors ${
                      isActive
                        ? "border-[color:color-mix(in_srgb,var(--brand)_32%,transparent)] bg-brand-soft"
                        : "border-line bg-surface-2 hover:border-line-strong"
                    }`}
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-surface text-[color:var(--brand-text)]"
                      aria-hidden="true"
                    >
                      <Icon size={19} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-fg">{item.label}</span>
                      <span className="block text-xs text-fg-muted">{item.description}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="section-title text-sm">Apariencia</h3>
          <div className="flex items-center justify-between rounded-[var(--radius-lg)] border border-line bg-surface-2 py-1.5 pl-4 pr-1.5">
            <span className="text-sm font-medium text-fg">Tema visual</span>
            <ThemeToggle />
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="section-title text-sm">Cuenta</h3>

          <div className="rounded-[var(--radius-lg)] border border-line bg-surface-2 p-4">
            <div className="mb-4 flex items-center gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-[color:var(--brand-fg)]"
                aria-hidden="true"
              >
                {email ? email[0].toUpperCase() : "U"}
              </span>
              <p className="min-w-0 truncate text-sm font-medium text-fg" title={email}>
                {email || "Usuario"}
              </p>
            </div>

            <button type="button" onClick={() => signout()} className="btn btn-danger w-full">
              <LogOut size={17} aria-hidden="true" />
              Cerrar sesión
            </button>
          </div>
        </section>
      </div>
    </Modal>
  );
}
