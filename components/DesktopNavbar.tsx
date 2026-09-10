"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import BrandLockup from "@/components/Brand";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/UserMenu";
import { ALL_NAV, isNavItemActive } from "@/app/lib/navigation";

/**
 * Barra superior, sólo a partir de 1024px.
 *
 * Antes aparecía ya en 768px y no le entraban las seis secciones, así que las
 * etiquetas se escondían con `sr-only` y quedaba una fila de iconos mudos. Al
 * subir el corte a `lg` las seis caben con su texto, y las tabletas se quedan
 * con la barra de pestañas inferior, que es más cómoda de todos modos.
 */
export default function DesktopNavbar({ email }: { email?: string }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  if (pathname === "/login") return null;

  return (
    <header className="chrome-bar sticky top-0 z-50 hidden border-b lg:block">
      <nav
        aria-label="Navegación principal"
        className="mx-auto flex h-16 max-w-[1280px] items-center gap-6 px-6 lg:px-8"
      >
        <Link href="/" className="shrink-0 rounded-[var(--radius-md)]" aria-label="Cultivando, ir al panel">
          <BrandLockup size="sm" />
        </Link>

        <ul className="flex items-center gap-0.5">
          {ALL_NAV.map((item) => {
            const isActive = isNavItemActive(pathname, item.href);
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-[13px] font-semibold transition-colors ${
                    isActive
                      ? "text-[color:var(--brand-text)]"
                      : "text-fg-muted hover:bg-surface-3 hover:text-fg"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId={reduceMotion ? undefined : "desktop-nav-active"}
                      className="absolute inset-0 -z-10 rounded-[var(--radius-md)] bg-brand-soft"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      aria-hidden="true"
                    />
                  )}
                  <Icon className="h-[17px] w-[17px]" strokeWidth={2} aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <ThemeToggle />
          <UserMenu email={email} />
        </div>
      </nav>
    </header>
  );
}
