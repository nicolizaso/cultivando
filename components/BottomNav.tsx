"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import MoreSheet from "@/components/layout/MoreSheet";
import { PRIMARY_NAV, SECONDARY_NAV, isNavItemActive } from "@/app/lib/navigation";

/**
 * Barra de pestañas de móvil y tableta.
 *
 * Cuatro secciones de uso diario más "Más", que abre la hoja con Espacios,
 * Nutrición, tema y cuenta. Antes Nutrición no estaba en ninguna pestaña y sólo
 * se llegaba a ella por un hamburguesa dentro de la cabecera de cada página.
 */
export default function BottomNav({ email }: { email?: string }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  if (pathname === "/login") return null;

  const isSecondaryActive = SECONDARY_NAV.some((item) => isNavItemActive(pathname, item.href));

  const itemClasses = (isActive: boolean) =>
    `group relative flex min-h-[54px] w-full flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] px-1 py-2 text-[10px] font-semibold tracking-wide transition-colors ${
      isActive ? "text-[color:var(--brand-text)]" : "text-fg-muted hover:text-fg"
    }`;

  return (
    <>
      <nav
        aria-label="Navegación principal"
        className="chrome-bar fixed inset-x-0 bottom-0 z-50 border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="mx-auto flex max-w-lg items-stretch justify-around gap-0.5 px-1.5 py-1">
          {PRIMARY_NAV.map((item) => {
            const isActive = isNavItemActive(pathname, item.href);
            const Icon = item.icon;

            return (
              <li key={item.href} className="flex-1">
                <Link href={item.href} aria-current={isActive ? "page" : undefined} className={itemClasses(isActive)}>
                  {isActive && (
                    <motion.span
                      layoutId={reduceMotion ? undefined : "bottom-nav-active"}
                      className="absolute inset-0 -z-10 rounded-[var(--radius-md)] bg-brand-soft"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      aria-hidden="true"
                    />
                  )}
                  <Icon className="h-[21px] w-[21px]" strokeWidth={isActive ? 2.3 : 2} aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}

          <li className="flex-1">
            <button
              type="button"
              onClick={() => setIsMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={isMoreOpen}
              className={itemClasses(isSecondaryActive)}
            >
              {isSecondaryActive && (
                <span className="absolute inset-0 -z-10 rounded-[var(--radius-md)] bg-brand-soft" aria-hidden="true" />
              )}
              <MoreHorizontal className="h-[21px] w-[21px]" strokeWidth={2} aria-hidden="true" />
              Más
            </button>
          </li>
        </ul>
      </nav>

      <MoreSheet isOpen={isMoreOpen} onClose={() => setIsMoreOpen(false)} email={email} />
    </>
  );
}
