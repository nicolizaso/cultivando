"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, RefreshCw, CalendarDays, Warehouse, FlaskConical } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import Logo from "@/components/Logo";

const LINKS = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/plants", label: "Plantas", icon: Logo },
  { href: "/cycles", label: "Ciclos", icon: RefreshCw },
  { href: "/spaces", label: "Espacios", icon: Warehouse },
  { href: "/calendar", label: "Agenda", icon: CalendarDays },
  { href: "/fertilizers", label: "Nutrición", icon: FlaskConical },
];

export default function DesktopNavbar() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  if (pathname === "/login") return null;

  return (
    <header className="chrome-bar sticky top-0 z-50 hidden border-b md:block">
      {/* Altura fija de 64px: la barra no puede comerse el viewport */}
      <nav
        aria-label="Navegación principal"
        className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-8 px-6"
      >
        <Link href="/" className="group flex shrink-0 items-center gap-2.5 rounded-[var(--radius-md)] py-2">
          <Logo
            className="h-7 w-7 text-[color:var(--brand-text)] transition-transform duration-300 group-hover:rotate-6"
            strokeWidth={2}
            aria-hidden="true"
          />
          <span className="font-title text-[15px] font-semibold tracking-tight text-fg">
            Cultiva con el Primo
          </span>
        </Link>

        <ul className="flex items-center gap-1">
          {LINKS.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;

            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm font-semibold transition-colors ${
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
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
                  {/* Bajo 1280px la barra se queda sin sitio: el texto se oculta
                      visualmente pero sigue siendo el nombre accesible del enlace. */}
                  <span className="sr-only xl:not-sr-only">{link.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
